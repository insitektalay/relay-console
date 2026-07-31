import Foundation

public protocol EventbriteProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum EventbriteProviderActionSupport {
    static let actions: Set<String> = [
        "eventbrite_user_get", "eventbrite_organizations_list",
        "eventbrite_organization_events_list", "eventbrite_event_get",
    ]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(2), "rawToolsEnabled": .bool(false),
        ])
    }
}

public struct FakeEventbriteProviderActionClient: EventbriteProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "eventbrite_user_get":
            return ["name": .string("Relay Organizer"), "verified": .bool(true),
                    "userBindingVerified": .bool(true), "fakeAdapter": .bool(true),
                    "providerRequestCount": .number(1)]
        case "eventbrite_organizations_list":
            return ["organizations": .array([.object(["organizationId": .string("2001"), "name": .string("Relay Events")])]),
                    "count": .number(1), "fakeAdapter": .bool(true), "providerRequestCount": .number(1)]
        case "eventbrite_organization_events_list":
            _ = try Self.numericID(request.payload["organizationId"], field: "organizationId")
            return ["events": .array([.object(Self.event())]), "count": .number(1),
                    "fakeAdapter": .bool(true), "providerRequestCount": .number(2)]
        case "eventbrite_event_get":
            let eventId = try Self.numericID(request.payload["eventId"], field: "eventId")
            return Self.event(eventId: eventId).merging([
                "fakeAdapter": .bool(true), "providerRequestCount": .number(1),
            ]) { _, new in new }
        default:
            throw EventbriteProviderActionSupport.failure(
                "eventbrite_action_not_allowlisted", "Eventbrite V1 permits exactly four fixed read actions.")
        }
    }

    static func numericID(_ value: JSONValue?, field: String) throws -> String {
        guard let id = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !id.isEmpty, id.count <= 64,
              id.range(of: "^[0-9]+$", options: .regularExpression) != nil else {
            throw EventbriteProviderActionSupport.failure(
                "eventbrite_id_invalid", "\(field) must be a numeric Eventbrite ID.")
        }
        return id
    }
    private static func event(eventId: String = "3001") -> JSONRecord {[
        "eventId": .string(eventId), "name": .string("Compiler Night"),
        "summary": .string("A bounded Eventbrite Event."),
        "url": .string("https://www.eventbrite.com/e/compiler-night-tickets-\(eventId)"),
        "start": .object(["utc": .string("2026-07-20T18:00:00Z"), "local": .string("2026-07-20T19:00:00"), "timezone": .string("Europe/London")]),
        "end": .object(["utc": .string("2026-07-20T20:00:00Z"), "local": .string("2026-07-20T21:00:00"), "timezone": .string("Europe/London")]),
        "status": .string("live"), "onlineEvent": .bool(false),
        "venue": .object(["name": .string("Town Hall"), "city": .string("London"), "country": .string("GB")]),
    ]}
}

public final class RailwayEventbriteProviderActionClient: EventbriteProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let localConnectionId = Self.nonEmpty(request.auditIdentity.connectionId),
              let localAgentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw EventbriteProviderActionSupport.failure(
                "eventbrite_railway_identity_missing",
                "Eventbrite Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(
            localWorkspaceId: request.context.workspaceId, localConnectionId: localConnectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(
            localWorkspaceId: request.context.workspaceId, localAgentId: localAgentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST",
            relativePath: "connectors/eventbrite/connections/\(remoteConnectionId)/actions/\(try Self.wrapper(request.definition.actionKey))",
            body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw EventbriteProviderActionSupport.failure(
                (error?["code"] as? String) ?? "eventbrite_railway_action_failed",
                (error?["message"] as? String) ?? "Railway rejected the Eventbrite action.")
        }
        var result = Self.jsonRecord(response["data"] as? [String: Any] ?? [:])
        result["railwayBrokered"] = .bool(true)
        result["automaticRetry"] = .bool(false)
        result["automaticPagination"] = .bool(false)
        result["rawToolsEnabled"] = .bool(false)
        return result
    }

    private static func wrapper(_ action: String) throws -> String {
        switch action {
        case "eventbrite_user_get": return "relay_eventbrite_get_user"
        case "eventbrite_organizations_list": return "relay_eventbrite_list_organizations"
        case "eventbrite_organization_events_list": return "relay_eventbrite_list_organization_events"
        case "eventbrite_event_get": return "relay_eventbrite_get_event"
        default: throw EventbriteProviderActionSupport.failure(
            "eventbrite_action_not_allowlisted", "Eventbrite V1 permits exactly four fixed read actions.")
        }
    }
    private static func nonEmpty(_ value: String?) -> String? {
        guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }
        return value
    }
    private static func foundationObject(_ record: JSONRecord) -> [String: Any] { record.mapValues(foundationValue) }
    private static func foundationValue(_ value: JSONValue) -> Any {
        switch value {
        case .string(let value): return value
        case .number(let value): return value
        case .bool(let value): return value
        case .array(let value): return value.map(foundationValue)
        case .object(let value): return foundationObject(value)
        case .null: return NSNull()
        }
    }
    private static func jsonRecord(_ object: [String: Any]) -> JSONRecord { object.mapValues(jsonValue) }
    private static func jsonValue(_ value: Any) -> JSONValue {
        if value is NSNull { return .null }
        if let value = value as? String { return .string(value) }
        if let value = value as? Bool { return .bool(value) }
        if let value = value as? NSNumber { return .number(value.doubleValue) }
        if let value = value as? [String: Any] { return .object(jsonRecord(value)) }
        if let value = value as? [Any] { return .array(value.map(jsonValue)) }
        return .null
    }
}

public struct EventbriteProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any EventbriteProviderActionClient
    public init(client: any EventbriteProviderActionClient = FakeEventbriteProviderActionClient()) { self.client = client }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "eventbrite",
              EventbriteProviderActionSupport.actions.contains(request.definition.actionKey),
              request.definition.kind == .read else {
            throw EventbriteProviderActionSupport.failure(
                "eventbrite_action_not_allowlisted", "Eventbrite V1 permits exactly four fixed read actions.")
        }
        let allowed: Set<String>
        switch request.definition.actionKey {
        case "eventbrite_organizations_list": allowed = ["limit"]
        case "eventbrite_organization_events_list": allowed = ["organizationId", "limit"]
        case "eventbrite_event_get": allowed = ["eventId"]
        default: allowed = []
        }
        guard Set(request.payload.keys).isSubset(of: allowed) else {
            throw EventbriteProviderActionSupport.failure(
                "eventbrite_payload_not_supported",
                "Eventbrite rejects attendee/order/ticket/payment fields, cursors, arbitrary expansions, bulk, writes, Manage ESR, and raw API parameters.")
        }
        if request.definition.actionKey == "eventbrite_organization_events_list" {
            _ = try FakeEventbriteProviderActionClient.numericID(request.payload["organizationId"], field: "organizationId")
        }
        if request.definition.actionKey == "eventbrite_event_get" {
            _ = try FakeEventbriteProviderActionClient.numericID(request.payload["eventId"], field: "eventId")
        }
        if let limitValue = request.payload["limit"] {
            guard case .number(let limit) = limitValue, limit.rounded() == limit, (1...10).contains(Int(limit)) else {
                throw EventbriteProviderActionSupport.failure("eventbrite_limit_invalid", "limit must be an integer from 1 through 10.")
            }
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
