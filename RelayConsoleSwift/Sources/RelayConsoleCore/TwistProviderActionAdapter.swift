import Foundation

public protocol TwistProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum TwistProviderActionSupport {
    static let actions: Set<String> = [
        "twist_user_get", "twist_workspaces_list", "twist_channels_list",
        "twist_inbox_threads_list", "twist_thread_comments_get",
    ]

    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerTimeoutSeconds": .number(20), "providerRequestLimit": .number(2),
            "rawToolsEnabled": .bool(false), "providerContentPersisted": .bool(false),
        ])
    }

    static func numericID(_ value: JSONValue?, field: String) throws -> String {
        guard let id = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !id.isEmpty, id.count <= 64,
              id.range(of: "^[0-9]+$", options: .regularExpression) != nil else {
            throw failure("twist_id_invalid", "\(field) must be a numeric Twist ID.")
        }
        return id
    }

    static func limit(_ value: JSONValue?, field: String, maximum: Int, default defaultValue: Int) throws -> Int {
        guard let value else { return defaultValue }
        guard case .number(let number) = value, number.rounded() == number,
              (1...maximum).contains(Int(number)) else {
            throw failure("twist_limit_invalid", "\(field) must be an integer from 1 through \(maximum).")
        }
        return Int(number)
    }
}

public struct FakeTwistProviderActionClient: TwistProviderActionClient {
    public init() {}

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "twist_user_get":
            return [
                "user": .object([
                    "userId": .string("101"), "name": .string("Relay Teammate"),
                    "email": .string("relay@example.com"), "timezone": .string("Europe/London"),
                ]),
                "fakeAdapter": .bool(true), "providerRequestCount": .number(1),
            ]
        case "twist_workspaces_list":
            let limit = try TwistProviderActionSupport.limit(
                request.payload["limit"], field: "limit", maximum: 20, default: 20)
            return [
                "workspaces": .array([.object([
                    "workspaceId": .string("201"), "name": .string("Relay Workspace"),
                ])]),
                "count": .number(1), "limit": .number(Double(limit)),
                "fakeAdapter": .bool(true), "providerRequestCount": .number(1),
            ]
        case "twist_channels_list":
            let workspaceId = try TwistProviderActionSupport.numericID(
                request.payload["workspaceId"], field: "workspaceId")
            let limit = try TwistProviderActionSupport.limit(
                request.payload["limit"], field: "limit", maximum: 50, default: 50)
            return [
                "channels": .array([.object([
                    "channelId": .string("301"), "workspaceId": .string(workspaceId),
                    "name": .string("Engineering"),
                    "description": .string("Coordinate product delivery."), "archived": .bool(false),
                ])]),
                "count": .number(1), "limit": .number(Double(limit)),
                "fakeAdapter": .bool(true), "providerRequestCount": .number(1),
            ]
        case "twist_inbox_threads_list":
            let workspaceId = try TwistProviderActionSupport.numericID(
                request.payload["workspaceId"], field: "workspaceId")
            let limit = try TwistProviderActionSupport.limit(
                request.payload["limit"], field: "limit", maximum: 20, default: 20)
            return [
                "threads": .array([.object(Self.thread(workspaceId: workspaceId))]),
                "count": .number(1), "limit": .number(Double(limit)),
                "fakeAdapter": .bool(true), "providerRequestCount": .number(1),
            ]
        case "twist_thread_comments_get":
            let threadId = try TwistProviderActionSupport.numericID(
                request.payload["threadId"], field: "threadId")
            let limit = try TwistProviderActionSupport.limit(
                request.payload["commentLimit"], field: "commentLimit", maximum: 30, default: 30)
            return [
                "thread": .object(Self.thread(threadId: threadId, workspaceId: "201")),
                "comments": .array([.object([
                    "commentId": .string("501"), "threadId": .string(threadId),
                    "content": .string("The release checklist is complete."),
                    "creatorId": .string("101"), "postedAt": .number(1_783_952_700),
                    "lastEditedAt": .null,
                ])]),
                "commentCount": .number(1), "commentLimit": .number(Double(limit)),
                "fakeAdapter": .bool(true), "providerRequestCount": .number(2),
            ]
        default:
            throw TwistProviderActionSupport.failure(
                "twist_action_not_allowlisted", "Twist V1 permits exactly five fixed read actions.")
        }
    }

    private static func thread(threadId: String = "401", workspaceId: String) -> JSONRecord {
        [
            "threadId": .string(threadId), "workspaceId": .string(workspaceId),
            "channelId": .string("301"), "title": .string("Release readiness"),
            "content": .string("Confirm ownership and remaining release risks."),
            "snippet": .string("Release readiness and remaining risks"),
            "creatorId": .string("101"), "commentCount": .number(1),
            "postedAt": .number(1_783_949_100), "lastUpdatedAt": .number(1_783_952_700),
            "archived": .bool(false), "pinned": .bool(true),
        ]
    }
}

public final class RailwayTwistProviderActionClient: TwistProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let localConnectionId = Self.nonEmpty(request.auditIdentity.connectionId),
              let localAgentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw TwistProviderActionSupport.failure(
                "twist_railway_identity_missing",
                "Twist Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(
            localWorkspaceId: request.context.workspaceId, localConnectionId: localConnectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(
            localWorkspaceId: request.context.workspaceId, localAgentId: localAgentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST",
            relativePath: "connectors/twist/connections/\(remoteConnectionId)/actions/\(try Self.wrapper(request.definition.actionKey))",
            body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw TwistProviderActionSupport.failure(
                (error?["code"] as? String) ?? "twist_railway_action_failed",
                (error?["message"] as? String) ?? "Railway rejected the Twist action.")
        }
        var result = Self.jsonRecord(response["data"] as? [String: Any] ?? [:])
        result["railwayBrokered"] = .bool(true)
        result["automaticRetry"] = .bool(false)
        result["automaticPagination"] = .bool(false)
        result["rawToolsEnabled"] = .bool(false)
        result["providerContentPersisted"] = .bool(false)
        return result
    }

    private static func wrapper(_ action: String) throws -> String {
        switch action {
        case "twist_user_get": return "relay_twist_get_user"
        case "twist_workspaces_list": return "relay_twist_list_workspaces"
        case "twist_channels_list": return "relay_twist_list_channels"
        case "twist_inbox_threads_list": return "relay_twist_list_inbox_threads"
        case "twist_thread_comments_get": return "relay_twist_get_thread_with_comments"
        default: throw TwistProviderActionSupport.failure(
            "twist_action_not_allowlisted", "Twist V1 permits exactly five fixed read actions.")
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

public struct TwistProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any TwistProviderActionClient
    public init(client: any TwistProviderActionClient = FakeTwistProviderActionClient()) { self.client = client }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "twist",
              TwistProviderActionSupport.actions.contains(request.definition.actionKey),
              request.definition.kind == .read else {
            throw TwistProviderActionSupport.failure(
                "twist_action_not_allowlisted", "Twist V1 permits exactly five fixed read actions.")
        }
        let allowed: Set<String>
        switch request.definition.actionKey {
        case "twist_workspaces_list": allowed = ["limit"]
        case "twist_channels_list": allowed = ["workspaceId", "limit"]
        case "twist_inbox_threads_list": allowed = ["workspaceId", "limit"]
        case "twist_thread_comments_get": allowed = ["threadId", "commentLimit"]
        default: allowed = []
        }
        guard Set(request.payload.keys).isSubset(of: allowed) else {
            throw TwistProviderActionSupport.failure(
                "twist_payload_not_supported",
                "Twist rejects direct messages, search, attachments, cursors, arbitrary endpoints, raw fields, bulk export, pagination and mutations.")
        }
        switch request.definition.actionKey {
        case "twist_channels_list", "twist_inbox_threads_list":
            _ = try TwistProviderActionSupport.numericID(request.payload["workspaceId"], field: "workspaceId")
        case "twist_thread_comments_get":
            _ = try TwistProviderActionSupport.numericID(request.payload["threadId"], field: "threadId")
        default: break
        }
        switch request.definition.actionKey {
        case "twist_workspaces_list", "twist_inbox_threads_list":
            _ = try TwistProviderActionSupport.limit(request.payload["limit"], field: "limit", maximum: 20, default: 20)
        case "twist_channels_list":
            _ = try TwistProviderActionSupport.limit(request.payload["limit"], field: "limit", maximum: 50, default: 50)
        case "twist_thread_comments_get":
            _ = try TwistProviderActionSupport.limit(request.payload["commentLimit"], field: "commentLimit", maximum: 30, default: 30)
        default: break
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
