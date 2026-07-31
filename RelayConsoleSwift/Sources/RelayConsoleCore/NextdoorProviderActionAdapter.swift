import Foundation

public protocol NextdoorProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum NextdoorProviderActionSupport {
    static let actions: Set<String> = [
        "nextdoor_profile_get", "nextdoor_own_posts_list",
        "nextdoor_text_post_draft", "nextdoor_text_post_publish",
    ]

    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(
            code: code, message: message,
            detail: ["automaticRetry": .bool(false), "automaticPagination": .bool(false)])
    }
}

public struct FakeNextdoorProviderActionClient: NextdoorProviderActionClient {
    public init() {}

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "nextdoor_profile_get":
            return ["profile": .object([
                "profileId": .string("nextdoor-profile-1"), "profileType": .string("neighbor"),
                "displayName": .string("Relay Neighbour"), "neighborhoodName": .string("Example Park"),
                "cityName": .string("Example City"), "verified": .bool(true),
            ]), "fakeAdapter": .bool(true), "providerRequestCount": .number(1)]
        case "nextdoor_own_posts_list":
            return ["posts": .array([.object([
                "postId": .string("share-1"), "bodyExcerpt": .string("A useful Nextdoor update."),
                "shareUrl": .string("https://nextdoor.com/p/share-1"),
                "createdAt": .string("2026-07-12T20:00:00Z"),
            ])]), "count": .number(1), "fakeAdapter": .bool(true),
                "providerRequestCount": .number(1), "automaticPagination": .bool(false)]
        case "nextdoor_text_post_draft":
            let text = try Self.text(request)
            return ["text": .string(text), "providerSideEffect": .bool(false),
                    "fakeAdapter": .bool(true), "providerRequestCount": .number(0)]
        case "nextdoor_text_post_publish":
            let text = try Self.text(request)
            return ["postId": .string("share-published"), "bodyExcerpt": .string(String(text.prefix(2000))),
                    "shareUrl": .string("https://nextdoor.com/p/share-published"),
                    "fakeAdapter": .bool(true), "providerRequestCount": .number(1)]
        default:
            throw NextdoorProviderActionSupport.failure(
                "nextdoor_action_not_allowlisted", "Nextdoor V1 permits exactly four actions.")
        }
    }

    private static func text(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let text = request.payload["text"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty, text.lengthOfBytes(using: .utf8) <= 8192 else {
            throw NextdoorProviderActionSupport.failure(
                "nextdoor_text_invalid", "Nextdoor text must be non-empty and at most 8192 UTF-8 bytes.")
        }
        return text
    }
}

public final class RailwayNextdoorProviderActionClient: NextdoorProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService

    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let localConnectionId = Self.nonEmpty(request.auditIdentity.connectionId),
              let localAgentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw NextdoorProviderActionSupport.failure(
                "nextdoor_railway_identity_missing",
                "Nextdoor Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(
            localWorkspaceId: request.context.workspaceId, localConnectionId: localConnectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(
            localWorkspaceId: request.context.workspaceId, localAgentId: localAgentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST",
            relativePath: "connectors/nextdoor/connections/\(remoteConnectionId)/actions/\(try Self.wrapper(request.definition.actionKey))",
            body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            let code: String = (error?["code"] as? String) ?? "nextdoor_railway_action_failed"
            let message: String = (error?["message"] as? String) ?? "Railway rejected the Nextdoor action."
            throw NextdoorProviderActionSupport.failure(
                code, message)
        }
        var result: JSONRecord = Self.jsonRecord(response["data"] as? [String: Any] ?? [:])
        if request.definition.actionKey == "nextdoor_profile_get" { result = ["profile": .object(result)] }
        result["railwayBrokered"] = .bool(true)
        result["providerRequestCount"] = .number(request.definition.kind == .draft ? 0 : 1)
        result["automaticRetry"] = .bool(false)
        result["automaticPagination"] = .bool(false)
        return result
    }

    private static func wrapper(_ action: String) throws -> String {
        switch action {
        case "nextdoor_profile_get": return "relay_nextdoor_get_profile"
        case "nextdoor_own_posts_list": return "relay_nextdoor_list_own_posts"
        case "nextdoor_text_post_draft": return "relay_nextdoor_draft_text_post"
        case "nextdoor_text_post_publish": return "relay_nextdoor_publish_text_post"
        default: throw NextdoorProviderActionSupport.failure(
            "nextdoor_action_not_allowlisted", "Nextdoor V1 permits exactly four actions.")
        }
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return nil
        }
        return trimmed
    }

    private static func foundationObject(_ record: JSONRecord) -> [String: Any] {
        record.mapValues(foundationValue)
    }
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

public struct NextdoorProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any NextdoorProviderActionClient
    public init(client: any NextdoorProviderActionClient = FakeNextdoorProviderActionClient()) { self.client = client }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "nextdoor",
              NextdoorProviderActionSupport.actions.contains(request.definition.actionKey) else {
            throw NextdoorProviderActionSupport.failure(
                "nextdoor_action_not_allowlisted", "Nextdoor V1 permits exactly four actions.")
        }
        let allowed: Set<String>
        switch request.definition.actionKey {
        case "nextdoor_own_posts_list": allowed = ["limit"]
        case "nextdoor_text_post_draft", "nextdoor_text_post_publish": allowed = ["text"]
        default: allowed = []
        }
        guard Set(request.payload.keys).isSubset(of: allowed) else {
            throw NextdoorProviderActionSupport.failure(
                "nextdoor_payload_not_supported",
                "Nextdoor rejects profile overrides, cursors, cross-product, comments, events, media, geo, scheduling, bulk, edit/delete, export, and raw parameters.")
        }
        return MarketplaceProviderActionAdapterResult(
            result: try client.execute(request), persistResult: request.definition.kind == .write)
    }
}
