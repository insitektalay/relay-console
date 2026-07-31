import Foundation

public protocol ApolloGraphOSProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum ApolloGraphOSProviderActionSupport {
    static let actions: Set<String> = ["apollo_graphos_graph_artifact_get", "apollo_graphos_launch_status_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(2), "maxResponseBytes": .number(262_144),
            "exactGraphVariantBinding": .bool(true), "graphApiKey": .string("railway-encrypted-only"),
            "schemasOperationsTelemetryMutations": .string("blocked"), "rawGraphQL": .bool(false),
        ])
    }
}

public struct FakeApolloGraphOSProviderActionClient: ApolloGraphOSProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "apollo_graphos_graph_artifact_get":
            return ["graphId": .string("relay-test"), "variant": .string("current"), "repository": .string("relay-test"), "tag": .string("current"), "digest": .string("sha256:example"), "uri": .string("oci://example.invalid/relay-test@sha256:example"), "fakeAdapter": .bool(true)]
        case "apollo_graphos_launch_status_get":
            return ["graphId": .string("relay-test"), "variant": .string("current"), "launchId": request.payload["launchId"] ?? .string("launch_1"), "status": .string("COMPLETED"), "fakeAdapter": .bool(true)]
        default:
            throw ApolloGraphOSProviderActionSupport.failure("apollo_graphos_action_not_allowlisted", "Apollo GraphOS V1 permits exactly two fixed metadata reads.")
        }
    }
}

public final class RailwayApolloGraphOSProviderActionClient: ApolloGraphOSProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw ApolloGraphOSProviderActionSupport.failure("apollo_graphos_railway_identity_missing", "Apollo GraphOS Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let toolName: String
        switch request.definition.actionKey {
        case "apollo_graphos_graph_artifact_get": toolName = "relay_apollo_graphos_get_graph_artifact"
        case "apollo_graphos_launch_status_get": toolName = "relay_apollo_graphos_get_launch_status"
        default: throw ApolloGraphOSProviderActionSupport.failure("apollo_graphos_action_not_allowlisted", "Apollo GraphOS V1 permits exactly two fixed metadata reads.")
        }
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/apollo-graphql-studio/connections/\(remoteConnectionId)/actions/\(toolName)", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw ApolloGraphOSProviderActionSupport.failure((error?["code"] as? String) ?? "apollo_graphos_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the Apollo GraphOS action.")
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

public struct ApolloGraphOSProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any ApolloGraphOSProviderActionClient
    public init(client: any ApolloGraphOSProviderActionClient = FakeApolloGraphOSProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "apollo-graphql-studio", ApolloGraphOSProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else {
            throw ApolloGraphOSProviderActionSupport.failure("apollo_graphos_action_not_allowlisted", "Apollo GraphOS V1 permits exactly two fixed metadata reads.")
        }
        switch request.definition.actionKey {
        case "apollo_graphos_graph_artifact_get":
            guard request.payload.isEmpty else { throw ApolloGraphOSProviderActionSupport.failure("apollo_graphos_payload_invalid", "Graph artifact metadata accepts no input.") }
        case "apollo_graphos_launch_status_get":
            guard request.payload.count == 1, let launchId = request.payload["launchId"]?.stringValue, launchId.range(of: "^[A-Za-z0-9._:-]{1,160}$", options: .regularExpression) != nil else {
                throw ApolloGraphOSProviderActionSupport.failure("apollo_graphos_payload_invalid", "Launch status requires only one valid launchId.")
            }
        default: break
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}

private extension JSONValue {
    var stringValue: String? { if case .string(let value) = self { return value }; return nil }
}
