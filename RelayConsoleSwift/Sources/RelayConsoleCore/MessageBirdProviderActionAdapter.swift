import Foundation

public protocol MessageBirdProviderActionClient: Sendable { func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }
public enum MessageBirdProviderActionSupport {
    static let actions: Set<String> = ["messagebird_workspace_status_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(
            code: code, message: message,
            detail: [
                "automaticRetry": .bool(false), "automaticPagination": .bool(false), "providerRequestLimit": .number(1), "maxResponseBytes": .number(65_536), "workspaceMetadataOnly": .bool(true), "customerContent": .string("blocked"), "fullAccessKey": .bool(true), "rawToolsEnabled": .bool(false),
            ])
    }
}
public struct FakeMessageBirdProviderActionClient: MessageBirdProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "messagebird_workspace_status_get" else { throw MessageBirdProviderActionSupport.failure("messagebird_action_not_allowlisted", "Bird V1 permits exactly one fixed workspace-status read.") }
        return ["workspaceStatus": .string("active"), "fakeAdapter": .bool(true)]
    }
}
public final class RailwayMessageBirdProviderActionClient: MessageBirdProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw MessageBirdProviderActionSupport.failure("messagebird_railway_identity_missing", "Bird Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/messagebird/connections/\(remoteConnectionId)/actions/relay_messagebird_get_workspace_status", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else { let error = response["error"] as? [String: Any]; throw MessageBirdProviderActionSupport.failure((error?["code"] as? String) ?? "messagebird_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the Bird action.") }
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
public struct MessageBirdProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any MessageBirdProviderActionClient
    public init(client: any MessageBirdProviderActionClient = FakeMessageBirdProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "messagebird", MessageBirdProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else {
            throw MessageBirdProviderActionSupport.failure("messagebird_action_not_allowlisted", "Bird V1 permits exactly one fixed workspace-status read.")
        }
        guard request.payload.isEmpty else {
            throw MessageBirdProviderActionSupport.failure("messagebird_payload_not_supported", "Bird workspace-status reads reject caller-provided organizations, workspaces, channels, contacts, messages, campaigns, access keys, routes, queries, writes, and raw parameters.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
