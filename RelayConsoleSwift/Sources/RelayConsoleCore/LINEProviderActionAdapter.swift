import Foundation

public protocol LINEProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum LINEProviderActionSupport {
    static let actions: Set<String> = ["line_profile_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(1), "transientNoStore": .bool(true),
            "messagingAuthority": .bool(false), "rawToolsEnabled": .bool(false),
        ])
    }
}

public struct FakeLINEProviderActionClient: LINEProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "line_profile_get" else {
            throw LINEProviderActionSupport.failure("line_action_not_allowlisted", "LINE V1 permits exactly one fixed connected-profile read.")
        }
        return [
            "userId": .string("U0123456789abcdef"), "displayName": .string("Relay User"),
            "pictureUrl": .string("https://profile.line-scdn.net/avatar"),
            "statusMessage": .string("Available"), "subjectBound": .bool(true),
            "fakeAdapter": .bool(true),
        ]
    }
}

public final class RailwayLINEProviderActionClient: LINEProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = nonEmpty(request.auditIdentity.connectionId),
              let agentId = nonEmpty(request.auditIdentity.agentId) else {
            throw LINEProviderActionSupport.failure("line_railway_identity_missing", "LINE Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST",
            relativePath: "connectors/line/connections/\(remoteConnectionId)/actions/relay_line_get_profile",
            body: ["agentId": remoteAgentId, "payload": [String: Any]()])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw LINEProviderActionSupport.failure((error?["code"] as? String) ?? "line_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the LINE profile read.")
        }
        var result = jsonRecord(response["data"] as? [String: Any] ?? [:])
        result["railwayBrokered"] = .bool(true); result["subjectBound"] = .bool(true)
        result["transientNoStore"] = .bool(true); result["messagingAuthority"] = .bool(false)
        result["automaticRetry"] = .bool(false); result["automaticPagination"] = .bool(false)
        result["rawToolsEnabled"] = .bool(false)
        return result
    }
    private func nonEmpty(_ value: String?) -> String? { guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }; return value }
    private func jsonRecord(_ object: [String: Any]) -> JSONRecord { object.mapValues(jsonValue) }
    private func jsonValue(_ value: Any) -> JSONValue {
        if value is NSNull { return .null }; if let value = value as? String { return .string(value) }; if let value = value as? Bool { return .bool(value) }; if let value = value as? NSNumber { return .number(value.doubleValue) };
        if let value = value as? [String: Any] { return .object(jsonRecord(value)) }; if let value = value as? [Any] { return .array(value.map(jsonValue)) }; return .null
    }
}

public struct LINEProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any LINEProviderActionClient
    public init(client: any LINEProviderActionClient = FakeLINEProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "line", LINEProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else {
            throw LINEProviderActionSupport.failure("line_action_not_allowlisted", "LINE V1 permits exactly one fixed connected-profile read.")
        }
        guard request.payload.isEmpty else {
            throw LINEProviderActionSupport.failure("line_payload_not_supported", "LINE profile reads reject user IDs, message, bot, channel, cursor, scope, write and raw parameters.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
