import Foundation

public protocol DialpadProviderActionClient: Sendable { func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public enum DialpadProviderActionSupport {
    static let actions: Set<String> = ["dialpad_user_get", "dialpad_caller_id_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(
            code: code, message: message, detail: ["automaticRetry": .bool(false), "automaticPagination": .bool(false), "providerRequestLimit": .number(1), "maxResponseBytes": .number(524_288), "forwardingNumbers": .string("blocked"), "privacyMasked": .bool(true), "rawToolsEnabled": .bool(false)])
    }
}
public struct FakeDialpadProviderActionClient: DialpadProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "dialpad_user_get": return ["displayName": .string("Relay User"), "verified": .bool(true), "userBindingVerified": .bool(true), "fakeAdapter": .bool(true)]
        case "dialpad_caller_id_get":
            return ["callerIds": .array([.object(["label": .string("Primary phone"), "type": .string("primary"), "phoneNumber": .string("+••••1234"), "active": .bool(true)])]), "count": .number(1), "truncated": .bool(false), "activeCallerIdBlocked": .bool(false), "fakeAdapter": .bool(true)]
        default: throw DialpadProviderActionSupport.failure("dialpad_action_not_allowlisted", "Dialpad V1 permits exactly two fixed own-user read actions.")
        }
    }
}
public final class RailwayDialpadProviderActionClient: DialpadProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw DialpadProviderActionSupport.failure("dialpad_railway_identity_missing", "Dialpad Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/dialpad/connections/\(remoteConnectionId)/actions/\(try Self.wrapper(request.definition.actionKey))", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else { let error = response["error"] as? [String: Any]; throw DialpadProviderActionSupport.failure((error?["code"] as? String) ?? "dialpad_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the Dialpad action.") }
        var result = Self.jsonRecord(response["data"] as? [String: Any] ?? [:]); result["railwayBrokered"] = .bool(true); result["privacyMasked"] = .bool(true); result["forwardingNumbers"] = .string("blocked"); result["automaticRetry"] = .bool(false); result["automaticPagination"] = .bool(false);
        result["rawToolsEnabled"] = .bool(false); return result
    }
    private static func wrapper(_ action: String) throws -> String {
        switch action {
        case "dialpad_user_get": return "relay_dialpad_get_user";
        case "dialpad_caller_id_get": return "relay_dialpad_get_caller_id";
        default: throw DialpadProviderActionSupport.failure("dialpad_action_not_allowlisted", "Dialpad V1 permits exactly two fixed own-user read actions.")
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
public struct DialpadProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any DialpadProviderActionClient
    public init(client: any DialpadProviderActionClient = FakeDialpadProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "dialpad", DialpadProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else {
            throw DialpadProviderActionSupport.failure("dialpad_action_not_allowlisted", "Dialpad V1 permits exactly two fixed own-user read actions.")
        }
        guard request.payload.isEmpty else { throw DialpadProviderActionSupport.failure("dialpad_payload_not_supported", "Dialpad own-user reads reject caller-provided user, company, office, call, cursor, communication, write and raw parameters.") }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
