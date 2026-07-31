import Foundation

public protocol WizaProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum WizaProviderActionSupport {
    static let actions: Set<String> = ["wiza_credit_balances_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(1), "maxResponseBytes": .number(65_536),
            "parameterless": .bool(true), "fixedCreditBalancesReadOnly": .bool(true),
            "apiKey": .string("railway-encrypted-only"),
            "peopleCompanyContactData": .string("blocked"),
            "bulkListsWebhooksExports": .string("blocked"),
            "adminFinancialRaw": .string("blocked"),
        ])
    }
}

public struct FakeWizaProviderActionClient: WizaProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "wiza_credit_balances_get" else {
            throw WizaProviderActionSupport.failure("wiza_action_not_allowlisted", "Wiza V1 permits exactly one bounded credit-balances read.")
        }
        return [
            "emailCredits": .string("unlimited"), "phoneCredits": .number(100),
            "exportCredits": .number(0), "apiCredits": .number(250),
            "fakeAdapter": .bool(true),
        ]
    }
}

public final class RailwayWizaProviderActionClient: WizaProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw WizaProviderActionSupport.failure("wiza_railway_identity_missing", "Wiza Railway execution requires a synchronized connection and agent install.")
        }
        guard request.definition.actionKey == "wiza_credit_balances_get" else {
            throw WizaProviderActionSupport.failure("wiza_action_not_allowlisted", "Wiza V1 permits exactly one bounded credit-balances read.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/wiza/connections/\(remoteConnectionId)/actions/relay_wiza_get_credit_balances", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw WizaProviderActionSupport.failure((error?["code"] as? String) ?? "wiza_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the Wiza action.")
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

public struct WizaProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any WizaProviderActionClient
    public init(client: any WizaProviderActionClient = FakeWizaProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "wiza", request.definition.actionKey == "wiza_credit_balances_get", request.definition.kind == .read, request.payload.isEmpty else {
            throw WizaProviderActionSupport.failure("wiza_action_not_allowlisted", "Wiza V1 permits exactly one parameterless credit-balances read.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
