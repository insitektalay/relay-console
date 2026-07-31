import Foundation

public protocol MeetupProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum MeetupProviderActionSupport {
    static let actions: Set<String> = ["meetup_self_get", "meetup_event_get"]

    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(
            code: code, message: message,
            detail: ["automaticRetry": .bool(false), "automaticPagination": .bool(false),
                     "rawGraphQL": .bool(false), "providerRequestLimit": .number(1)])
    }
}

public struct FakeMeetupProviderActionClient: MeetupProviderActionClient {
    public init() {}

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "meetup_self_get":
            return ["memberId": .string("meetup-member-1"), "name": .string("Relay Member"),
                    "verified": .bool(true), "fakeAdapter": .bool(true),
                    "providerRequestCount": .number(1)]
        case "meetup_event_get":
            let eventId = try Self.eventID(request)
            return ["eventId": .string(eventId), "title": .string("Relay Meetup"),
                    "description": .string("A bounded fake Meetup event."),
                    "dateTime": .string("2026-07-20T18:00:00Z"),
                    "eventUrl": .string("https://www.meetup.com/relay/events/\(eventId)/"),
                    "fakeAdapter": .bool(true), "providerRequestCount": .number(1)]
        default:
            throw MeetupProviderActionSupport.failure(
                "meetup_action_not_allowlisted", "Meetup V1 permits exactly two fixed read actions.")
        }
    }

    static func eventID(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let eventId = request.payload["eventId"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !eventId.isEmpty, eventId.count <= 128,
              eventId.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
            throw MeetupProviderActionSupport.failure(
                "meetup_event_id_invalid", "Meetup eventId must contain only letters, digits, underscore, or hyphen.")
        }
        return eventId
    }
}

public final class RailwayMeetupProviderActionClient: MeetupProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService

    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let localConnectionId = Self.nonEmpty(request.auditIdentity.connectionId),
              let localAgentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw MeetupProviderActionSupport.failure(
                "meetup_railway_identity_missing",
                "Meetup Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(
            localWorkspaceId: request.context.workspaceId, localConnectionId: localConnectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(
            localWorkspaceId: request.context.workspaceId, localAgentId: localAgentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST",
            relativePath: "connectors/meetup/connections/\(remoteConnectionId)/actions/\(try Self.wrapper(request.definition.actionKey))",
            body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw MeetupProviderActionSupport.failure(
                (error?["code"] as? String) ?? "meetup_railway_action_failed",
                (error?["message"] as? String) ?? "Railway rejected the Meetup action.")
        }
        var result = Self.jsonRecord(response["data"] as? [String: Any] ?? [:])
        result["railwayBrokered"] = .bool(true)
        result["providerRequestCount"] = .number(1)
        result["automaticRetry"] = .bool(false)
        result["automaticPagination"] = .bool(false)
        result["rawGraphQL"] = .bool(false)
        return result
    }

    private static func wrapper(_ action: String) throws -> String {
        switch action {
        case "meetup_self_get": return "relay_meetup_get_self"
        case "meetup_event_get": return "relay_meetup_get_event"
        default: throw MeetupProviderActionSupport.failure(
            "meetup_action_not_allowlisted", "Meetup V1 permits exactly two fixed read actions.")
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

public struct MeetupProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any MeetupProviderActionClient
    public init(client: any MeetupProviderActionClient = FakeMeetupProviderActionClient()) { self.client = client }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "meetup",
              MeetupProviderActionSupport.actions.contains(request.definition.actionKey),
              request.definition.kind == .read else {
            throw MeetupProviderActionSupport.failure(
                "meetup_action_not_allowlisted", "Meetup V1 permits exactly two fixed read actions.")
        }
        let allowed: Set<String> = request.definition.actionKey == "meetup_event_get" ? ["eventId"] : []
        guard Set(request.payload.keys).isSubset(of: allowed) else {
            throw MeetupProviderActionSupport.failure(
                "meetup_payload_not_supported",
                "Meetup rejects raw GraphQL, scopes, cursors, pagination, bulk, member lists, mutations, and arbitrary fields.")
        }
        if request.definition.actionKey == "meetup_event_get" { _ = try FakeMeetupProviderActionClient.eventID(request) }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
