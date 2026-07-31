import Foundation

public protocol HunterProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum HunterProviderActionSupport {
    static let actions: Set<String> = ["hunter_account_usage_get", "hunter_domain_email_count_get", "hunter_email_verify"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(1), "maxResponseBytes": .number(262_144),
            "singleEmailVerification": .bool(true), "apiKey": .string("railway-encrypted-only"),
            "contactDiscoveryEnrichmentOutreach": .string("blocked"), "rawToolsEnabled": .bool(false),
        ])
    }
}

public struct FakeHunterProviderActionClient: HunterProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "hunter_account_usage_get":
            return ["planName": .string("Test"), "planLevel": .number(1), "resetDate": .string("2026-08-01"), "requests": .object(["credits": .object(["used": .number(1), "available": .number(100)])]), "fakeAdapter": .bool(true)]
        case "hunter_domain_email_count_get":
            return ["domain": request.payload["domain"] ?? .string("example.com"), "total": .number(10), "personalEmails": .number(8), "genericEmails": .number(2), "fakeAdapter": .bool(true)]
        case "hunter_email_verify":
            return ["completed": .bool(true), "status": .string("valid"), "score": .number(95), "checks": .object(["regexp": .bool(true), "mxRecords": .bool(true), "smtpCheck": .bool(true)]), "fakeAdapter": .bool(true)]
        default:
            throw HunterProviderActionSupport.failure("hunter_action_not_allowlisted", "Hunter V1 permits exactly three bounded reduced reads.")
        }
    }
}

public final class RailwayHunterProviderActionClient: HunterProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw HunterProviderActionSupport.failure("hunter_railway_identity_missing", "Hunter Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let toolName: String
        switch request.definition.actionKey {
        case "hunter_account_usage_get": toolName = "relay_hunter_get_account_usage"
        case "hunter_domain_email_count_get": toolName = "relay_hunter_get_domain_email_count"
        case "hunter_email_verify": toolName = "relay_hunter_verify_email"
        default: throw HunterProviderActionSupport.failure("hunter_action_not_allowlisted", "Hunter V1 permits exactly three bounded reduced reads.")
        }
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/hunter-io/connections/\(remoteConnectionId)/actions/\(toolName)", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw HunterProviderActionSupport.failure((error?["code"] as? String) ?? "hunter_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the Hunter action.")
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

public struct HunterProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any HunterProviderActionClient
    public init(client: any HunterProviderActionClient = FakeHunterProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "hunter-io", HunterProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else {
            throw HunterProviderActionSupport.failure("hunter_action_not_allowlisted", "Hunter V1 permits exactly three bounded reduced reads.")
        }
        switch request.definition.actionKey {
        case "hunter_account_usage_get":
            guard request.payload.isEmpty else { throw HunterProviderActionSupport.failure("hunter_payload_invalid", "Hunter account usage accepts no input.") }
        case "hunter_domain_email_count_get":
            guard request.payload.count == 1, let domain = request.payload["domain"]?.stringValue?.lowercased(), domain.range(of: "^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}$", options: .regularExpression) != nil else {
                throw HunterProviderActionSupport.failure("hunter_payload_invalid", "Hunter email count requires only one valid domain.")
            }
        case "hunter_email_verify":
            guard request.payload.count == 1, let email = request.payload["email"]?.stringValue, email.count <= 254, email.range(of: "^[^\\s@<>]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$", options: .regularExpression) != nil, email.split(separator: "@").last?.contains(".") == true
            else {
                throw HunterProviderActionSupport.failure("hunter_payload_invalid", "Hunter verification requires only one valid email address.")
            }
        default: break
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}

private extension JSONValue {
    var stringValue: String? { if case .string(let value) = self { return value }; return nil }
}
