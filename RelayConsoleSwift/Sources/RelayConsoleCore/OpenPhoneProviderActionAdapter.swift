import Foundation

public protocol OpenPhoneProviderActionClient: Sendable { func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public enum OpenPhoneProviderActionSupport {
    static let actions: Set<String> = ["openphone_phone_numbers_list"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(
            code: code, message: message,
            detail: [
                "automaticRetry": .bool(false), "automaticPagination": .bool(false), "providerRequestLimit": .number(1), "maxResponseBytes": .number(524_288), "privacyMasked": .bool(true), "fullAccessWorkspaceKey": .bool(true), "communications": .string("blocked"), "rawToolsEnabled": .bool(false),
            ])
    }
}
public struct FakeOpenPhoneProviderActionClient: OpenPhoneProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "openphone_phone_numbers_list" else { throw OpenPhoneProviderActionSupport.failure("openphone_action_not_allowlisted", "Quo V1 permits exactly one fixed phone-number read.") }
        return ["numbers": .array([.object(["name": .string("Support"), "phoneNumber": .string("+••••1234")])]), "count": .number(1), "truncated": .bool(false), "fakeAdapter": .bool(true)]
    }
}
public final class RailwayOpenPhoneProviderActionClient: OpenPhoneProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw OpenPhoneProviderActionSupport.failure("openphone_railway_identity_missing", "Quo Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/openphone/connections/\(remoteConnectionId)/actions/relay_openphone_list_phone_numbers", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else { let error = response["error"] as? [String: Any]; throw OpenPhoneProviderActionSupport.failure((error?["code"] as? String) ?? "openphone_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the Quo action.") }
        return Self.jsonRecord(response["data"] as? [String: Any] ?? [:])
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
public struct OpenPhoneProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any OpenPhoneProviderActionClient
    public init(client: any OpenPhoneProviderActionClient = FakeOpenPhoneProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "openphone", OpenPhoneProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else {
            throw OpenPhoneProviderActionSupport.failure("openphone_action_not_allowlisted", "Quo V1 permits exactly one fixed phone-number read.")
        }
        guard request.payload.isEmpty else { throw OpenPhoneProviderActionSupport.failure("openphone_payload_not_supported", "Quo phone-number reads reject caller-provided user, phone-number, call, message, contact, cursor, write and raw parameters.") }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
