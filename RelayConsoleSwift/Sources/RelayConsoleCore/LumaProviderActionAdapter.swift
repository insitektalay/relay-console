import Foundation

public protocol LumaProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum LumaProviderActionSupport {
    static let actions: Set<String> = [
        "luma_user_get", "luma_calendar_get", "luma_calendar_events_list", "luma_event_get",
    ]

    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(1), "rawToolsEnabled": .bool(false),
        ])
    }
}

public struct FakeLumaProviderActionClient: LumaProviderActionClient {
    public init() {}

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "luma_user_get":
            return [
                "name": .string("Relay Host"), "verified": .bool(true),
                "userBindingVerified": .bool(true), "fakeAdapter": .bool(true),
                "providerRequestCount": .number(1),
            ]
        case "luma_calendar_get":
            return [
                "name": .string("Relay Events"),
                "description": .string("Bounded Calendar metadata."),
                "url": .string("https://luma.com/relay-events"),
                "isPersonal": .bool(false),
                "location": .object(["city": .string("London"), "country": .string("United Kingdom")]),
                "verified": .bool(true), "calendarBindingVerified": .bool(true),
                "fakeAdapter": .bool(true), "providerRequestCount": .number(1),
            ]
        case "luma_calendar_events_list":
            return [
                "events": .array([.object(Self.event())]), "truncated": .bool(false),
                "fakeAdapter": .bool(true), "providerRequestCount": .number(1),
            ]
        case "luma_event_get":
            let eventId = try Self.eventID(request.payload["eventId"])
            return Self.event(eventId: eventId).merging([
                "fakeAdapter": .bool(true), "providerRequestCount": .number(1),
            ]) { _, new in new }
        default:
            throw LumaProviderActionSupport.failure(
                "luma_action_not_allowlisted", "Luma V1 permits exactly four fixed read actions.")
        }
    }

    static func eventID(_ value: JSONValue?) throws -> String {
        guard let id = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              id.count <= 128,
              id.range(of: "^evt-[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
            throw LumaProviderActionSupport.failure(
                "luma_event_id_invalid", "eventId must be a Luma evt- identifier.")
        }
        return id
    }

    private static func event(eventId: String = "evt-compiler-night") -> JSONRecord {[
        "eventId": .string(eventId), "name": .string("Compiler Night"),
        "description": .string("A bounded Luma Event."),
        "startAt": .string("2026-07-20T18:00:00Z"), "endAt": .string("2026-07-20T20:00:00Z"),
        "timezone": .string("Europe/London"), "url": .string("https://luma.com/compiler-night"),
        "visibility": .string("private"), "locationType": .string("offline"),
        "locationVisibility": .string("guests-only"),
        "location": .object(["city": .string("London"), "country": .string("United Kingdom")]),
    ]}
}

public final class RailwayLumaProviderActionClient: LumaProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let localConnectionId = Self.nonEmpty(request.auditIdentity.connectionId),
              let localAgentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw LumaProviderActionSupport.failure(
                "luma_railway_identity_missing",
                "Luma Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(
            localWorkspaceId: request.context.workspaceId, localConnectionId: localConnectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(
            localWorkspaceId: request.context.workspaceId, localAgentId: localAgentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST",
            relativePath: "connectors/luma/connections/\(remoteConnectionId)/actions/\(try Self.wrapper(request.definition.actionKey))",
            body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw LumaProviderActionSupport.failure(
                (error?["code"] as? String) ?? "luma_railway_action_failed",
                (error?["message"] as? String) ?? "Railway rejected the Luma action.")
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
        case "luma_user_get": return "relay_luma_get_user"
        case "luma_calendar_get": return "relay_luma_get_calendar"
        case "luma_calendar_events_list": return "relay_luma_list_calendar_events"
        case "luma_event_get": return "relay_luma_get_event"
        default: throw LumaProviderActionSupport.failure(
            "luma_action_not_allowlisted", "Luma V1 permits exactly four fixed read actions.")
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

public struct LumaProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any LumaProviderActionClient
    public init(client: any LumaProviderActionClient = FakeLumaProviderActionClient()) { self.client = client }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "luma",
              LumaProviderActionSupport.actions.contains(request.definition.actionKey),
              request.definition.kind == .read else {
            throw LumaProviderActionSupport.failure(
                "luma_action_not_allowlisted", "Luma V1 permits exactly four fixed read actions.")
        }
        let allowed: Set<String>
        switch request.definition.actionKey {
        case "luma_calendar_events_list": allowed = ["after", "before", "limit"]
        case "luma_event_get": allowed = ["eventId"]
        default: allowed = []
        }
        guard Set(request.payload.keys).isSubset(of: allowed) else {
            throw LumaProviderActionSupport.failure(
                "luma_payload_not_supported",
                "Luma rejects guests, registrations, contacts, meeting links, exact private addresses, cursors, arbitrary filters, bulk, writes, and raw API parameters.")
        }
        if request.definition.actionKey == "luma_event_get" {
            _ = try FakeLumaProviderActionClient.eventID(request.payload["eventId"])
        }
        if request.definition.actionKey == "luma_calendar_events_list" {
            let after = try Self.date(request.payload["after"], field: "after")
            if let beforeValue = request.payload["before"] {
                let before = try Self.date(beforeValue, field: "before")
                guard before >= after, before.timeIntervalSince(after) <= 366 * 24 * 60 * 60 else {
                    throw LumaProviderActionSupport.failure(
                        "luma_window_invalid", "Luma Event windows must be forward-looking and no longer than 366 days.")
                }
            }
        }
        if let limitValue = request.payload["limit"] {
            guard case .number(let limit) = limitValue, limit.rounded() == limit, (1...10).contains(Int(limit)) else {
                throw LumaProviderActionSupport.failure("luma_limit_invalid", "limit must be an integer from 1 through 10.")
            }
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }

    private static func date(_ value: JSONValue?, field: String) throws -> Date {
        guard let text = value?.string, text.count <= 64,
              text.range(of: "(?:Z|[+-][0-9]{2}:[0-9]{2})$", options: .regularExpression) != nil,
              let date = ISO8601DateFormatter().date(from: text) else {
            throw LumaProviderActionSupport.failure(
                "luma_date_invalid", "\(field) must be an ISO 8601 date-time with offset.")
        }
        return date
    }
}
