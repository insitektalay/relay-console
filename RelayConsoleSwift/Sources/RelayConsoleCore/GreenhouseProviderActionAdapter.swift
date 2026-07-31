import Foundation
public struct GreenhouseProviderActionClientResult:Sendable{public var result:JSONRecord;public init(result:JSONRecord){self.result=result}}
public protocol GreenhouseProviderActionClient:Sendable{func executeGreenhouseAction(request:MarketplaceProviderActionAdapterRequest)throws->GreenhouseProviderActionClientResult}
public struct FakeGreenhouseProviderActionClient: GreenhouseProviderActionClient {
    public init() {};
    public func executeGreenhouseAction(request: MarketplaceProviderActionAdapterRequest) throws -> GreenhouseProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "greenhouse_job_list": fields = ["semanticReadContract": .string("greenhouse-job-list-v1"), "jobs": .array([.object(GreenhouseProviderActionSupport.fakeJob())]), "automaticPagination": .bool(false)];
        case "greenhouse_office_list": fields = ["semanticReadContract": .string("greenhouse-office-list-v1"), "offices": .array([.object(GreenhouseProviderActionSupport.fakeOffice())]), "automaticPagination": .bool(false)];
        case "greenhouse_department_list": fields = ["semanticReadContract": .string("greenhouse-department-list-v1"), "departments": .array([.object(GreenhouseProviderActionSupport.fakeDepartment())]), "automaticPagination": .bool(false)];
        default: throw MarketplaceProviderActionAdapterFailure(code: "greenhouse_action_not_supported", message: "Unsupported Greenhouse action.")
        }; return GreenhouseProviderActionClientResult(result: GreenhouseProviderActionSupport.base("fake-harvest-v3").merging(fields) { _, new in new })
    }
}
public final class LiveGreenhouseProviderActionClient: GreenhouseProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets };
    public func executeGreenhouseAction(request: MarketplaceProviderActionAdapterRequest) throws -> GreenhouseProviderActionClientResult {
        let token = try authorization(request), limit = GreenhouseProviderActionSupport.bound(request.payload["limit"]), key = request.definition.actionKey, path = key == "greenhouse_job_list" ? "/v3/jobs" : key == "greenhouse_office_list" ? "/v3/offices" : "/v3/departments",
            root = try get(token, path: path, limit: limit), object = GreenhouseProviderActionSupport.object(root),
            values = (GreenhouseProviderActionSupport.array(object["data"]).isEmpty ? GreenhouseProviderActionSupport.array(root) : GreenhouseProviderActionSupport.array(object["data"])).prefix(limit)
        ;
        switch key {
        case "greenhouse_job_list": return mapped("greenhouse-job-list-v1", ["jobs": .array(values.map { .object(GreenhouseProviderActionSupport.job($0)) }), "automaticPagination": .bool(false)]);
        case "greenhouse_office_list": return mapped("greenhouse-office-list-v1", ["offices": .array(values.map { .object(GreenhouseProviderActionSupport.office($0)) }), "automaticPagination": .bool(false)]);
        case "greenhouse_department_list": return mapped("greenhouse-department-list-v1", ["departments": .array(values.map { .object(GreenhouseProviderActionSupport.department($0)) }), "automaticPagination": .bool(false)]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "greenhouse_live_action_not_supported", message: "Unsupported live Greenhouse action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "greenhouse", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.greenhouseReadScopes, connection.health.diagnostics["apiOrigin"]?.string == GreenhouseProviderActionSupport.apiOrigin,
            let secret = connection.credentialRequirements.first(where: { $0.fieldKey == "greenhouse_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "greenhouse_connection_not_ready", message: "Greenhouse requires a ready exact-scope Harvest v3 connection.") }; return try secrets.getSecretValue(secret)
    }
    private func get(_ token: String, path: String, limit: Int) throws -> JSONValue {
        var components = URLComponents(string: GreenhouseProviderActionSupport.apiOrigin + path); components?.queryItems = [URLQueryItem(name: "per_page", value: String(limit))];
        guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "greenhouse_invalid_url", message: "Could not build allowlisted Harvest v3 URL.") }; var request = URLRequest(url: url); request.timeoutInterval = 20;
        request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Accept"); let semaphore = DispatchSemaphore(value: 0); var outcome: Result<(Data, Int), Error>!;
        URLSession.shared.dataTask(with: request) { data, response, error in
            outcome = error.map(Result.failure) ?? .success((data ?? Data(), (response as? HTTPURLResponse)?.statusCode ?? 0)); semaphore.signal()
        }.resume(); guard semaphore.wait(timeout: .now() + 20) == .success else { throw MarketplaceProviderActionAdapterFailure(code: "greenhouse_timeout", message: "Greenhouse request timed out.") }; let (bytes, status) = try outcome.get();
        guard (200..<300).contains(status) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: status == 429 ? "greenhouse_rate_limited" : status == 401 ? "greenhouse_access_token_invalid" : status == 403 ? "greenhouse_scope_or_admin_denied" : status == 404 ? "greenhouse_resource_not_found" : "greenhouse_api_error", message: "Greenhouse Harvest v3 request failed.",
                providerStatusCode: status)
        }; return bytes.isEmpty ? .object([:]) : GreenhouseProviderActionSupport.json(try JSONSerialization.jsonObject(with: bytes))
    }
private func mapped(_ contract:String,_ fields:JSONRecord)->GreenhouseProviderActionClientResult{GreenhouseProviderActionClientResult(result:GreenhouseProviderActionSupport.base("live-harvest-v3").merging(["semanticReadContract":.string(contract)].merging(fields){_,new in new}){_,new in new})}}
public struct GreenhouseProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["greenhouse_job_list", "greenhouse_office_list", "greenhouse_department_list"]; private let client: any GreenhouseProviderActionClient;
    public init(client: any GreenhouseProviderActionClient = FakeGreenhouseProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "greenhouse", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "greenhouse_action_not_allowlisted", message: "Greenhouse V1 permits only three bounded recruiting-structure reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeGreenhouseAction(request: request).result, error: nil, redactionStatus: "candidate-application-interview-user-content-excluded")
    }
}
public enum GreenhouseProviderActionSupport {
    public static let apiOrigin = "https://harvest.greenhouse.io"; public static func safeId(_ value: String) -> Bool { (1...128).contains(value.count) && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" } };
    static func base(_ mode: String) -> JSONRecord {
        ["provider": .string("greenhouse"), "adapterBoundary": .string("greenhouse-provider-action-adapter"), "clientMode": .string(mode), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("candidate-application-interview-user-content-excluded")]
    }; static func bound(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? 25)) }; static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let value)? = value else { return [:] }; return value };
    static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let value)? = value else { return [] }; return value };
    static func scalar(_ value: JSONValue?) -> JSONValue {
        guard let value else { return .null };
        switch value {
        case .string(let text): return .string(String(text.prefix(1200)));
        case .number, .bool, .null: return value;
        default: return .null
        }
    };
    static func ids(_ value: JSONValue?) -> JSONValue {
        let values = array(value).prefix(25).compactMap { element -> JSONValue? in
            if case .object(let object) = element { return scalar(object["id"]) }; return scalar(element)
        }; return .array(values)
    };
    static func job(_ value: JSONValue) -> JSONRecord {
        let record = object(value);
        return [
            "id": scalar(record["id"]), "name": scalar(record["name"]), "status": scalar(record["status"]), "requisitionId": scalar(record["requisition_id"]), "departmentId": scalar(record["department_id"]), "officeIds": ids(record["office_ids"] ?? record["offices"]),
            "confidential": scalar(record["confidential"]), "openedAt": scalar(record["opened_at"]), "closedAt": scalar(record["closed_at"]), "createdAt": scalar(record["created_at"]), "updatedAt": scalar(record["updated_at"]), "hiringTeamReturned": .bool(false), "notesReturned": .bool(false),
            "candidateDataReturned": .bool(false),
        ]
    };
    static func office(_ value: JSONValue) -> JSONRecord {
        let record = object(value);
        return [
            "id": scalar(record["id"]), "name": scalar(record["name"]), "parentId": scalar(record["parent_id"]), "externalId": scalar(record["external_id"]), "createdAt": scalar(record["created_at"]), "updatedAt": scalar(record["updated_at"]), "physicalLocationReturned": .bool(false),
            "contactUserReturned": .bool(false),
        ]
    };
    static func department(_ value: JSONValue) -> JSONRecord {
        let record = object(value); return ["id": scalar(record["id"]), "name": scalar(record["name"]), "parentId": scalar(record["parent_id"]), "externalId": scalar(record["external_id"]), "createdAt": scalar(record["created_at"]), "updatedAt": scalar(record["updated_at"])]
    };
    public static func fakeJob() -> JSONRecord {
        job(.object(["id": .number(101), "name": .string("Platform Engineer"), "status": .string("open"), "requisition_id": .string("ENG-101"), "department_id": .number(10), "office_ids": .array([.number(20)]), "confidential": .bool(false), "opened_at": .string("2026-01-01T00:00:00Z")]))
    }; public static func fakeOffice() -> JSONRecord { office(.object(["id": .number(20), "name": .string("London"), "parent_id": .null, "external_id": .string("LDN")])) };
    public static func fakeDepartment() -> JSONRecord { department(.object(["id": .number(10), "name": .string("Engineering"), "parent_id": .null, "external_id": .string("ENG")])) };
    static func json(_ value: Any) -> JSONValue {
        if let value = value as? String { return .string(value) }; if let value = value as? Bool { return .bool(value) }; if let value = value as? NSNumber { return .number(value.doubleValue) }; if let value = value as? [String: Any] { return .object(value.mapValues(json)) };
        if let value = value as? [Any] { return .array(value.map(json)) }; return .null
    }
}
