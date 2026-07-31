import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct DiscordProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol DiscordProviderActionClient: Sendable { func executeDiscordAction(request: MarketplaceProviderActionAdapterRequest) throws -> DiscordProviderActionClientResult }
public struct FakeDiscordProviderActionClient: DiscordProviderActionClient {
    public init() {};
    public func executeDiscordAction(request: MarketplaceProviderActionAdapterRequest) throws -> DiscordProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "discord_bot_get": fields = ["bot": .object(DiscordProviderActionSupport.fakeBot())];
        case "discord_selected_guild_get": fields = ["guild": .object(DiscordProviderActionSupport.fakeGuild())];
        case "discord_selected_guild_channels_list": fields = ["channels": .array([.object(DiscordProviderActionSupport.fakeChannel())]), "resultCount": .number(1)];
        case "discord_selected_channel_messages_list": fields = ["messages": .array([.object(DiscordProviderActionSupport.fakeMessage())]), "resultCount": .number(1)];
        default: throw MarketplaceProviderActionAdapterFailure(code: "discord_action_not_supported", message: "Unsupported Discord action.")
        }; return DiscordProviderActionClientResult(result: DiscordProviderActionSupport.base("fake-discord-v10").merging(fields) { _, new in new })
    }
}

public final class LiveDiscordProviderActionClient: DiscordProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeDiscordAction(request: MarketplaceProviderActionAdapterRequest) throws -> DiscordProviderActionClientResult {
        let auth = try authorization(request), root: JSONValue, fields: JSONRecord;
        switch request.definition.actionKey {
        case "discord_bot_get": root = try get(token: auth.token, path: "/users/@me"); fields = ["bot": .object(DiscordProviderActionSupport.bot(root))];
        case "discord_selected_guild_get": root = try get(token: auth.token, path: "/guilds/\(auth.guildId)"); fields = ["guild": .object(DiscordProviderActionSupport.guild(root))];
        case "discord_selected_guild_channels_list":
            root = try get(token: auth.token, path: "/guilds/\(auth.guildId)/channels");
            let values = Array(
                DiscordProviderActionSupport.array(root).filter {
                    let r = DiscordProviderActionSupport.object($0); return r["guild_id"]?.stringValue == nil || r["guild_id"]?.stringValue == auth.guildId
                }.prefix(25)
            ).map(DiscordProviderActionSupport.channel); fields = ["channels": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "discord_selected_channel_messages_list":
            root = try get(token: auth.token, path: "/channels/\(auth.channelId)/messages?limit=25"); let raw = Array(DiscordProviderActionSupport.array(root).prefix(25)), values = raw.map(DiscordProviderActionSupport.message);
            guard !values.isEmpty, values.allSatisfy({ $0["channelId"]?.string == auth.channelId }),
                values.contains(where: {
                    guard case .string(let content)? = $0["content"] else { return false }; return !content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                })
            else { throw MarketplaceProviderActionAdapterFailure(code: "discord_message_content_unavailable", message: "Discord Message Content approval and a readable selected channel are required.") };
            fields = ["messages": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        default: throw MarketplaceProviderActionAdapterFailure(code: "discord_live_action_not_supported", message: "Unsupported live Discord action.")
        }; return DiscordProviderActionClientResult(result: DiscordProviderActionSupport.base("live-discord-v10").merging(fields) { _, new in new })
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, guildId: String, channelId: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "discord", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.credentialOwnership == .relayOwned, connection.grantedScopes == ProviderConnectionService.discordRelayOwnedOAuthScopes, connection.health.diagnostics["botInstallOnly"]?.bool == true,
            connection.health.diagnostics["selectedGuildVerified"]?.bool == true, connection.health.diagnostics["selectedChannelVerified"]?.bool == true, connection.health.diagnostics["messageContentEnabled"]?.bool == true, connection.health.diagnostics["requestedPermissions"]?.string == "66560",
            connection.health.diagnostics["writesEnabled"]?.bool == false, connection.health.diagnostics["automaticPagination"]?.bool == false, connection.health.diagnostics["rawToolsEnabled"]?.bool == false, let guild = connection.health.diagnostics["selectedGuildId"]?.string,
            let channel = connection.health.diagnostics["selectedChannelId"]?.string, let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "discord_bot_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "discord_connection_not_ready", message: "Discord requires a ready selected-guild/channel read-only bot connection.") };
        return (try secrets.getSecretValue(ref), try DiscordProviderActionSupport.snowflake(guild, "selectedGuildId"), try DiscordProviderActionSupport.snowflake(channel, "selectedChannelId"))
    }
    private func get(token: String, path: String) throws -> JSONValue {
        guard path.hasPrefix("/"), !path.contains(".."), let url = URL(string: "https://discord.com/api/v10" + path), url.scheme == "https", url.host == "discord.com", url.path.hasPrefix("/api/v10/"),
            url.path == "/api/v10/users/@me" || url.path.hasPrefix("/api/v10/guilds/") || url.path.hasPrefix("/api/v10/channels/")
        else { throw MarketplaceProviderActionAdapterFailure(code: "discord_unsafe_url", message: "Unsafe Discord request.") }; var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = "GET"; request.setValue("Bot \(token)", forHTTPHeaderField: "Authorization");
        request.setValue("application/json", forHTTPHeaderField: "Accept"); request.setValue("RelayConsole/1.0", forHTTPHeaderField: "User-Agent"); let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?;
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() };
            if let error {
                captured = .failure(error)
            } else if let bytes, let response = response as? HTTPURLResponse {
                captured = .success((bytes, response))
            } else {
                captured = .failure(MarketplaceProviderActionAdapterFailure(code: "discord_transport_error", message: "Discord returned no HTTP response."))
            }
        }.resume(); guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "discord_timeout", message: "Discord request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "discord_rate_limited" : "discord_api_error", message: "Discord request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "discord_response_too_large", message: "Discord response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
    }
}
public struct DiscordProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["discord_bot_get", "discord_selected_guild_get", "discord_selected_guild_channels_list", "discord_selected_channel_messages_list"]; private let client: any DiscordProviderActionClient;
    public init(client: any DiscordProviderActionClient = FakeDiscordProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "discord", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "discord_action_not_allowlisted", message: "Discord V1 permits only four selected-guild/channel GET reads.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeDiscordAction(request: request).result, error: nil, redactionStatus: "self-bot-dm-people-media-search-writes-moderation-gateway-webhooks-pagination-raw-excluded")
    }
}

public enum DiscordProviderActionSupport {
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("discord"), "adapterBoundary": .string("discord-provider-action-adapter"), "clientMode": .string(mode), "selectedGuildChannelOnly": .bool(true), "botInstallOnly": .bool(true), "maxResults": .number(25), "writesEnabled": .bool(false),
            "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let record)? = value else { return [:] }; return record }; static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let values)? = value else { return [] }; return values };
    static func scalar(_ value: JSONValue?, _ max: Int = 512) -> JSONValue { guard let value else { return .null }; if case .string(let string) = value { return .string(String(string.prefix(max))) }; if case .number = value { return value }; if case .bool = value { return value }; return .null };
    static func snowflake(_ value: String, _ field: String) throws -> String { guard !value.isEmpty, value.count <= 20, value.allSatisfy(\.isNumber) else { throw MarketplaceProviderActionAdapterFailure(code: "discord_invalid_snowflake", message: "A numeric \(field) is required.") }; return value }
    static func bot(_ value: JSONValue?) -> JSONRecord { let r = object(value); return ["id": scalar(r["id"], 20), "username": scalar(r["username"]), "bot": .bool(true), "emailProfileRelationshipsExcluded": .bool(true)] };
    static func guild(_ value: JSONValue?) -> JSONRecord { let r = object(value); return ["id": scalar(r["id"], 20), "name": scalar(r["name"]), "description": scalar(r["description"], 1000), "features": r["features"] ?? .array([]), "ownerMembersPermissionsExcluded": .bool(true)] };
    static func channel(_ value: JSONValue?) -> JSONRecord {
        let r = object(value); return ["id": scalar(r["id"], 20), "name": scalar(r["name"]), "type": scalar(r["type"]), "topic": scalar(r["topic"], 1000), "position": scalar(r["position"]), "nsfw": scalar(r["nsfw"]), "peoplePermissionsExcluded": .bool(true)]
    };
    static func message(_ value: JSONValue?) -> JSONRecord {
        let r = object(value);
        return [
            "id": scalar(r["id"], 20), "channelId": scalar(r["channel_id"], 20), "content": scalar(r["content"], 4000), "timestamp": scalar(r["timestamp"], 64), "editedTimestamp": scalar(r["edited_timestamp"], 64), "type": scalar(r["type"]), "authorMentionsExcluded": .bool(true),
            "attachmentsEmbedsExcluded": .bool(true), "reactionsPollsComponentsExcluded": .bool(true),
        ]
    }
    static func fakeBot() -> JSONRecord { ["id": .string("100000000000000001"), "username": .string("Relay"), "bot": .bool(true), "emailProfileRelationshipsExcluded": .bool(true)] };
    static func fakeGuild() -> JSONRecord { ["id": .string("200000000000000001"), "name": .string("Product Team"), "description": .string("Product collaboration server"), "features": .array([.string("COMMUNITY")]), "ownerMembersPermissionsExcluded": .bool(true)] };
    static func fakeChannel() -> JSONRecord { ["id": .string("300000000000000001"), "name": .string("launch-updates"), "type": .number(0), "topic": .string("Launch milestones and risk updates"), "position": .number(3), "nsfw": .bool(false), "peoplePermissionsExcluded": .bool(true)] };
    static func fakeMessage() -> JSONRecord {
        [
            "id": .string("400000000000000001"), "channelId": .string("300000000000000001"), "content": .string("Launch readiness review is Friday; please update open risks by Thursday."), "timestamp": .string("2026-07-12T09:30:00Z"), "editedTimestamp": .null, "type": .number(0),
            "authorMentionsExcluded": .bool(true), "attachmentsEmbedsExcluded": .bool(true), "reactionsPollsComponentsExcluded": .bool(true),
        ]
    }
}

private extension JSONValue { var stringValue: String? { switch self { case .string(let value): return value; case .number(let value): return value.rounded() == value ? String(Int64(value)) : String(value); default: return nil } } }
