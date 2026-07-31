import Foundation

public protocol LeadIQProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum LeadIQProviderActionSupport {
    static let actions: Set<String> = ["leadiq_account_usage_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(1), "maxResponseBytes": .number(131_072),
            "parameterless": .bool(true), "noCreditOperationOnly": .bool(true),
            "apiKey": .string("railway-encrypted-only"),
            "peopleCompanyData": .string("blocked"),
            "prospectingListsExportsFeedback": .string("blocked"),
            "mcpAdminRaw": .string("blocked"),
        ])
    }
}

public struct FakeLeadIQProviderActionClient: LeadIQProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "leadiq_account_usage_get" else {
            throw LeadIQProviderActionSupport.failure("leadiq_action_not_allowlisted", "LeadIQ V1 permits exactly one bounded no-credit account-usage read.")
        }
        return [
            "plans": .array([.object(["name": .string("synthetic-universal-annual"), "product": .string("Universal"), "status": .string("Active"), "nextBillingPeriod": .string("2027-01-01T00:00:00.000Z")])]),
            "dataHubPlan": .null,
            "universalPlan": .object(["name": .string("synthetic-universal-annual"), "product": .string("Universal"), "status": .string("Active"), "nextBillingPeriod": .string("2027-01-01T00:00:00.000Z"), "available": .number(10_000), "used": .number(1_500)]),
            "fakeAdapter": .bool(true),
        ]
    }
}

public final class RailwayLeadIQProviderActionClient: LeadIQProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw LeadIQProviderActionSupport.failure("leadiq_railway_identity_missing", "LeadIQ Railway execution requires a synchronized connection and agent install.")
        }
        guard request.definition.actionKey == "leadiq_account_usage_get" else {
            throw LeadIQProviderActionSupport.failure("leadiq_action_not_allowlisted", "LeadIQ V1 permits exactly one bounded no-credit account-usage read.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/leadiq/connections/\(remoteConnectionId)/actions/relay_leadiq_get_account_usage", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw LeadIQProviderActionSupport.failure((error?["code"] as? String) ?? "leadiq_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the LeadIQ action.")
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

public struct LeadIQProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any LeadIQProviderActionClient
    public init(client: any LeadIQProviderActionClient = FakeLeadIQProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "leadiq", request.definition.actionKey == "leadiq_account_usage_get", request.definition.kind == .read, request.payload.isEmpty else {
            throw LeadIQProviderActionSupport.failure("leadiq_action_not_allowlisted", "LeadIQ V1 permits exactly one parameterless no-credit account-usage read.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
