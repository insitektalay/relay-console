import Foundation

public protocol HopinProviderActionClient: Sendable { func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }

public enum HopinProviderActionSupport {
    static let actions: Set<String> = ["hopin_organization_get", "hopin_organization_events_list", "hopin_event_get", "hopin_event_schedule_items_list"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: ["automaticRetry": .bool(false), "automaticPagination": .bool(false), "providerRequestLimit": .number(2), "rawToolsEnabled": .bool(false)])
    }
}

public struct FakeHopinProviderActionClient: HopinProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "hopin_organization_get": return ["name": .string("Relay Events"), "verified": .bool(true), "organizationBindingVerified": .bool(true), "fakeAdapter": .bool(true), "providerRequestCount": .number(1)]
        case "hopin_organization_events_list": return ["events": .array([.object(Self.event())]), "truncated": .bool(false), "fakeAdapter": .bool(true), "providerRequestCount": .number(1)]
        case "hopin_event_get": return Self.event(id: try Self.id(request.payload["eventId"], field: "eventId")).merging(["fakeAdapter": .bool(true), "providerRequestCount": .number(2)]) { _, new in new }
        case "hopin_event_schedule_items_list":
            _ = try Self.id(request.payload["eventId"], field: "eventId")
            return [
                "scheduleItems": .array([
                    .object(["scheduleItemId": .string("schedule-1"), "name": .string("Opening"), "description": .string("Welcome"), "area": .string("stage"), "areaName": .string("Main Stage"), "timeStart": .string("2026-08-01T09:00:00Z"), "timeEnd": .string("2026-08-01T10:00:00Z")])
                ]), "truncated": .bool(false), "fakeAdapter": .bool(true), "providerRequestCount": .number(2),
            ]
        default: throw HopinProviderActionSupport.failure("hopin_action_not_allowlisted", "RingCentral Events V1 permits exactly four fixed read actions.")
        }
    }
    static func id(_ value: JSONValue?, field: String) throws -> String {
        guard let id = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines), id.count <= 128, id.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
            throw HopinProviderActionSupport.failure("hopin_id_invalid", "\(field) must be a bounded RingCentral Events identifier.")
        }
        return id
    }
    private static func event(id: String = "event-1") -> JSONRecord {
        [
            "eventId": .string(id), "name": .string("Relay Summit"), "description": .string("A bounded Event."), "published": .bool(true), "status": .string("live"), "timeStart": .string("2026-08-01T09:00:00Z"), "timeEnd": .string("2026-08-01T17:00:00Z"), "timezone": .string("Europe/London"),
            "eventType": .string("virtual"), "venueType": .string("online"), "slug": .string("relay-summit"),
        ]
    }
}

public final class RailwayHopinProviderActionClient: HopinProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw HopinProviderActionSupport.failure("hopin_railway_identity_missing", "RingCentral Events Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/hopin/connections/\(remoteConnectionId)/actions/\(try Self.wrapper(request.definition.actionKey))", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else { let error = response["error"] as? [String: Any]; throw HopinProviderActionSupport.failure((error?["code"] as? String) ?? "hopin_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the RingCentral Events action.") }
        var result = Self.jsonRecord(response["data"] as? [String: Any] ?? [:]); result["railwayBrokered"] = .bool(true); result["automaticRetry"] = .bool(false); result["automaticPagination"] = .bool(false); result["rawToolsEnabled"] = .bool(false); return result
    }
    private static func wrapper(_ action: String) throws -> String {
        switch action {
        case "hopin_organization_get": return "relay_hopin_get_organization";
        case "hopin_organization_events_list": return "relay_hopin_list_organization_events";
        case "hopin_event_get": return "relay_hopin_get_event";
        case "hopin_event_schedule_items_list": return "relay_hopin_list_event_schedule_items";
        default: throw HopinProviderActionSupport.failure("hopin_action_not_allowlisted", "RingCentral Events V1 permits exactly four fixed read actions.")
        }
    }
    private static func nonEmpty(_ value: String?) -> String? { guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }; return value }
    private static func foundationObject(_ record: JSONRecord) -> [String: Any] { record.mapValues(foundationValue) }
    private static func foundationValue(_ value: JSONValue) -> Any {
        switch value {
        case .string(let value): return value;
        case .number(let value): return value;
        case .bool(let value): return value;
        case .array(let value): return value.map(foundationValue);
        case .object(let value): return foundationObject(value);
        case .null: return NSNull()
        }
    }
    private static func jsonRecord(_ object: [String: Any]) -> JSONRecord { object.mapValues(jsonValue) }
    private static func jsonValue(_ value: Any) -> JSONValue {
        if value is NSNull { return .null }; if let value = value as? String { return .string(value) }; if let value = value as? Bool { return .bool(value) }; if let value = value as? NSNumber { return .number(value.doubleValue) };
        if let value = value as? [String: Any] { return .object(jsonRecord(value)) }; if let value = value as? [Any] { return .array(value.map(jsonValue)) }; return .null
    }
}

public struct HopinProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any HopinProviderActionClient
    public init(client: any HopinProviderActionClient = FakeHopinProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "hopin", HopinProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else { throw HopinProviderActionSupport.failure("hopin_action_not_allowlisted", "RingCentral Events V1 permits exactly four fixed read actions.") }
        let allowed: Set<String>; switch request.definition.actionKey { case "hopin_organization_events_list": allowed = ["limit"]; case "hopin_event_get": allowed = ["eventId"]; case "hopin_event_schedule_items_list": allowed = ["eventId", "limit"]; default: allowed = [] }
        guard Set(request.payload.keys).isSubset(of: allowed) else {
            throw HopinProviderActionSupport.failure("hopin_payload_not_supported", "RingCentral Events rejects attendee, registration, ticket, report, speaker, email, cursor, arbitrary filter, bulk, write, download, and raw API parameters.")
        }
        if request.payload["eventId"] != nil { _ = try FakeHopinProviderActionClient.id(request.payload["eventId"], field: "eventId") }
        if let value = request.payload["limit"] { guard case .number(let limit) = value, limit.rounded() == limit, (1...10).contains(Int(limit)) else { throw HopinProviderActionSupport.failure("hopin_limit_invalid", "limit must be an integer from 1 through 10.") } }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
