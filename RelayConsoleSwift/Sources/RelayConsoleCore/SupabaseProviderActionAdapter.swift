import Foundation

public struct SupabaseProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol SupabaseProviderActionClient: Sendable { func executeSupabaseAction(request: MarketplaceProviderActionAdapterRequest) throws -> SupabaseProviderActionClientResult }

public struct FakeSupabaseProviderActionClient: SupabaseProviderActionClient {
    public init() {}
    public func executeSupabaseAction(request: MarketplaceProviderActionAdapterRequest) throws -> SupabaseProviderActionClientResult {
        let fields: JSONRecord
        switch request.definition.actionKey {
        case "supabase_organization_get": fields = ["semanticReadContract": .string("supabase-organization-get-v1"), "organization": .object(SupabaseProviderActionSupport.fakeOrganization())]
        case "supabase_organization_project_list":
            fields = ["semanticReadContract": .string("supabase-organization-project-list-v1"), "projects": .array([.object(SupabaseProviderActionSupport.fakeProject())]), "pagination": .object(["count": .number(1), "limit": .number(25), "offset": .number(0)]), "automaticPagination": .bool(false)]
        case "supabase_project_get": fields = ["semanticReadContract": .string("supabase-project-get-v1"), "project": .object(SupabaseProviderActionSupport.fakeProject())]
        default: throw MarketplaceProviderActionAdapterFailure(code: "supabase_action_not_supported", message: "Unsupported Supabase action.")
        }
        return SupabaseProviderActionClientResult(result: SupabaseProviderActionSupport.base("fake-supabase-management-api").merging(fields) { _, new in new })
    }
}

public final class LiveSupabaseProviderActionClient: SupabaseProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService
    public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeSupabaseAction(request: MarketplaceProviderActionAdapterRequest) throws -> SupabaseProviderActionClientResult {
        let auth = try authorization(request), limit = SupabaseProviderActionSupport.bound(request.payload["limit"])
        switch request.definition.actionKey {
        case "supabase_organization_get":
            return mapped("supabase-organization-get-v1", ["organization": .object(SupabaseProviderActionSupport.organization(try get(auth.token, path: "/v1/organizations/" + auth.organizationSlug, query: []), slug: auth.organizationSlug))])
        case "supabase_organization_project_list":
            let root = try get(auth.token, path: "/v1/organizations/" + auth.organizationSlug + "/projects", query: [URLQueryItem(name: "offset", value: "0"), URLQueryItem(name: "limit", value: String(limit))]), rootObject = SupabaseProviderActionSupport.object(root),
                projects = SupabaseProviderActionSupport.array(rootObject["projects"]).prefix(limit).map(SupabaseProviderActionSupport.project), pagination = SupabaseProviderActionSupport.object(rootObject["pagination"])
            return mapped(
                "supabase-organization-project-list-v1", ["projects": .array(projects.map(JSONValue.object)), "pagination": .object(["count": SupabaseProviderActionSupport.scalar(pagination["count"]), "limit": .number(Double(limit)), "offset": .number(0)]), "automaticPagination": .bool(false)])
        case "supabase_project_get":
            return mapped("supabase-project-get-v1", ["project": .object(SupabaseProviderActionSupport.project(try get(auth.token, path: "/v1/projects/" + auth.projectRef, query: [])))])
        default: throw MarketplaceProviderActionAdapterFailure(code: "supabase_live_action_not_supported", message: "Unsupported live Supabase action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, organizationSlug: String, projectRef: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "supabase", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.health.diagnostics["apiOrigin"]?.string == SupabaseProviderActionSupport.apiOrigin, connection.grantedScopes == ProviderConnectionService.supabaseReadScopes, let organization = connection.health.diagnostics["organizationSlug"]?.string,
            SupabaseProviderActionSupport.safeSlug(organization), let project = connection.health.diagnostics["projectRef"]?.string, SupabaseProviderActionSupport.safeRef(project),
            let secret = connection.credentialRequirements.first(where: { $0.fieldKey == "supabase_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "supabase_connection_not_ready", message: "Supabase requires a ready exact-scope Organization and selected Project connection.") }
        return (try secrets.getSecretValue(secret), organization, project)
    }
    private func mapped(_ contract: String, _ fields: JSONRecord) -> SupabaseProviderActionClientResult {
        SupabaseProviderActionClientResult(result: SupabaseProviderActionSupport.base("live-supabase-management-api").merging(["semanticReadContract": .string(contract)].merging(fields) { _, new in new }) { _, new in new })
    }
    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: SupabaseProviderActionSupport.apiOrigin + path); components?.queryItems = query.isEmpty ? nil : query
        guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "supabase_invalid_url", message: "Could not build an allowlisted Supabase Management API URL.") }
        var request = URLRequest(url: url); request.timeoutInterval = 20; request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Accept")
        let semaphore = DispatchSemaphore(value: 0); var outcome: Result<(Data, Int), Error>!
        URLSession.shared.dataTask(with: request) { data, response, error in outcome = error.map(Result.failure) ?? .success((data ?? Data(), (response as? HTTPURLResponse)?.statusCode ?? 0)); semaphore.signal() }.resume()
        guard semaphore.wait(timeout: .now() + 20) == .success else { throw MarketplaceProviderActionAdapterFailure(code: "supabase_timeout", message: "Supabase Management API request timed out.") }
        let (bytes, status) = try outcome.get();
        guard (200..<300).contains(status) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: status == 429 ? "supabase_rate_limited" : status == 401 ? "supabase_access_token_invalid" : status == 403 ? "supabase_scope_or_membership_denied" : status == 404 ? "supabase_resource_not_found" : "supabase_api_error", message: "Supabase Management API request failed.",
                providerStatusCode: status)
        }
        return bytes.isEmpty ? .object([:]) : SupabaseProviderActionSupport.json(try JSONSerialization.jsonObject(with: bytes))
    }
}

public struct SupabaseProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["supabase_organization_get", "supabase_organization_project_list", "supabase_project_get"]
    private let client: any SupabaseProviderActionClient
    public init(client: any SupabaseProviderActionClient = FakeSupabaseProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "supabase", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "supabase_action_not_allowlisted", message: "Supabase V1 permits only three bounded Organization and Project reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeSupabaseAction(request: request).result, error: nil, redactionStatus: "database-secrets-config-members-logs-excluded")
    }
}

public enum SupabaseProviderActionSupport {
    public static let apiOrigin = "https://api.supabase.com"
    static func base(_ mode: String) -> JSONRecord { ["provider": .string("supabase"), "adapterBoundary": .string("supabase-provider-action-adapter"), "clientMode": .string(mode), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("database-secrets-config-members-logs-excluded")] }
    public static func safeSlug(_ value: String) -> Bool { (2...128).contains(value.count) && value.range(of: "^[a-z0-9][a-z0-9_-]{1,127}$", options: .regularExpression) != nil }
    public static func safeRef(_ value: String) -> Bool { value.range(of: "^[a-z]{20}$", options: .regularExpression) != nil }
    static func bound(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? 25)) }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(1200))); case .number, .bool, .null: return value; default: return .null } }
    static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let object)? = value else { return [:] }; return object }
    static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let array)? = value else { return [] }; return array }
    static func organization(_ value: JSONValue, slug: String) -> JSONRecord {
        let object = object(value); return ["id": scalar(object["id"]), "slug": .string(slug), "name": scalar(object["name"]), "plan": scalar(object["plan"]), "membersReturned": .bool(false), "entitlementsReturned": .bool(false)]
    }
    static func project(_ value: JSONValue) -> JSONRecord {
        let object = object(value);
        return [
            "id": scalar(object["id"]), "ref": scalar(object["ref"]), "name": scalar(object["name"]), "organizationId": scalar(object["organization_id"]), "organizationSlug": scalar(object["organization_slug"]), "cloudProvider": scalar(object["cloud_provider"]), "region": scalar(object["region"]),
            "isBranch": scalar(object["is_branch"]), "status": scalar(object["status"]), "createdAt": scalar(object["created_at"] ?? object["inserted_at"]), "databaseDetailsReturned": .bool(false),
        ]
    }
    public static func fakeOrganization() -> JSONRecord { organization(.object(["id": .string("org_01HRELAY"), "name": .string("Relay"), "plan": .string("pro")]), slug: "relay") }
    public static func fakeProject() -> JSONRecord {
        project(
            .object([
                "id": .string("project-relay-prod"), "ref": .string("abcdefghijklmnopqrst"), "name": .string("Relay Production"), "organization_id": .string("org_01HRELAY"), "organization_slug": .string("relay"), "cloud_provider": .string("AWS"), "region": .string("eu-west-2"),
                "is_branch": .bool(false), "status": .string("ACTIVE_HEALTHY"), "inserted_at": .string("2026-01-01T00:00:00Z"),
            ]))
    }
    static func json(_ value: Any) -> JSONValue {
        if let value = value as? String { return .string(value) }; if let value = value as? Bool { return .bool(value) }; if let value = value as? NSNumber { return .number(value.doubleValue) }; if let value = value as? [String: Any] { return .object(value.mapValues(json)) };
        if let value = value as? [Any] { return .array(value.map(json)) }; return .null
    }
}
