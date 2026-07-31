import Foundation

public protocol RingCentralProviderActionClient: Sendable { func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }

public enum RingCentralProviderActionSupport {
    static let actions: Set<String> = ["ringcentral_extension_get", "ringcentral_call_log_list", "ringcentral_call_log_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(
            code: code, message: message, detail: ["automaticRetry": .bool(false), "automaticPagination": .bool(false), "providerRequestLimit": .number(2), "maxResponseBytes": .number(524_288), "firstTenRecentRecordsOnly": .bool(true), "privacyMasked": .bool(true), "rawToolsEnabled": .bool(false)])
    }
}

public struct FakeRingCentralProviderActionClient: RingCentralProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "ringcentral_extension_get":
            return ["displayName": .string("Relay User"), "verified": .bool(true), "extensionBindingVerified": .bool(true), "fakeAdapter": .bool(true)]
        case "ringcentral_call_log_list":
            return ["records": .array([.object(Self.record())]), "count": .number(1), "truncated": .bool(false), "fakeAdapter": .bool(true)]
        case "ringcentral_call_log_get":
            return Self.record(id: try Self.recordID(request.payload["recordId"])).merging(["fakeAdapter": .bool(true), "providerRequestCount": .number(2)]) { _, new in new }
        default: throw RingCentralProviderActionSupport.failure("ringcentral_action_not_allowlisted", "RingCentral V1 permits exactly three fixed read actions.")
        }
    }
    static func recordID(_ value: JSONValue?) throws -> String {
        guard let id = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty, id.count <= 128,
              id.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
            throw RingCentralProviderActionSupport.failure("ringcentral_record_id_invalid", "recordId must be a safe RingCentral call-log record ID.")
        }
        return id
    }
    private static func record(id: String = "call_101") -> JSONRecord {[
        "id": .string(id), "startTime": .string("2026-07-12T20:00:00Z"), "duration": .number(120),
        "type": .string("Voice"), "direction": .string("Inbound"), "result": .string("Accepted"),
        "from": .object(["phoneNumber": .string("+••••1234")]),
        "to": .object(["phoneNumber": .string("+••••1001")]) ]}
}

public final class RailwayRingCentralProviderActionClient: RingCentralProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw RingCentralProviderActionSupport.failure("ringcentral_railway_identity_missing", "RingCentral Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/ringcentral/connections/\(remoteConnectionId)/actions/\(try Self.wrapper(request.definition.actionKey))", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else { let error = response["error"] as? [String: Any]; throw RingCentralProviderActionSupport.failure((error?["code"] as? String) ?? "ringcentral_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the RingCentral action.") }
        var result = Self.jsonRecord(response["data"] as? [String: Any] ?? [:]); result["railwayBrokered"] = .bool(true); result["privacyMasked"] = .bool(true); result["firstTenRecentRecordsOnly"] = .bool(true); result["automaticRetry"] = .bool(false); result["automaticPagination"] = .bool(false);
        result["rawToolsEnabled"] = .bool(false); return result
    }
    private static func wrapper(_ action: String) throws -> String {
        switch action {
        case "ringcentral_extension_get": return "relay_ringcentral_get_extension";
        case "ringcentral_call_log_list": return "relay_ringcentral_list_call_log";
        case "ringcentral_call_log_get": return "relay_ringcentral_get_call_log_record";
        default: throw RingCentralProviderActionSupport.failure("ringcentral_action_not_allowlisted", "RingCentral V1 permits exactly three fixed read actions.")
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

public struct RingCentralProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any RingCentralProviderActionClient
    public init(client: any RingCentralProviderActionClient = FakeRingCentralProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "ringcentral", RingCentralProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else {
            throw RingCentralProviderActionSupport.failure("ringcentral_action_not_allowlisted", "RingCentral V1 permits exactly three fixed read actions.")
        }
        let allowed: Set<String> = request.definition.actionKey == "ringcentral_call_log_list" ? ["limit"] : request.definition.actionKey == "ringcentral_call_log_get" ? ["recordId"] : []
        guard Set(request.payload.keys).isSubset(of: allowed) else { throw RingCentralProviderActionSupport.failure("ringcentral_payload_not_supported", "RingCentral rejects account, extension, identity, recording, message, detailed-leg, page, filter, write and raw parameters.") }
        if request.definition.actionKey == "ringcentral_call_log_get" { _ = try FakeRingCentralProviderActionClient.recordID(request.payload["recordId"]) }
        if let value = request.payload["limit"] { guard case .number(let limit) = value, limit.rounded() == limit, (1...10).contains(Int(limit)) else { throw RingCentralProviderActionSupport.failure("ringcentral_limit_invalid", "limit must be an integer from 1 through 10.") } }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
