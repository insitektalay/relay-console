import Foundation

public protocol SnovProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum SnovProviderActionSupport {
    static let actions: Set<String> = ["snov_email_verification_start", "snov_email_verification_result_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(2), "maxResponseBytes": .number(262_144),
            "oneEmailPerStart": .bool(true), "webhooks": .string("blocked"),
            "clientCredentials": .string("railway-encrypted-only"),
            "discoveryEnrichmentOutreach": .string("blocked"), "rawToolsEnabled": .bool(false),
        ])
    }
}

public struct FakeSnovProviderActionClient: SnovProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "snov_email_verification_start":
            return ["taskHash": .string("synthetic_snov_task_1234567890"), "submitted": .bool(true), "maxEmails": .number(1), "fakeAdapter": .bool(true)]
        case "snov_email_verification_result_get":
            return [
                "taskHash": request.payload["taskHash"] ?? .string("synthetic_snov_task_1234567890"), "completed": .bool(true), "status": .string("valid"), "reason": .null, "doNotProcess": .bool(false),
                "checks": .object(["validFormat": .bool(true), "disposable": .bool(false), "webmail": .bool(false), "gibberish": .bool(false)]), "fakeAdapter": .bool(true),
            ]
        default:
            throw SnovProviderActionSupport.failure("snov_action_not_allowlisted", "Snov.io V1 permits exactly two bounded verification actions.")
        }
    }
}

public final class RailwaySnovProviderActionClient: SnovProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw SnovProviderActionSupport.failure("snov_railway_identity_missing", "Snov.io Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let toolName: String
        switch request.definition.actionKey {
        case "snov_email_verification_start": toolName = "relay_snov_start_email_verification"
        case "snov_email_verification_result_get": toolName = "relay_snov_get_email_verification_result"
        default: throw SnovProviderActionSupport.failure("snov_action_not_allowlisted", "Snov.io V1 permits exactly two bounded verification actions.")
        }
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/snov-io/connections/\(remoteConnectionId)/actions/\(toolName)", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw SnovProviderActionSupport.failure((error?["code"] as? String) ?? "snov_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the Snov.io action.")
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

public struct SnovProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any SnovProviderActionClient
    public init(client: any SnovProviderActionClient = FakeSnovProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "snov-io", SnovProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else {
            throw SnovProviderActionSupport.failure("snov_action_not_allowlisted", "Snov.io V1 permits exactly two bounded verification actions.")
        }
        switch request.definition.actionKey {
        case "snov_email_verification_start":
            guard request.payload.count == 1, let email = request.payload["email"]?.stringValue, email.count <= 254, email.range(of: "^[^\\s@<>]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$", options: .regularExpression) != nil, email.split(separator: "@").last?.contains(".") == true
            else {
                throw SnovProviderActionSupport.failure("snov_payload_invalid", "Snov.io verification start requires only one valid email address.")
            }
        case "snov_email_verification_result_get":
            guard request.payload.count == 1, let taskHash = request.payload["taskHash"]?.stringValue, taskHash.range(of: "^[A-Za-z0-9_-]{16,128}$", options: .regularExpression) != nil else {
                throw SnovProviderActionSupport.failure("snov_payload_invalid", "Snov.io result reads require only one valid task hash.")
            }
        default: break
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}

private extension JSONValue {
    var stringValue: String? { if case .string(let value) = self { return value }; return nil }
}
