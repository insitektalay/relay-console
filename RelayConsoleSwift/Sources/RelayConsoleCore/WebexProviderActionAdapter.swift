import Foundation

public protocol WebexProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum WebexProviderActionSupport {
    static let actions: Set<String> = ["webex_person_get", "webex_meetings_list", "webex_meeting_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(2), "rawToolsEnabled": .bool(false),
        ])
    }
}

public struct FakeWebexProviderActionClient: WebexProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "webex_person_get":
            return ["displayName": .string("Relay Person"), "verified": .bool(true),
                    "personBindingVerified": .bool(true),
                    "fakeAdapter": .bool(true), "providerRequestCount": .number(1)]
        case "webex_meetings_list":
            return ["meetings": .array([.object(Self.meeting())]), "count": .number(1), "truncated": .bool(false),
                    "fakeAdapter": .bool(true), "providerRequestCount": .number(1)]
        case "webex_meeting_get":
            let id = try Self.meetingID(request.payload["meetingId"])
            return Self.meeting(id: id).merging(["fakeAdapter": .bool(true), "providerRequestCount": .number(2)]) { _, new in new }
        default:
            throw WebexProviderActionSupport.failure("webex_action_not_allowlisted", "Webex V1 permits exactly three fixed read actions.")
        }
    }

    static func meetingID(_ value: JSONValue?) throws -> String {
        guard let id = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !id.isEmpty, id.count <= 256,
              id.range(of: "^[A-Za-z0-9_-]+$", options: .regularExpression) != nil else {
            throw WebexProviderActionSupport.failure("webex_meeting_id_invalid", "meetingId must be a safe Webex Meeting ID.")
        }
        return id
    }
    private static func meeting(id: String = "meeting_A1") -> JSONRecord {[
        "meetingId": .string(id), "title": .string("Compiler Review"),
        "meetingType": .string("meeting"), "state": .string("active"), "timezone": .string("Europe/London"),
        "start": .string("2026-07-20T18:00:00Z"), "end": .string("2026-07-20T19:00:00Z"),
        "enabledAutoRecordMeeting": .bool(false),
    ]}
}

public final class RailwayWebexProviderActionClient: WebexProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId),
              let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw WebexProviderActionSupport.failure("webex_railway_identity_missing", "Webex Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST",
            relativePath: "connectors/webex/connections/\(remoteConnectionId)/actions/\(try Self.wrapper(request.definition.actionKey))",
            body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw WebexProviderActionSupport.failure((error?["code"] as? String) ?? "webex_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the Webex action.")
        }
        var result = Self.jsonRecord(response["data"] as? [String: Any] ?? [:])
        result["railwayBrokered"] = .bool(true); result["automaticRetry"] = .bool(false)
        result["automaticPagination"] = .bool(false); result["rawToolsEnabled"] = .bool(false)
        return result
    }
    private static func wrapper(_ action: String) throws -> String {
        switch action {
        case "webex_person_get": return "relay_webex_get_person"
        case "webex_meetings_list": return "relay_webex_list_meetings"
        case "webex_meeting_get": return "relay_webex_get_meeting"
        default: throw WebexProviderActionSupport.failure("webex_action_not_allowlisted", "Webex V1 permits exactly three fixed read actions.")
        }
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

public struct WebexProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any WebexProviderActionClient
    public init(client: any WebexProviderActionClient = FakeWebexProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "webex", WebexProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else {
            throw WebexProviderActionSupport.failure("webex_action_not_allowlisted", "Webex V1 permits exactly three fixed read actions.")
        }
        let allowed: Set<String> = request.definition.actionKey == "webex_meetings_list" ? ["limit"] : request.definition.actionKey == "webex_meeting_get" ? ["meetingId"] : []
        guard Set(request.payload.keys).isSubset(of: allowed) else {
            throw WebexProviderActionSupport.failure("webex_payload_not_supported", "Webex rejects mutations, invitees, attendees, recordings, transcripts, messages, cursors, exports, bulk and raw API parameters.")
        }
        if request.definition.actionKey == "webex_meeting_get" { _ = try FakeWebexProviderActionClient.meetingID(request.payload["meetingId"]) }
        if let value = request.payload["limit"] { guard case .number(let limit) = value, limit.rounded() == limit, (1...10).contains(Int(limit)) else { throw WebexProviderActionSupport.failure("webex_limit_invalid", "limit must be an integer from 1 through 10.") } }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
