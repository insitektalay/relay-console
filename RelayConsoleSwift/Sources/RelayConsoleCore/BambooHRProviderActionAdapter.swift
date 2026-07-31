import Foundation

public struct BambooHRProviderActionClientResult:Sendable{public var result:JSONRecord;public init(result:JSONRecord){self.result=result}}
public protocol BambooHRProviderActionClient:Sendable{func executeBambooHRAction(request:MarketplaceProviderActionAdapterRequest)throws->BambooHRProviderActionClientResult}
public struct FakeBambooHRProviderActionClient: BambooHRProviderActionClient {
    public init() {};
    public func executeBambooHRAction(request: MarketplaceProviderActionAdapterRequest) throws -> BambooHRProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "bamboohr_location_list": fields = ["semanticReadContract": .string("bamboohr-location-list-v1"), "locations": .array([.object(BambooHRProviderActionSupport.fakeLocation())]), "automaticPagination": .bool(false)];
        case "bamboohr_location_get": fields = ["semanticReadContract": .string("bamboohr-location-get-v1"), "location": .object(BambooHRProviderActionSupport.fakeLocation())];
        case "bamboohr_country_list": fields = ["semanticReadContract": .string("bamboohr-country-list-v1"), "countries": .array([.object(BambooHRProviderActionSupport.fakeCountry())]), "automaticPagination": .bool(false)];
        default: throw MarketplaceProviderActionAdapterFailure(code: "bamboohr_action_not_supported", message: "Unsupported BambooHR action.")
        }; return BambooHRProviderActionClientResult(result: BambooHRProviderActionSupport.base("fake-bamboohr-api").merging(fields) { _, new in new })
    }
}
public final class LiveBambooHRProviderActionClient: BambooHRProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets };
    public func executeBambooHRAction(request: MarketplaceProviderActionAdapterRequest) throws -> BambooHRProviderActionClientResult {
        let auth = try authorization(request), limit = BambooHRProviderActionSupport.bound(request.payload["limit"]);
        switch request.definition.actionKey {
        case "bamboohr_location_list":
            let
                root = try get(
                    auth.token, origin: auth.origin, path: "/api/v1/hris/org/locations",
                    query: [URLQueryItem(name: "page", value: "0"), URLQueryItem(name: "pageSize", value: String(limit)), URLQueryItem(name: "select", value: "id,label,archived,manageable,address/timezone,address/remoteLocation,createdAt,archivedAt")]),
                object = BambooHRProviderActionSupport.object(root), values = (BambooHRProviderActionSupport.array(object["data"]).isEmpty ? BambooHRProviderActionSupport.array(root) : BambooHRProviderActionSupport.array(object["data"])).prefix(limit).map(BambooHRProviderActionSupport.location)
            ; return mapped("bamboohr-location-list-v1", ["locations": .array(values.map(JSONValue.object)), "automaticPagination": .bool(false)]);
        case "bamboohr_location_get": return mapped("bamboohr-location-get-v1", ["location": .object(BambooHRProviderActionSupport.location(try get(auth.token, origin: auth.origin, path: "/api/v1/hris/org/locations/" + auth.locationId, query: [])))]);
        case "bamboohr_country_list":
            let root = try get(auth.token, origin: auth.origin, path: "/api/v1/meta/countries/options", query: []), object = BambooHRProviderActionSupport.object(root),
                values = (BambooHRProviderActionSupport.array(object["options"]).isEmpty ? BambooHRProviderActionSupport.array(root) : BambooHRProviderActionSupport.array(object["options"])).prefix(limit).map(BambooHRProviderActionSupport.country)
            ; return mapped("bamboohr-country-list-v1", ["countries": .array(values.map(JSONValue.object)), "automaticPagination": .bool(false)]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "bamboohr_live_action_not_supported", message: "Unsupported live BambooHR action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, origin: String, locationId: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "bamboohr", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.bambooHRReadScopes, let company = connection.health.diagnostics["companyDomain"]?.string, BambooHRProviderActionSupport.safeCompany(company),
            let location = connection.health.diagnostics["locationId"]?.string, BambooHRProviderActionSupport.safeId(location), let secret = connection.credentialRequirements.first(where: { $0.fieldKey == "bamboohr_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "bamboohr_connection_not_ready", message: "BambooHR requires a ready exact-scope company and selected Location connection.") }; return (try secrets.getSecretValue(secret), BambooHRProviderActionSupport.origin(company), location)
    }
    private func get(_ token: String, origin: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: origin + path); components?.queryItems = query.isEmpty ? nil : query; guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "bamboohr_invalid_url", message: "Could not build an allowlisted BambooHR URL.") };
        var request = URLRequest(url: url); request.timeoutInterval = 20; request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Accept"); let semaphore = DispatchSemaphore(value: 0);
        var outcome: Result<(Data, Int), Error>!;
        URLSession.shared.dataTask(with: request) { data, response, error in
            outcome = error.map(Result.failure) ?? .success((data ?? Data(), (response as? HTTPURLResponse)?.statusCode ?? 0)); semaphore.signal()
        }.resume(); guard semaphore.wait(timeout: .now() + 20) == .success else { throw MarketplaceProviderActionAdapterFailure(code: "bamboohr_timeout", message: "BambooHR request timed out.") }; let (bytes, status) = try outcome.get();
        guard (200..<300).contains(status) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: status == 429 || status == 503 ? "bamboohr_rate_limited" : status == 401 ? "bamboohr_access_token_invalid" : status == 403 ? "bamboohr_scope_denied" : status == 404 ? "bamboohr_resource_not_found" : "bamboohr_api_error", message: "BambooHR API request failed.",
                providerStatusCode: status)
        }; return bytes.isEmpty ? .object([:]) : BambooHRProviderActionSupport.json(try JSONSerialization.jsonObject(with: bytes))
    }
private func mapped(_ contract:String,_ fields:JSONRecord)->BambooHRProviderActionClientResult{BambooHRProviderActionClientResult(result:BambooHRProviderActionSupport.base("live-bamboohr-api").merging(["semanticReadContract":.string(contract)].merging(fields){_,new in new}){_,new in new})}}
public struct BambooHRProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["bamboohr_location_list", "bamboohr_location_get", "bamboohr_country_list"]; private let client: any BambooHRProviderActionClient; public init(client: any BambooHRProviderActionClient = FakeBambooHRProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "bamboohr", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "bamboohr_action_not_allowlisted", message: "BambooHR V1 permits only three bounded organizational metadata reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeBambooHRAction(request: request).result, error: nil, redactionStatus: "employee-address-sensitive-data-excluded")
    }
}
public enum BambooHRProviderActionSupport {
    static func base(_ mode: String) -> JSONRecord { ["provider": .string("bamboohr"), "adapterBoundary": .string("bamboohr-provider-action-adapter"), "clientMode": .string(mode), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("employee-address-sensitive-data-excluded")] };
    public static func safeCompany(_ value: String) -> Bool { (1...63).contains(value.count) && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" } && !value.hasPrefix("-") && !value.hasSuffix("-") };
    public static func safeId(_ value: String) -> Bool { (1...128).contains(value.count) && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" } }; public static func origin(_ company: String) -> String { "https://" + company.lowercased() + ".bamboohr.com" };
    static func bound(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? 25)) }; static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let object)? = value else { return [:] }; return object };
    static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let array)? = value else { return [] }; return array };
    static func scalar(_ value: JSONValue?) -> JSONValue {
        guard let value else { return .null };
        switch value {
        case .string(let text): return .string(String(text.prefix(1200)));
        case .number, .bool, .null: return value;
        default: return .null
        }
    };
    static func location(_ value: JSONValue) -> JSONRecord {
        let record = object(value), address = object(record["address"]);
        return [
            "id": scalar(record["id"]), "label": scalar(record["label"]), "archived": scalar(record["archived"]), "manageable": scalar(record["manageable"]), "timezone": scalar(address["timezone"]), "remoteLocation": scalar(address["remoteLocation"]), "createdAt": scalar(record["createdAt"]),
            "archivedAt": scalar(record["archivedAt"]), "addressDetailsReturned": .bool(false), "employeeDataReturned": .bool(false),
        ]
    }; static func country(_ value: JSONValue) -> JSONRecord { let record = object(value); return ["id": scalar(record["id"]), "name": scalar(record["name"]), "isoCode": scalar(record["isoCode"])] };
    public static func fakeLocation() -> JSONRecord {
        location(.object(["id": .string("42"), "label": .string("London"), "archived": .bool(false), "manageable": .bool(true), "address": .object(["timezone": .string("Europe/London"), "remoteLocation": .bool(false)]), "createdAt": .string("2026-01-01T00:00:00Z")]))
    }; public static func fakeCountry() -> JSONRecord { country(.object(["id": .string("1"), "name": .string("United Kingdom"), "isoCode": .string("GB")])) };
    static func json(_ value: Any) -> JSONValue {
        if let value = value as? String { return .string(value) }; if let value = value as? Bool { return .bool(value) }; if let value = value as? NSNumber { return .number(value.doubleValue) }; if let value = value as? [String: Any] { return .object(value.mapValues(json)) };
        if let value = value as? [Any] { return .array(value.map(json)) }; return .null
    }
}
