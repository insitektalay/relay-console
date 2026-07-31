import Foundation

public protocol AircallProviderActionClient: Sendable { func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public enum AircallProviderActionSupport {
    static let actions: Set<String> = ["aircall_company_get", "aircall_numbers_list"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(
            code: code, message: message, detail: ["automaticRetry": .bool(false), "automaticPagination": .bool(false), "providerRequestLimit": .number(3), "maxResponseBytes": .number(524_288), "privacyMasked": .bool(true), "communications": .string("blocked"), "rawToolsEnabled": .bool(false)])
    }
}
public struct FakeAircallProviderActionClient: AircallProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "aircall_company_get": return ["companyName": .string("Relay Company"), "usersCount": .number(4), "numbersCount": .number(2), "verified": .bool(true), "companyBindingVerified": .bool(true), "fakeAdapter": .bool(true)]
        case "aircall_numbers_list": return ["numbers": .array([.object(["name": .string("Support"), "phoneNumber": .string("+••••1234"), "country": .string("GB"), "availabilityStatus": .string("open")])]), "count": .number(1), "truncated": .bool(false), "fakeAdapter": .bool(true)]
        default: throw AircallProviderActionSupport.failure("aircall_action_not_allowlisted", "Aircall V1 permits exactly two fixed company read actions.")
        }
    }
}
public final class RailwayAircallProviderActionClient: AircallProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw AircallProviderActionSupport.failure("aircall_railway_identity_missing", "Aircall Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/aircall/connections/\(remoteConnectionId)/actions/\(try Self.wrapper(request.definition.actionKey))", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else { let error = response["error"] as? [String: Any]; throw AircallProviderActionSupport.failure((error?["code"] as? String) ?? "aircall_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the Aircall action.") }
        var result = Self.jsonRecord(response["data"] as? [String: Any] ?? [:]); result["railwayBrokered"] = .bool(true); result["privacyMasked"] = .bool(true); result["communications"] = .string("blocked"); result["automaticRetry"] = .bool(false); result["automaticPagination"] = .bool(false);
        result["rawToolsEnabled"] = .bool(false); return result
    }
    private static func wrapper(_ action: String) throws -> String {
        switch action {
        case "aircall_company_get": return "relay_aircall_get_company";
        case "aircall_numbers_list": return "relay_aircall_list_numbers";
        default: throw AircallProviderActionSupport.failure("aircall_action_not_allowlisted", "Aircall V1 permits exactly two fixed company read actions.")
        }
    }
    private static func nonEmpty(_ value: String?) -> String? { guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }; return value }
    private static func foundationObject(_ record: JSONRecord) -> [String: Any] { record.mapValues(foundationValue) }
    private static func foundationValue(_ value: JSONValue) -> Any {
        switch value {
        case .string(let v): return v;
        case .number(let v): return v;
        case .bool(let v): return v;
        case .array(let v): return v.map(foundationValue);
        case .object(let v): return foundationObject(v);
        case .null: return NSNull()
        }
    }
    private static func jsonRecord(_ object: [String: Any]) -> JSONRecord { object.mapValues(jsonValue) }
    private static func jsonValue(_ value: Any) -> JSONValue {
        if value is NSNull { return .null }; if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? NSNumber { return .number(v.doubleValue) }; if let v = value as? [String: Any] { return .object(jsonRecord(v)) };
        if let v = value as? [Any] { return .array(v.map(jsonValue)) }; return .null
    }
}
public struct AircallProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any AircallProviderActionClient
    public init(client: any AircallProviderActionClient = FakeAircallProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "aircall", AircallProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else {
            throw AircallProviderActionSupport.failure("aircall_action_not_allowlisted", "Aircall V1 permits exactly two fixed company read actions.")
        }
        guard request.payload.isEmpty else { throw AircallProviderActionSupport.failure("aircall_payload_not_supported", "Aircall reads reject caller-provided company, user, number, call, cursor, communication, write and raw parameters.") }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
