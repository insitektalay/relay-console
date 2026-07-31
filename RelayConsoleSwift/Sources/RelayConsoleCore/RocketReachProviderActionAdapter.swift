import Foundation

public protocol RocketReachProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum RocketReachProviderActionSupport {
    static let actions: Set<String> = ["rocketreach_account_usage_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(1), "maxResponseBytes": .number(131_072),
            "parameterless": .bool(true), "fixedUniversalAccountReadOnly": .bool(true),
            "accountIdentityStripped": .bool(true), "apiKey": .string("railway-encrypted-only"),
            "peopleCompanyData": .string("blocked"),
            "bulkExportsWebhooksCommunity": .string("blocked"),
            "mcpAdminRaw": .string("blocked"),
        ])
    }
}

public struct FakeRocketReachProviderActionClient: RocketReachProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "rocketreach_account_usage_get" else {
            throw RocketReachProviderActionSupport.failure("rocketreach_action_not_allowlisted", "RocketReach V1 permits exactly one bounded account-usage read.")
        }
        return [
            "state": .string("registered"),
            "plan": .object(["name": .string("Synthetic Universal"), "lookupLimit": .number(1_000), "exportLimit": .number(500)]),
            "dailyApiCalls": .number(5), "dailyApiLimit": .string("1000"),
            "creditUsage": .object(["allocated": .number(10_000), "used": .number(1_500), "remaining": .number(8_500), "lastSynced": .string("2026-07-18T10:00:00Z")]),
            "creditUsageByAction": .array([]), "rateLimits": .array([]),
            "fakeAdapter": .bool(true),
        ]
    }
}

public final class RailwayRocketReachProviderActionClient: RocketReachProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw RocketReachProviderActionSupport.failure("rocketreach_railway_identity_missing", "RocketReach Railway execution requires a synchronized connection and agent install.")
        }
        guard request.definition.actionKey == "rocketreach_account_usage_get" else {
            throw RocketReachProviderActionSupport.failure("rocketreach_action_not_allowlisted", "RocketReach V1 permits exactly one bounded account-usage read.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/rocketreach/connections/\(remoteConnectionId)/actions/relay_rocketreach_get_account_usage", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw RocketReachProviderActionSupport.failure((error?["code"] as? String) ?? "rocketreach_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the RocketReach action.")
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

public struct RocketReachProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any RocketReachProviderActionClient
    public init(client: any RocketReachProviderActionClient = FakeRocketReachProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "rocketreach", request.definition.actionKey == "rocketreach_account_usage_get", request.definition.kind == .read, request.payload.isEmpty else {
            throw RocketReachProviderActionSupport.failure("rocketreach_action_not_allowlisted", "RocketReach V1 permits exactly one parameterless account-usage read.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
