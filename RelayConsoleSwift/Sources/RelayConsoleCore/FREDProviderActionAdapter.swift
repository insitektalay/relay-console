import Foundation

public protocol FREDProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum FREDProviderActionSupport {
    static let actions: Set<String> = ["fred_series_search", "fred_series_observations_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(1), "maxResponseBytes": .number(262_144),
            "maxSeriesResults": .number(10), "maxObservationResults": .number(25),
            "publicEconomicDataReadOnly": .bool(true), "apiKey": .string("railway-encrypted-only"),
            "bulkVintageTransforms": .string("blocked"), "rawToolsEnabled": .bool(false),
        ])
    }
}

public struct FakeFREDProviderActionClient: FREDProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "fred_series_search":
            return [
                "query": request.payload["query"] ?? .string("inflation"), "series": .array([.object(["id": .string("CPIAUCSL"), "title": .string("Consumer Price Index for All Urban Consumers"), "frequency": .string("Monthly"), "units": .string("Index 1982-1984=100"), "popularity": .number(95)])]),
                "fakeAdapter": .bool(true),
            ]
        case "fred_series_observations_get":
            return ["seriesId": request.payload["seriesId"] ?? .string("CPIAUCSL"), "observations": .array([.object(["date": .string("2026-01-01"), "value": .string("325.0")])]), "fakeAdapter": .bool(true)]
        default:
            throw FREDProviderActionSupport.failure("fred_action_not_allowlisted", "FRED V1 permits exactly two fixed public economic-data reads.")
        }
    }
}

public final class RailwayFREDProviderActionClient: FREDProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw FREDProviderActionSupport.failure("fred_railway_identity_missing", "FRED Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let toolName: String
        switch request.definition.actionKey {
        case "fred_series_search": toolName = "relay_fred_search_series"
        case "fred_series_observations_get": toolName = "relay_fred_get_series_observations"
        default: throw FREDProviderActionSupport.failure("fred_action_not_allowlisted", "FRED V1 permits exactly two fixed public economic-data reads.")
        }
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/fred/connections/\(remoteConnectionId)/actions/\(toolName)", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw FREDProviderActionSupport.failure((error?["code"] as? String) ?? "fred_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the FRED action.")
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

public struct FREDProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any FREDProviderActionClient
    public init(client: any FREDProviderActionClient = FakeFREDProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "fred", FREDProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else {
            throw FREDProviderActionSupport.failure("fred_action_not_allowlisted", "FRED V1 permits exactly two fixed public economic-data reads.")
        }
        switch request.definition.actionKey {
        case "fred_series_search":
            guard request.payload.count == 1, let query = request.payload["query"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines), query.count >= 2, query.count <= 80 else {
                throw FREDProviderActionSupport.failure("fred_payload_invalid", "FRED series search requires only a 2-to-80-character query.")
            }
        case "fred_series_observations_get":
            guard request.payload.keys.allSatisfy({ ["seriesId", "limit"].contains($0) }), let seriesId = request.payload["seriesId"]?.stringValue, seriesId.range(of: "^[A-Za-z0-9._-]{1,64}$", options: .regularExpression) != nil else {
                throw FREDProviderActionSupport.failure("fred_payload_invalid", "FRED observations require only a valid seriesId and optional limit from 1 to 25.")
            }
            if let limit = request.payload["limit"]?.numberValue, limit.rounded() != limit || limit < 1 || limit > 25 {
                throw FREDProviderActionSupport.failure("fred_payload_invalid", "FRED observation limit must be an integer from 1 to 25.")
            }
        default: break
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}

private extension JSONValue {
    var stringValue: String? { if case .string(let value) = self { return value }; return nil }
    var numberValue: Double? { if case .number(let value) = self { return value }; return nil }
}
