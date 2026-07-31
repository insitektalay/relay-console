import Foundation

public protocol ZohoMailProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum ZohoMailProviderActionSupport {
    static let actions: Set<String> = [
        "zoho_mail_accounts_list", "zoho_mail_folders_list",
        "zoho_mail_messages_list_filtered", "zoho_mail_message_get",
    ]

    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerTimeoutSeconds": .number(20), "providerRequestLimit": .number(3),
            "rawToolsEnabled": .bool(false), "providerContentPersisted": .bool(false),
            "attachmentDownloadsEnabled": .bool(false),
        ])
    }

    static func numericID(_ value: JSONValue?, field: String) throws -> String {
        guard let id = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !id.isEmpty, id.count <= 64,
              id.range(of: "^[0-9]+$", options: .regularExpression) != nil else {
            throw failure("zoho_mail_id_invalid", "\(field) must be a numeric Zoho Mail ID.")
        }
        return id
    }

    static func limit(_ value: JSONValue?) throws -> Int {
        guard let value else { return 25 }
        guard case .number(let number) = value, number.rounded() == number,
              (1...25).contains(Int(number)) else {
            throw failure("zoho_mail_limit_invalid", "limit must be an integer from 1 through 25.")
        }
        return Int(number)
    }
}

public struct FakeZohoMailProviderActionClient: ZohoMailProviderActionClient {
    public init() {}

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        switch request.definition.actionKey {
        case "zoho_mail_accounts_list":
            return output([
                "accounts": .array([.object(Self.account())]), "count": .number(1),
                "boundAccountId": .string("81001"), "providerRequestCount": .number(1),
            ])
        case "zoho_mail_folders_list":
            let accountId = try ZohoMailProviderActionSupport.numericID(
                request.payload["accountId"], field: "accountId")
            return output([
                "folders": .array([.object([
                    "folderId": .string("82001"), "folderName": .string("Inbox"),
                    "path": .string("/Inbox"), "folderType": .string("Inbox"),
                    "imapAccess": .bool(true), "messageCount": .number(14),
                    "unreadCount": .number(3),
                ])]),
                "count": .number(1), "accountId": .string(accountId),
                "providerRequestCount": .number(1),
            ])
        case "zoho_mail_messages_list_filtered":
            let accountId = try ZohoMailProviderActionSupport.numericID(
                request.payload["accountId"], field: "accountId")
            let folderId = try ZohoMailProviderActionSupport.numericID(
                request.payload["folderId"], field: "folderId")
            let limit = try ZohoMailProviderActionSupport.limit(request.payload["limit"])
            return output([
                "messages": .array([.object(Self.message(folderId: folderId))]),
                "count": .number(1), "limit": .number(Double(limit)),
                "accountId": .string(accountId), "folderId": .string(folderId),
                "providerRequestCount": .number(1), "nextPageFollowed": .bool(false),
            ])
        case "zoho_mail_message_get":
            let accountId = try ZohoMailProviderActionSupport.numericID(
                request.payload["accountId"], field: "accountId")
            let folderId = try ZohoMailProviderActionSupport.numericID(
                request.payload["folderId"], field: "folderId")
            let messageId = try ZohoMailProviderActionSupport.numericID(
                request.payload["messageId"], field: "messageId")
            var message = Self.message(messageId: messageId, folderId: folderId)
            message["contentText"] = .string("The regional readiness review is complete.")
            message["attachments"] = .array([.object([
                "attachmentId": .string("85001"), "attachmentName": .string("readiness.txt"),
                "attachmentSize": .number(256),
            ])])
            message["attachmentCount"] = .number(1)
            message["inlineContentIncluded"] = .bool(false)
            message["providerRequestCount"] = .number(3)
            return output([
                "message": .object(message), "accountId": .string(accountId),
                "providerRequestCount": .number(3),
            ])
        default:
            throw ZohoMailProviderActionSupport.failure(
                "zoho_mail_action_not_allowlisted",
                "Zoho Mail V1 permits exactly four fixed read actions.")
        }
    }

    private func output(_ fields: JSONRecord) -> JSONRecord {
        [
            "provider": .string("zoho-mail"),
            "adapterBoundary": .string("zoho-mail-regional-rest-adapter"),
            "fakeAdapter": .bool(true), "railwayBrokered": .bool(false),
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "rawToolsEnabled": .bool(false), "providerContentPersisted": .bool(false),
        ].merging(fields) { _, new in new }
    }

    private static func account() -> JSONRecord {
        [
            "accountId": .string("81001"), "email": .string("reader@example.com"),
            "displayName": .string("Relay Reader"), "accountName": .string("Primary Mail"),
            "accountType": .string("ZOHO_ACCOUNT"), "accountStatus": .string("active"),
        ]
    }

    private static func message(messageId: String = "83001", folderId: String) -> JSONRecord {
        [
            "messageId": .string(messageId), "folderId": .string(folderId),
            "threadId": .string("84001"), "subject": .string("Regional readiness"),
            "summary": .string("Review the regional connection readiness."),
            "sender": .string("Zoho Teammate"), "fromAddress": .string("teammate@example.com"),
            "toAddress": .string("reader@example.com"), "ccAddress": .null,
            "receivedTime": .string("1783947600000"), "status": .string("0"),
            "flagId": .string("important"), "priority": .string("3"),
            "hasAttachment": .bool(true), "hasInline": .bool(false), "size": .number(1024),
        ]
    }
}

public final class RailwayZohoMailProviderActionClient: ZohoMailProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }

    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let localConnectionId = Self.nonEmpty(request.auditIdentity.connectionId),
              let localAgentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw ZohoMailProviderActionSupport.failure(
                "zoho_mail_railway_identity_missing",
                "Zoho Mail Railway execution requires a synchronized connection and agent install.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(
            localWorkspaceId: request.context.workspaceId, localConnectionId: localConnectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(
            localWorkspaceId: request.context.workspaceId, localAgentId: localAgentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST",
            relativePath: "connectors/zoho-mail/connections/\(remoteConnectionId)/actions/\(try Self.wrapper(request.definition.actionKey))",
            body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw ZohoMailProviderActionSupport.failure(
                (error?["code"] as? String) ?? "zoho_mail_railway_action_failed",
                (error?["message"] as? String) ?? "Railway rejected the Zoho Mail action.")
        }
        var result = Self.jsonRecord(response["data"] as? [String: Any] ?? [:])
        result["railwayBrokered"] = .bool(true)
        result["automaticRetry"] = .bool(false)
        result["automaticPagination"] = .bool(false)
        result["rawToolsEnabled"] = .bool(false)
        result["providerContentPersisted"] = .bool(false)
        result["attachmentDownloadsEnabled"] = .bool(false)
        return result
    }

    private static func wrapper(_ action: String) throws -> String {
        switch action {
        case "zoho_mail_accounts_list": return "relay_zoho_mail_list_accounts"
        case "zoho_mail_folders_list": return "relay_zoho_mail_list_folders"
        case "zoho_mail_messages_list_filtered": return "relay_zoho_mail_list_messages_filtered"
        case "zoho_mail_message_get": return "relay_zoho_mail_get_message"
        default:
            throw ZohoMailProviderActionSupport.failure(
                "zoho_mail_action_not_allowlisted",
                "Zoho Mail V1 permits exactly four fixed read actions.")
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

public struct ZohoMailProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any ZohoMailProviderActionClient
    public init(client: any ZohoMailProviderActionClient = FakeZohoMailProviderActionClient()) {
        self.client = client
    }

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "zoho-mail",
              ZohoMailProviderActionSupport.actions.contains(request.definition.actionKey),
              request.definition.kind == .read,
              request.permission == .allowed else {
            throw ZohoMailProviderActionSupport.failure(
                "zoho_mail_action_not_allowlisted",
                "Zoho Mail V1 permits exactly four allowed fixed read actions.")
        }
        let allowed: Set<String>
        switch request.definition.actionKey {
        case "zoho_mail_accounts_list": allowed = []
        case "zoho_mail_folders_list": allowed = ["accountId"]
        case "zoho_mail_messages_list_filtered": allowed = ["accountId", "folderId", "limit"]
        case "zoho_mail_message_get": allowed = ["accountId", "folderId", "messageId"]
        default: allowed = []
        }
        guard Set(request.payload.keys).isSubset(of: allowed) else {
            throw ZohoMailProviderActionSupport.failure(
                "zoho_mail_payload_not_supported",
                "Zoho Mail rejects writes, downloads, administration, arbitrary endpoints, raw fields, cursors, export and pagination.")
        }
        switch request.definition.actionKey {
        case "zoho_mail_folders_list":
            _ = try ZohoMailProviderActionSupport.numericID(request.payload["accountId"], field: "accountId")
        case "zoho_mail_messages_list_filtered":
            _ = try ZohoMailProviderActionSupport.numericID(request.payload["accountId"], field: "accountId")
            _ = try ZohoMailProviderActionSupport.numericID(request.payload["folderId"], field: "folderId")
            _ = try ZohoMailProviderActionSupport.limit(request.payload["limit"])
        case "zoho_mail_message_get":
            _ = try ZohoMailProviderActionSupport.numericID(request.payload["accountId"], field: "accountId")
            _ = try ZohoMailProviderActionSupport.numericID(request.payload["folderId"], field: "folderId")
            _ = try ZohoMailProviderActionSupport.numericID(request.payload["messageId"], field: "messageId")
        default: break
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
