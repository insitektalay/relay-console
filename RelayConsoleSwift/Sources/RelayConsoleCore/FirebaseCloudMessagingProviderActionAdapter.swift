import Foundation
public protocol FirebaseCloudMessagingProviderActionClient:Sendable{func executeFirebaseCloudMessagingAction(request:MarketplaceProviderActionAdapterRequest)throws->JSONRecord}
public struct FakeFirebaseCloudMessagingProviderActionClient: FirebaseCloudMessagingProviderActionClient {
    public init() {};
    public func executeFirebaseCloudMessagingAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        [
            "provider": .string("firebase-cloud-messaging"), "action": .string(request.definition.actionKey), "providerMutation": .bool(true), "liveCredentialsUsed": .bool(false), "railwayBrokered": .bool(false),
            "redactionStatus": .string("device-tokens-users-data-payloads-and-platform-overrides-excluded"),
        ]
    }
}
public final class RailwayFirebaseCloudMessagingProviderActionClient: FirebaseCloudMessagingProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService; public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync };
    public func executeFirebaseCloudMessagingAction(request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "firebase_cloud_messaging_topic_notification_publish" else { throw Self.failure("fcm_action_not_allowlisted", "FCM action is not allowlisted.") };
        guard let connection = request.auditIdentity.connectionId, let agent = request.auditIdentity.agentId else { throw Self.failure("fcm_railway_identity_missing", "FCM Railway execution requires synchronized connection and agent identities.") };
        let title = try Self.text(request.payload["title"], "title", 100), body = try Self.text(request.payload["body"], "body", 1000), remoteConnection = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connection),
            remoteAgent = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agent),
            response = try cloudSync.railwayMarketplaceRequestSync(
                localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/firebase-cloud-messaging/connections/\(remoteConnection)/actions/firebaseCloudMessaging.publishTopicNotification", body: ["agentId": remoteAgent, "payload": ["title": title, "body": body]])
        ; guard response["ok"] as? Bool == true else { let error = response["error"] as? [String: Any]; throw Self.failure(error?["code"] as? String ?? "fcm_railway_action_failed", error?["message"] as? String ?? "Railway rejected the FCM action.") };
        var result = Self.record(response["data"] as? [String: Any] ?? [:]); result["railwayBrokered"] = .bool(true); result["liveCredentialsUsed"] = .bool(true); result["redactionStatus"] = .string("device-tokens-users-data-payloads-and-platform-overrides-excluded"); return result
    };
    private static func text(_ value: JSONValue?, _ label: String, _ max: Int) throws -> String {
        guard let text = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty, text.count <= max else { throw failure("fcm_content_invalid", "FCM \(label) is invalid.") }; return text
    };
    private static func record(_ value: [String: Any]) -> JSONRecord { value.mapValues(json) };
    private static func json(_ value: Any) -> JSONValue {
        if value is NSNull { return .null }; if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? NSNumber { return .number(v.doubleValue) }; if let v = value as? [String: Any] { return .object(record(v)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }; private static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure { MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: ["automaticRetry": .bool(false)]) }
}
public struct FirebaseCloudMessagingProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any FirebaseCloudMessagingProviderActionClient; public init(client: any FirebaseCloudMessagingProviderActionClient = FakeFirebaseCloudMessagingProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "firebase-cloud-messaging" else { throw MarketplaceProviderActionAdapterFailure(code: "fcm_action_not_allowlisted", message: "FCM action is not allowlisted.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeFirebaseCloudMessagingAction(request: request), error: nil, redactionStatus: "device-tokens-users-data-payloads-and-platform-overrides-excluded")
    }
}
