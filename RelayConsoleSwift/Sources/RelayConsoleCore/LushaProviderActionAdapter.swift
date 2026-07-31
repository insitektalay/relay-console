import Foundation

public protocol LushaProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum LushaProviderActionSupport {
    static let actions: Set<String> = ["lusha_account_usage_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(1), "providerRequestsPerMinute": .number(5),
            "maxResponseBytes": .number(262_144), "parameterless": .bool(true),
            "apiKey": .string("railway-encrypted-only"),
            "businessProfileData": .string("blocked"),
            "prospectingSignalsAutomation": .string("blocked"),
            "webhooksAdminMcpRaw": .string("blocked"),
        ])
    }
}

public struct FakeLushaProviderActionClient: LushaProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "lusha_account_usage_get" else {
            throw LushaProviderActionSupport.failure("lusha_action_not_allowlisted", "Lusha V1 permits exactly one bounded account-usage read.")
        }
        return [
            "credits": .object(["total": .number(10_000), "used": .number(1_500), "remaining": .number(8_500)]),
            "rateLimits": .object(["minute": .object(["limit": .number(5), "remaining": .number(4)])]),
            "plan": .object(["category": .string("synthetic-professional"), "renewalType": .string("annual"), "startDate": .string("2026-01-01T00:00:00.000Z"), "endDate": .string("2027-01-01T00:00:00.000Z")]),
            "pricing": .object(["api_search": .object(["credits": .number(1)])]),
            "fakeAdapter": .bool(true),
        ]
    }
}

public final class RailwayLushaProviderActionClient: LushaProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw LushaProviderActionSupport.failure("lusha_railway_identity_missing", "Lusha Railway execution requires a synchronized connection and agent install.")
        }
        guard request.definition.actionKey == "lusha_account_usage_get" else {
            throw LushaProviderActionSupport.failure("lusha_action_not_allowlisted", "Lusha V1 permits exactly one bounded account-usage read.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/lusha/connections/\(remoteConnectionId)/actions/relay_lusha_get_account_usage", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw LushaProviderActionSupport.failure((error?["code"] as? String) ?? "lusha_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the Lusha action.")
        }
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

public struct LushaProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any LushaProviderActionClient
    public init(client: any LushaProviderActionClient = FakeLushaProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "lusha", request.definition.actionKey == "lusha_account_usage_get", request.definition.kind == .read, request.payload.isEmpty else {
            throw LushaProviderActionSupport.failure("lusha_action_not_allowlisted", "Lusha V1 permits exactly one parameterless account-usage read.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
