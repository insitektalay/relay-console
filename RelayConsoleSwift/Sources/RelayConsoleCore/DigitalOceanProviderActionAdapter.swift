import Foundation

public struct DigitalOceanProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol DigitalOceanProviderActionClient: Sendable { func executeDigitalOceanAction(request: MarketplaceProviderActionAdapterRequest) throws -> DigitalOceanProviderActionClientResult }

public struct FakeDigitalOceanProviderActionClient: DigitalOceanProviderActionClient {
    public init() {}
    public func executeDigitalOceanAction(request: MarketplaceProviderActionAdapterRequest) throws -> DigitalOceanProviderActionClientResult {
        let fields: JSONRecord
        switch request.definition.actionKey {
        case "digitalocean_project_list": fields = ["semanticReadContract": .string("digitalocean-project-list-v1"), "projects": .array([.object(DigitalOceanProviderActionSupport.fakeProject())]), "returnedCount": .number(1), "more": .bool(false)]
        case "digitalocean_project_get": fields = ["semanticReadContract": .string("digitalocean-project-get-v1"), "project": .object(DigitalOceanProviderActionSupport.fakeProject())]
        case "digitalocean_project_resource_list": fields = ["semanticReadContract": .string("digitalocean-project-resource-list-v1"), "resources": .array([.object(DigitalOceanProviderActionSupport.fakeResource())]), "returnedCount": .number(1), "more": .bool(false)]
        case "digitalocean_selected_resource_get": fields = ["semanticReadContract": .string("digitalocean-selected-resource-get-v1"), "resourceKind": .string("droplet"), "resource": .object(DigitalOceanProviderActionSupport.fakeDroplet()), "projectMembershipVerified": .bool(true)]
        default: throw MarketplaceProviderActionAdapterFailure(code: "digitalocean_action_not_supported", message: "Unsupported DigitalOcean action.")
        }
        return DigitalOceanProviderActionClientResult(result: DigitalOceanProviderActionSupport.base(mode: "fake-digitalocean-v2-api").merging(fields) { _, new in new })
    }
}

public final class LiveDigitalOceanProviderActionClient: DigitalOceanProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService
    public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeDigitalOceanAction(request: MarketplaceProviderActionAdapterRequest) throws -> DigitalOceanProviderActionClientResult {
        let auth = try authorization(request), limit = DigitalOceanProviderActionSupport.bound(request.payload["limit"])
        switch request.definition.actionKey {
        case "digitalocean_project_list":
            let root = try get(auth.token, path: "/v2/projects", query: DigitalOceanProviderActionSupport.page(limit)); let values = (root.vObject?["projects"]?.vArray ?? []).prefix(limit).map(DigitalOceanProviderActionSupport.project)
            return result("digitalocean-project-list-v1", ["projects": .array(values.map(JSONValue.object)), "returnedCount": .number(Double(values.count)), "more": .bool(DigitalOceanProviderActionSupport.more(root)), "automaticPagination": .bool(false)])
        case "digitalocean_project_get":
            let root = try get(auth.token, path: "/v2/projects/" + auth.projectId, query: []); return result("digitalocean-project-get-v1", ["project": .object(DigitalOceanProviderActionSupport.project(root.vObject?["project"] ?? .object([:])))])
        case "digitalocean_project_resource_list":
            let root = try projectResources(auth, limit: limit);
            let values = (root.vObject?["resources"]?.vArray ?? []).prefix(limit).filter {
                let urn = $0.vObject?["urn"]?.string ?? ""; return urn.hasPrefix("do:droplet:") || urn.hasPrefix("do:app:")
            }.map(DigitalOceanProviderActionSupport.resource)
            return result("digitalocean-project-resource-list-v1", ["resources": .array(values.map(JSONValue.object)), "returnedCount": .number(Double(values.count)), "more": .bool(DigitalOceanProviderActionSupport.more(root)), "automaticPagination": .bool(false)])
        case "digitalocean_selected_resource_get":
            let membership = try projectResources(auth, limit: 25), urn = "do:\(auth.resourceKind):\(auth.resourceId)"
            guard (membership.vObject?["resources"]?.vArray ?? []).contains(where: { $0.vObject?["urn"]?.string == urn }) else {
                throw MarketplaceProviderActionAdapterFailure(code: "digitalocean_project_membership_unverified", message: "Selected DigitalOcean resource is not in the bounded selected Project resource page.")
            }
            let root = try get(auth.token, path: auth.resourceKind == "droplet" ? "/v2/droplets/\(auth.resourceId)" : "/v2/apps/\(auth.resourceId)", query: [])
            let mapped = auth.resourceKind == "droplet" ? DigitalOceanProviderActionSupport.droplet(root.vObject?["droplet"] ?? .object([:])) : DigitalOceanProviderActionSupport.app(root.vObject?["app"] ?? .object([:]))
            return result("digitalocean-selected-resource-get-v1", ["resourceKind": .string(auth.resourceKind), "resource": .object(mapped), "projectMembershipVerified": .bool(true)])
        default: throw MarketplaceProviderActionAdapterFailure(code: "digitalocean_live_action_not_supported", message: "Unsupported live DigitalOcean action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, projectId: String, resourceKind: String, resourceId: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "digitalocean", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.health.diagnostics["apiOrigin"]?.string == DigitalOceanProviderActionSupport.apiOrigin, connection.grantedScopes == ProviderConnectionService.digitalOceanReadScopes, let project = connection.health.diagnostics["projectId"]?.string,
            DigitalOceanProviderActionSupport.safeId(project), let kind = connection.health.diagnostics["resourceKind"]?.string, ["droplet", "app"].contains(kind), let resource = connection.health.diagnostics["resourceId"]?.string, DigitalOceanProviderActionSupport.safeId(resource),
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "digitalocean_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "digitalocean_connection_not_ready", message: "DigitalOcean requires a ready exact-Team, Project, selected-resource connection.") }
        return (try secrets.getSecretValue(ref), project, kind, resource)
    }
    private func projectResources(_ auth: (token: String, projectId: String, resourceKind: String, resourceId: String), limit: Int) throws -> JSONValue { try get(auth.token, path: "/v2/projects/\(auth.projectId)/resources", query: DigitalOceanProviderActionSupport.page(limit)) }
    private func result(_ contract: String, _ fields: JSONRecord) -> DigitalOceanProviderActionClientResult {
        DigitalOceanProviderActionClientResult(result: DigitalOceanProviderActionSupport.base(mode: "live-digitalocean-v2-api").merging(["semanticReadContract": .string(contract)].merging(fields) { _, new in new }) { _, new in new })
    }
    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: DigitalOceanProviderActionSupport.apiOrigin + path); components?.queryItems = query.isEmpty ? nil : query
        guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "digitalocean_invalid_url", message: "Could not build an allowlisted DigitalOcean API URL.") }
        var request = URLRequest(url: url); request.timeoutInterval = 20; request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Accept")
        let semaphore = DispatchSemaphore(value: 0); var result: Result<(Data, Int), Error>!
        URLSession.shared.dataTask(with: request) { data, response, error in result = error.map(Result.failure) ?? .success((data ?? Data(), (response as? HTTPURLResponse)?.statusCode ?? 0)); semaphore.signal() }.resume()
        guard semaphore.wait(timeout: .now() + 20) == .success else { throw MarketplaceProviderActionAdapterFailure(code: "digitalocean_timeout", message: "DigitalOcean API request timed out.") }
        let (bytes, status) = try result.get();
        guard (200..<300).contains(status) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: status == 429 ? "digitalocean_rate_limited" : status == 401 ? "digitalocean_access_token_invalid" : status == 403 ? "digitalocean_scope_denied" : status == 404 ? "digitalocean_not_found" : "digitalocean_api_error", message: "DigitalOcean API request failed.",
                providerStatusCode: status)
        }
        return bytes.isEmpty ? .object([:]) : DigitalOceanProviderActionSupport.json(try JSONSerialization.jsonObject(with: bytes))
    }
}

public struct DigitalOceanProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["digitalocean_project_list", "digitalocean_project_get", "digitalocean_project_resource_list", "digitalocean_selected_resource_get"]
    private let client: any DigitalOceanProviderActionClient
    public init(client: any DigitalOceanProviderActionClient = FakeDigitalOceanProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "digitalocean", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "digitalocean_action_not_allowlisted", message: "DigitalOcean V1 permits only four bounded Project/resource reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeDigitalOceanAction(request: request).result, error: nil, redactionStatus: "credentials-environment-logs-console-user-data-excluded")
    }
}

public enum DigitalOceanProviderActionSupport {
    public static let apiOrigin = "https://api.digitalocean.com"
    static func base(mode: String) -> JSONRecord {
        ["provider": .string("digitalocean"), "adapterBoundary": .string("digitalocean-provider-action-adapter"), "clientMode": .string(mode), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("credentials-environment-logs-console-user-data-excluded")]
    }
    public static func safeId(_ value: String) -> Bool { (3...128).contains(value.count) && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" } }
    static func page(_ limit: Int) -> [URLQueryItem] { [URLQueryItem(name: "page", value: "1"), URLQueryItem(name: "per_page", value: String(limit))] }
    static func bound(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? 10)) }
    static func more(_ root: JSONValue) -> Bool { root.vObject?["links"]?.vObject?["pages"]?.vObject?["next"] != nil }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(1200))); case .number, .bool, .null: return value; default: return .null } }
    static func project(_ value: JSONValue) -> JSONRecord {
        let o = value.vObject ?? [:];
        return [
            "id": scalar(o["id"]), "ownerUuid": scalar(o["owner_uuid"]), "ownerId": scalar(o["owner_id"]), "name": scalar(o["name"]), "description": scalar(o["description"]), "purpose": scalar(o["purpose"]), "environment": scalar(o["environment"]), "isDefault": scalar(o["is_default"]),
            "createdAt": scalar(o["created_at"]), "updatedAt": scalar(o["updated_at"]),
        ]
    }
    static func resource(_ value: JSONValue) -> JSONRecord { let o = value.vObject ?? [:]; return ["urn": scalar(o["urn"]), "assignedAt": scalar(o["assigned_at"]), "status": scalar(o["status"])] }
    static func droplet(_ value: JSONValue) -> JSONRecord {
        let o = value.vObject ?? [:], region = o["region"]?.vObject ?? [:], size = o["size"]?.vObject ?? [:], image = o["image"]?.vObject ?? [:], networks = o["networks"]?.vObject ?? [:],
            addresses = ((networks["v4"]?.vArray ?? []) + (networks["v6"]?.vArray ?? [])).prefix(10).map { item -> JSONValue in
                let n = item.vObject ?? [:]; return .object(["ipAddress": scalar(n["ip_address"]), "type": scalar(n["type"]), "netmask": scalar(n["netmask"]), "gateway": scalar(n["gateway"])])
            }
        ;
        return [
            "id": scalar(o["id"]), "name": scalar(o["name"]), "status": scalar(o["status"]), "locked": scalar(o["locked"]), "memoryMb": scalar(o["memory"]), "vcpus": scalar(o["vcpus"]), "diskGb": scalar(o["disk"]), "region": .object(["slug": scalar(region["slug"]), "name": scalar(region["name"])]),
            "size": .object(["slug": scalar(size["slug"]), "description": scalar(size["description"])]), "image": .object(["id": scalar(image["id"]), "name": scalar(image["name"]), "distribution": scalar(image["distribution"])]),
            "tags": .array((o["tags"]?.vArray ?? []).prefix(25).map { scalar($0) }), "networkAddresses": .array(Array(addresses)), "createdAt": scalar(o["created_at"]), "userDataReturned": .bool(false),
        ]
    }
    static func app(_ value: JSONValue) -> JSONRecord {
        let object = value.vObject ?? [:]
        let spec = object["spec"]?.vObject ?? [:]
        let deployment = object["active_deployment"]?.vObject ?? [:]
        let progress = deployment["progress"]?.vObject ?? [:]
        let services = spec["services"]?.vArray ?? []
        let workers = spec["workers"]?.vArray ?? []
        let jobs = spec["jobs"]?.vArray ?? []
        let staticSites = spec["static_sites"]?.vArray ?? []
        let components: [JSONValue] = (services + workers + jobs + staticSites).prefix(25).map { scalar($0.vObject?["name"]) }
        let deploymentSummary: JSONRecord = [
            "id": scalar(deployment["id"]), "phase": scalar(deployment["phase"]), "cause": scalar(deployment["cause"]), "createdAt": scalar(deployment["created_at"]), "updatedAt": scalar(deployment["updated_at"]), "stepsSuccess": scalar(progress["steps_success"]),
            "stepsTotal": scalar(progress["steps_total"]),
        ]
        return [
            "id": scalar(object["id"]), "name": scalar(spec["name"] ?? object["name"]), "region": scalar(spec["region"] ?? object["region"]), "tier": scalar(spec["tier_slug"]), "liveUrl": scalar(object["live_url"]), "createdAt": scalar(object["created_at"]),
            "updatedAt": scalar(object["updated_at"]), "activeDeployment": .object(deploymentSummary), "componentNames": .array(components), "environmentValuesReturned": .bool(false), "logsReturned": .bool(false),
        ]
    }
    public static func fakeProject() -> JSONRecord { project(.object(["id": .string("4de7ac8b-495b-4884-9a69-1050c6793cd6"), "name": .string("Relay production"), "environment": .string("Production"), "is_default": .bool(false)])) }
    public static func fakeResource() -> JSONRecord { resource(.object(["urn": .string("do:droplet:123456"), "status": .string("ok"), "assigned_at": .string("2026-07-11T10:00:00Z")])) }
    public static func fakeDroplet() -> JSONRecord {
        droplet(.object(["id": .number(123456), "name": .string("relay-api"), "status": .string("active"), "region": .object(["slug": .string("lon1")]), "size": .object(["slug": .string("s-2vcpu-4gb")]), "image": .object(["name": .string("Ubuntu 24.04")])]))
    }
    static func json(_ value: Any) -> JSONValue {
        if let x = value as? String { return .string(x) }; if let x = value as? Bool { return .bool(x) }; if let x = value as? NSNumber { return .number(x.doubleValue) }; if let x = value as? [String: Any] { return .object(x.mapValues(json)) };
        if let x = value as? [Any] { return .array(x.map(json)) }; return .null
    }
}

private extension JSONValue { var vObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }; var vArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil } }
