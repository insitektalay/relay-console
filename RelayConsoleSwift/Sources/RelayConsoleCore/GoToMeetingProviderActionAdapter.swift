import Foundation

public protocol GoToMeetingProviderActionClient: Sendable { func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord }

public enum GoToMeetingProviderActionSupport {
    static let actions: Set<String> = ["goto_meeting_identity_get", "goto_meeting_upcoming_list", "goto_meeting_get"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(2), "rawToolsEnabled": .bool(false)])
    }
}

public struct FakeGoToMeetingProviderActionClient: GoToMeetingProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "goto_meeting_identity_get":
            return ["displayName": .string("Relay Organizer"), "verified": .bool(true),
                    "organizerBindingVerified": .bool(true), "fakeAdapter": .bool(true), "providerRequestCount": .number(1)]
        case "goto_meeting_upcoming_list":
            return ["meetings": .array([.object(Self.meeting())]), "count": .number(1), "fakeAdapter": .bool(true), "providerRequestCount": .number(1)]
        case "goto_meeting_get":
            let id = try Self.numericID(request.payload["meetingId"], field: "meetingId")
            return Self.meeting(id: id).merging(["fakeAdapter": .bool(true), "providerRequestCount": .number(2)]) { _, new in new }
        default: throw GoToMeetingProviderActionSupport.failure("goto_meeting_action_not_allowlisted", "GoTo Meeting permits exactly three fixed read actions.")
        }
    }
    static func numericID(_ value: JSONValue?, field: String) throws -> String {
        guard let id = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !id.isEmpty, id.count <= 20,
              id.range(of: "^[0-9]+$", options: .regularExpression) != nil else {
            throw GoToMeetingProviderActionSupport.failure("goto_meeting_id_invalid", "\(field) must be a numeric GoTo Meeting ID.")
        }
        return id
    }
    private static func meeting(id: String = "123456789") -> JSONRecord {[
        "meetingId": .string(id), "subject": .string("Compiler Review"),
        "startTime": .string("2026-07-20T18:00:00Z"), "endTime": .string("2026-07-20T19:00:00Z"),
        "duration": .number(60), "meetingType": .string("scheduled"), "status": .string("ACTIVE")]}
}

public final class RailwayGoToMeetingProviderActionClient: GoToMeetingProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw GoToMeetingProviderActionSupport.failure("goto_meeting_railway_identity_missing", "GoTo Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST",
            relativePath: "connectors/goto-meeting/connections/\(remoteConnectionId)/actions/\(try Self.wrapper(request.definition.actionKey))",
            body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw GoToMeetingProviderActionSupport.failure((error?["code"] as? String) ?? "goto_meeting_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the GoTo Meeting action.")
        }
        var result = Self.jsonRecord(response["data"] as? [String: Any] ?? [:])
        result["railwayBrokered"] = .bool(true); result["automaticRetry"] = .bool(false); result["automaticPagination"] = .bool(false); result["rawToolsEnabled"] = .bool(false)
        return result
    }
    private static func wrapper(_ action: String) throws -> String { switch action {
        case "goto_meeting_identity_get": return "relay_goto_meeting_get_identity"
        case "goto_meeting_upcoming_list": return "relay_goto_meeting_list_upcoming_meetings"
        case "goto_meeting_get": return "relay_goto_meeting_get_meeting"
        default: throw GoToMeetingProviderActionSupport.failure("goto_meeting_action_not_allowlisted", "GoTo Meeting permits exactly three fixed read actions.") } }
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

public struct GoToMeetingProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any GoToMeetingProviderActionClient
    public init(client: any GoToMeetingProviderActionClient = FakeGoToMeetingProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "goto-meeting", GoToMeetingProviderActionSupport.actions.contains(request.definition.actionKey), request.definition.kind == .read else {
            throw GoToMeetingProviderActionSupport.failure("goto_meeting_action_not_allowlisted", "GoTo Meeting permits exactly three fixed read actions.")
        }
        let allowed: Set<String> = request.definition.actionKey == "goto_meeting_upcoming_list" ? ["limit"] : request.definition.actionKey == "goto_meeting_get" ? ["meetingId"] : []
        guard Set(request.payload.keys).isSubset(of: allowed) else {
            throw GoToMeetingProviderActionSupport.failure("goto_meeting_payload_not_supported", "GoTo Meeting rejects organizer keys, writes, attendees, history, recordings, transcripts, summaries, credentials, admin, pagination, exports and raw parameters.")
        }
        if request.definition.actionKey == "goto_meeting_get" { _ = try FakeGoToMeetingProviderActionClient.numericID(request.payload["meetingId"], field: "meetingId") }
        if let value = request.payload["limit"] { guard case .number(let limit) = value, limit.rounded() == limit, (1...10).contains(Int(limit)) else { throw GoToMeetingProviderActionSupport.failure("goto_meeting_limit_invalid", "limit must be an integer from 1 through 10.") } }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
