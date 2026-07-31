import Foundation

public protocol VonageProviderActionClient: Sendable { func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public enum VonageProviderActionSupport {
    static let actions: Set<String> = ["vonage_account_balance_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(
            code: code, message: message,
            detail: [
                "automaticRetry": .bool(false), "automaticPagination": .bool(false), "providerRequestLimit": .number(1), "maxResponseBytes": .number(65_536), "financialReadOnly": .bool(true), "fullAccountSecret": .bool(true), "communications": .string("blocked"), "rawToolsEnabled": .bool(false),
            ])
    }
}
public struct FakeVonageProviderActionClient: VonageProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "vonage_account_balance_get" else { throw VonageProviderActionSupport.failure("vonage_action_not_allowlisted", "Vonage V1 permits exactly one fixed account-balance read.") }
        return ["balanceEUR": .number(10.2812), "autoReloadEnabled": .bool(false), "fakeAdapter": .bool(true)]
    }
}
public final class RailwayVonageProviderActionClient: VonageProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw VonageProviderActionSupport.failure("vonage_railway_identity_missing", "Vonage Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/vonage/connections/\(remoteConnectionId)/actions/relay_vonage_get_account_balance", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else { let error = response["error"] as? [String: Any]; throw VonageProviderActionSupport.failure((error?["code"] as? String) ?? "vonage_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the Vonage action.") }
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
public struct VonageProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any VonageProviderActionClient
    public init(client: any VonageProviderActionClient = FakeVonageProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "vonage", VonageProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else { throw VonageProviderActionSupport.failure("vonage_action_not_allowlisted", "Vonage V1 permits exactly one fixed account-balance read.") }
        guard request.payload.isEmpty else { throw VonageProviderActionSupport.failure("vonage_payload_not_supported", "Vonage balance reads reject caller-provided accounts, products, recipients, messages, calls, applications, secret IDs, routes, queries, writes, and raw parameters.") }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
