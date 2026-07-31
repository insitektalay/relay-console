import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct MicrosoftDynamics365ProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol MicrosoftDynamics365ProviderActionClient: Sendable { func executeMicrosoftDynamics365Action(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftDynamics365ProviderActionClientResult }
public struct FakeMicrosoftDynamics365ProviderActionClient: MicrosoftDynamics365ProviderActionClient {
    public init() {};
    public func executeMicrosoftDynamics365Action(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftDynamics365ProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "microsoft_dynamics_365_organization_get": fields = ["organization": .object(MicrosoftDynamics365ProviderActionSupport.fakeOrganization())];
        case "microsoft_dynamics_365_accounts_list": fields = ["accounts": .array([.object(MicrosoftDynamics365ProviderActionSupport.fakeAccount())]), "resultCount": .number(1)];
        case "microsoft_dynamics_365_account_get": _ = try MicrosoftDynamics365ProviderActionSupport.identifier(request.payload["accountId"], "accountId"); fields = ["account": .object(MicrosoftDynamics365ProviderActionSupport.fakeAccount())];
        case "microsoft_dynamics_365_opportunities_list": fields = ["opportunities": .array([.object(MicrosoftDynamics365ProviderActionSupport.fakeOpportunity())]), "resultCount": .number(1)];
        default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_dynamics_365_action_not_supported", message: "Unsupported Dynamics 365 action.")
        }; return MicrosoftDynamics365ProviderActionClientResult(result: MicrosoftDynamics365ProviderActionSupport.base("fake-dataverse").merging(fields) { _, n in n })
    }
}
public final class LiveMicrosoftDynamics365ProviderActionClient: MicrosoftDynamics365ProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeMicrosoftDynamics365Action(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftDynamics365ProviderActionClientResult {
        let auth = try authorization(request), root: JSONValue, fields: JSONRecord;
        switch request.definition.actionKey {
        case "microsoft_dynamics_365_organization_get":
            root = try get(token: auth.token, origin: auth.origin, path: "/organizations?$select=organizationid,friendlyname,uniquename,version,languagecode&$top=1"); let value = MicrosoftDynamics365ProviderActionSupport.records(root).first;
            fields = ["organization": .object(MicrosoftDynamics365ProviderActionSupport.organization(value))];
        case "microsoft_dynamics_365_accounts_list":
            root = try get(token: auth.token, origin: auth.origin, path: "/accounts?$select=accountid,name,accountnumber,industrycode,revenue,statecode,statuscode,createdon,modifiedon&$top=25&$orderby=modifiedon%20desc");
            let values = MicrosoftDynamics365ProviderActionSupport.records(root).map(MicrosoftDynamics365ProviderActionSupport.account); fields = ["accounts": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "microsoft_dynamics_365_account_get":
            let id = try MicrosoftDynamics365ProviderActionSupport.identifier(request.payload["accountId"], "accountId");
            root = try get(token: auth.token, origin: auth.origin, path: "/accounts(\(id))?$select=accountid,name,accountnumber,industrycode,revenue,statecode,statuscode,createdon,modifiedon"); fields = ["account": .object(MicrosoftDynamics365ProviderActionSupport.account(root))];
        case "microsoft_dynamics_365_opportunities_list":
            root = try get(token: auth.token, origin: auth.origin, path: "/opportunities?$select=opportunityid,name,estimatedvalue,estimatedclosedate,closeprobability,salesstagecode,statecode,statuscode,createdon,modifiedon&$top=25&$orderby=modifiedon%20desc");
            let values = MicrosoftDynamics365ProviderActionSupport.records(root).map(MicrosoftDynamics365ProviderActionSupport.opportunity); fields = ["opportunities": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_dynamics_365_live_action_not_supported", message: "Unsupported live Dynamics 365 action.")
        }; return MicrosoftDynamics365ProviderActionClientResult(result: MicrosoftDynamics365ProviderActionSupport.base("live-dataverse").merging(fields) { _, n in n })
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, origin: String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "microsoft-dynamics-365", c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
            c.health.diagnostics["selectedEnvironmentVerified"]?.bool == true, c.health.diagnostics["getOnly"]?.bool == true, c.health.diagnostics["fixedSelectOnly"]?.bool == true, c.health.diagnostics["customTablesEnabled"]?.bool == false,
            c.health.diagnostics["identitiesContactsEnabled"]?.bool == false, c.health.diagnostics["writesEnabled"]?.bool == false, c.health.diagnostics["automaticPagination"]?.bool == false, c.health.diagnostics["rawToolsEnabled"]?.bool == false,
            let origin = c.health.diagnostics["environmentOrigin"]?.string, c.grantedScopes == [origin + "/user_impersonation"], let ref = c.credentialRequirements.first(where: { $0.fieldKey == "microsoft_dynamics_365_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_dynamics_365_connection_not_ready", message: "Dynamics 365 requires a ready exact-scope selected-environment GET-only connection.") };
        return (try secrets.getSecretValue(ref), try MicrosoftDynamics365ProviderActionSupport.environmentOrigin(origin))
    }
    private func get(token: String, origin: String, path: String) throws -> JSONValue {
        let base = try MicrosoftDynamics365ProviderActionSupport.environmentOrigin(origin);
        guard let url = URL(string: base + "/api/data/v9.2" + path), url.scheme == "https", MicrosoftDynamics365ProviderActionSupport.safeHost(url.host), url.path.hasPrefix("/api/data/v9.2/"), ["organizations", "accounts", "opportunities"].contains(where: { url.path.contains("/\($0)") }),
            url.query != nil, !url.absoluteString.contains("$expand"), !url.absoluteString.contains("fetchXml"), !url.absoluteString.contains("$skiptoken")
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_dynamics_365_unsafe_url", message: "Unsafe Dataverse request.") }; var req = URLRequest(url: url, timeoutInterval: 30); req.httpMethod = "GET"; req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization");
        req.setValue("application/json", forHTTPHeaderField: "Accept"); let sem = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?;
        URLSession.shared.dataTask(with: req) { bytes, response, error in
            defer { sem.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "microsoft_dynamics_365_transport_error", message: "Dataverse returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume(); guard sem.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_dynamics_365_timeout", message: "Dataverse request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "microsoft_dynamics_365_rate_limited" : "microsoft_dynamics_365_api_error", message: "Dataverse request failed.", providerStatusCode: response.statusCode)
        }; guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_dynamics_365_response_too_large", message: "Dataverse response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
    }
}
public struct MicrosoftDynamics365ProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["microsoft_dynamics_365_organization_get", "microsoft_dynamics_365_accounts_list", "microsoft_dynamics_365_account_get", "microsoft_dynamics_365_opportunities_list"]; private let client: any MicrosoftDynamics365ProviderActionClient;
    public init(client: any MicrosoftDynamics365ProviderActionClient = FakeMicrosoftDynamics365ProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "microsoft-dynamics-365", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_dynamics_365_action_not_allowlisted", message: "Dynamics 365 V1 permits only four fixed selected-environment GET reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeMicrosoftDynamics365Action(request: request).result, error: nil, redactionStatus: "contacts-identities-notes-custom-search-expand-schema-actions-writes-export-pagination-raw-excluded")
    }
}
public enum MicrosoftDynamics365ProviderActionSupport {
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("microsoft-dynamics-365"), "adapterBoundary": .string("microsoft-dynamics-365-provider-action-adapter"), "clientMode": .string(mode), "selectedEnvironmentOnly": .bool(true), "getOnly": .bool(true), "fixedSelectOnly": .bool(true), "maxResults": .number(25),
            "writesEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    public static func safeHost(_ host: String?) -> Bool {
        guard let host = host?.lowercased() else { return false }; return host.hasSuffix(".api.crm.dynamics.com") || host.hasSuffix(".api.crm.dynamics.cn") || host.hasSuffix(".api.crm.microsoftdynamics.us") || host.hasSuffix(".api.crm9.dynamics.com")
    }
    public static func environmentOrigin(_ value: String) throws -> String {
        guard let url = URL(string: value), url.scheme == "https", safeHost(url.host), url.port == nil, (url.path.isEmpty || url.path == "/"), url.query == nil, url.fragment == nil else {
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_dynamics_365_invalid_environment", message: "A verified Microsoft Dataverse environment origin is required.")
        }; return "https://" + (url.host ?? "")
    }
    static func object(_ v: JSONValue?) -> JSONRecord { guard case .object(let r)? = v else { return [:] }; return r }; static func array(_ v: JSONValue?) -> [JSONValue] { guard case .array(let a)? = v else { return [] }; return a };
    static func scalar(_ v: JSONValue?, _ max: Int = 512) -> JSONValue { guard let v else { return .null }; if case .string(let s) = v { return .string(String(s.prefix(max))) }; if case .number = v { return v }; if case .bool = v { return v }; return .null };
    static func records(_ root: JSONValue?) -> [JSONValue] { Array(array(object(root)["value"]).prefix(25)) }
    static func identifier(_ v: JSONValue?, _ field: String) throws -> String {
        guard let s = v?.string, !s.isEmpty, s.count <= 128, s.allSatisfy({ $0.isLetter || $0.isNumber || "-_".contains($0) }) else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_dynamics_365_invalid_identifier", message: "An explicit safe \(field) is required.") }; return s
    }
    static func organization(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return ["id": scalar(r["organizationid"], 128), "friendlyName": scalar(r["friendlyname"]), "uniqueName": scalar(r["uniquename"]), "version": scalar(r["version"], 64), "languageCode": scalar(r["languagecode"]), "identityFieldsExcluded": .bool(true), "schemaExcluded": .bool(true)]
    }
    static func account(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["accountid"], 128), "name": scalar(r["name"]), "accountNumber": scalar(r["accountnumber"], 64), "industryCode": scalar(r["industrycode"]), "revenue": scalar(r["revenue"]), "stateCode": scalar(r["statecode"]), "statusCode": scalar(r["statuscode"]),
            "createdOn": scalar(r["createdon"], 64), "modifiedOn": scalar(r["modifiedon"], 64), "contactsExcluded": .bool(true), "addressesExcluded": .bool(true), "ownersExcluded": .bool(true), "notesExcluded": .bool(true),
        ]
    }
    static func opportunity(_ v: JSONValue?) -> JSONRecord {
        let r = object(v);
        return [
            "id": scalar(r["opportunityid"], 128), "name": scalar(r["name"]), "estimatedValue": scalar(r["estimatedvalue"]), "estimatedCloseDate": scalar(r["estimatedclosedate"], 64), "closeProbability": scalar(r["closeprobability"]), "salesStageCode": scalar(r["salesstagecode"]),
            "stateCode": scalar(r["statecode"]), "statusCode": scalar(r["statuscode"]), "createdOn": scalar(r["createdon"], 64), "modifiedOn": scalar(r["modifiedon"], 64), "customerLookupExcluded": .bool(true), "ownerExcluded": .bool(true), "descriptionNotesExcluded": .bool(true),
        ]
    }
    static func fakeOrganization() -> JSONRecord { ["id": .string("org-001"), "friendlyName": .string("Contoso Sales"), "uniqueName": .string("contososales"), "version": .string("9.2.25054.001"), "languageCode": .number(1033), "identityFieldsExcluded": .bool(true), "schemaExcluded": .bool(true)] };
    static func fakeAccount() -> JSONRecord {
        [
            "id": .string("account-001"), "name": .string("Adventure Works"), "accountNumber": .string("AW-1001"), "industryCode": .number(7), "revenue": .number(2500000), "stateCode": .number(0), "statusCode": .number(1), "createdOn": .string("2026-01-05T10:00:00Z"),
            "modifiedOn": .string("2026-07-12T08:00:00Z"), "contactsExcluded": .bool(true), "addressesExcluded": .bool(true), "ownersExcluded": .bool(true), "notesExcluded": .bool(true),
        ]
    };
    static func fakeOpportunity() -> JSONRecord {
        [
            "id": .string("opportunity-001"), "name": .string("Adventure Works renewal"), "estimatedValue": .number(125000), "estimatedCloseDate": .string("2026-08-31"), "closeProbability": .number(70), "salesStageCode": .number(2), "stateCode": .number(0), "statusCode": .number(1),
            "createdOn": .string("2026-05-01T09:00:00Z"), "modifiedOn": .string("2026-07-12T08:00:00Z"), "customerLookupExcluded": .bool(true), "ownerExcluded": .bool(true), "descriptionNotesExcluded": .bool(true),
        ]
    }
}
