import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct YouTubeProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol YouTubeProviderActionClient: Sendable { func executeYouTubeAction(request: MarketplaceProviderActionAdapterRequest) throws -> YouTubeProviderActionClientResult }

public struct FakeYouTubeProviderActionClient: YouTubeProviderActionClient {
  public init() {}
  public func executeYouTubeAction(request: MarketplaceProviderActionAdapterRequest) throws -> YouTubeProviderActionClientResult {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "youtube_channels_list_mine": fields = ["channels": .array([.object(YouTubeProviderActionSupport.fakeChannel())]), "resultCount": .number(1)]
    case "youtube_playlists_list_mine": _ = try YouTubeProviderActionSupport.maxResults(request.payload["maxResults"]); fields = ["playlists": .array([.object(YouTubeProviderActionSupport.fakePlaylist())]), "resultCount": .number(1)]
        case "youtube_playlist_items_list":
            _ = try YouTubeProviderActionSupport.resourceId(request.payload["playlistId"], field: "playlistId"); _ = try YouTubeProviderActionSupport.maxResults(request.payload["maxResults"]);
            fields = ["playlistItems": .array([.object(YouTubeProviderActionSupport.fakePlaylistItem())]), "resultCount": .number(1)]
    case "youtube_videos_list": _ = try YouTubeProviderActionSupport.videoIds(request.payload["videoIds"]); fields = ["videos": .array([.object(YouTubeProviderActionSupport.fakeVideo())]), "resultCount": .number(1)]
    default: throw MarketplaceProviderActionAdapterFailure(code: "youtube_action_not_supported", message: "Unsupported YouTube action.")
    }
    return YouTubeProviderActionClientResult(result: YouTubeProviderActionSupport.base("fake-youtube-data-api").merging(fields) { _, new in new })
  }
}

public final class LiveYouTubeProviderActionClient: YouTubeProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeYouTubeAction(request: MarketplaceProviderActionAdapterRequest) throws -> YouTubeProviderActionClientResult {
    let token = try authorization(request), root: JSONValue, fields: JSONRecord
    switch request.definition.actionKey {
    case "youtube_channels_list_mine":
            root = try send(token: token, path: "/channels", query: ["part": "snippet,contentDetails,statistics,status", "mine": "true", "maxResults": "1"]); let values = YouTubeProviderActionSupport.records(root).map(YouTubeProviderActionSupport.channel);
            fields = ["channels": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count))]
    case "youtube_playlists_list_mine":
            let maximum = try YouTubeProviderActionSupport.maxResults(request.payload["maxResults"]); root = try send(token: token, path: "/playlists", query: ["part": "snippet,contentDetails,status", "mine": "true", "maxResults": String(maximum)]);
            let values = YouTubeProviderActionSupport.records(root).map(YouTubeProviderActionSupport.playlist);
            fields = ["playlists": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageToken": YouTubeProviderActionSupport.scalar(YouTubeProviderActionSupport.object(root)["nextPageToken"]), "nextPageFollowed": .bool(false)]
    case "youtube_playlist_items_list":
            let playlist = try YouTubeProviderActionSupport.resourceId(request.payload["playlistId"], field: "playlistId"), maximum = try YouTubeProviderActionSupport.maxResults(request.payload["maxResults"]);
            root = try send(token: token, path: "/playlistItems", query: ["part": "snippet,contentDetails,status", "playlistId": playlist, "maxResults": String(maximum)]); let values = YouTubeProviderActionSupport.records(root).map(YouTubeProviderActionSupport.playlistItem);
            fields = [
                "playlistId": .string(playlist), "playlistItems": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageToken": YouTubeProviderActionSupport.scalar(YouTubeProviderActionSupport.object(root)["nextPageToken"]), "nextPageFollowed": .bool(false),
            ]
    case "youtube_videos_list":
            let ids = try YouTubeProviderActionSupport.videoIds(request.payload["videoIds"]); root = try send(token: token, path: "/videos", query: ["part": "snippet,contentDetails,statistics,status", "id": ids.joined(separator: ",")]);
            let values = YouTubeProviderActionSupport.records(root).map(YouTubeProviderActionSupport.video); fields = ["videos": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count))]
    default: throw MarketplaceProviderActionAdapterFailure(code: "youtube_live_action_not_supported", message: "Unsupported live YouTube action.")
    }
    return YouTubeProviderActionClientResult(result: YouTubeProviderActionSupport.base("live-youtube-data-api").merging(fields) { _, new in new })
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "youtube", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.youTubeRelayOwnedOAuthScopes, connection.health.diagnostics["apiOrigin"]?.string == YouTubeProviderActionSupport.origin, connection.health.diagnostics["readOnlyV1"]?.bool == true,
            connection.health.diagnostics["writesEnabled"]?.bool == false, connection.health.diagnostics["searchEnabled"]?.bool == false, connection.health.diagnostics["historyEnabled"]?.bool == false, connection.health.diagnostics["automaticPagination"]?.bool == false,
            connection.health.diagnostics["rawToolsEnabled"]?.bool == false, let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "youtube_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "youtube_connection_not_ready", message: "YouTube requires a ready exact-scope read-only connected-channel OAuth grant.") }
    return try secrets.getSecretValue(ref)
  }
  private func send(token: String, path: String, query: [String: String]) throws -> JSONValue {
    var components = URLComponents(string: YouTubeProviderActionSupport.origin + path); components?.queryItems = query.sorted { $0.key < $1.key }.map(URLQueryItem.init)
        guard let url = components?.url, url.scheme == "https", url.host == "www.googleapis.com", url.path.hasPrefix("/youtube/v3/"), ["/youtube/v3/channels", "/youtube/v3/playlists", "/youtube/v3/playlistItems", "/youtube/v3/videos"].contains(url.path), query["pageToken"] == nil, query["q"] == nil
        else { throw MarketplaceProviderActionAdapterFailure(code: "youtube_unsafe_url", message: "Unsafe YouTube Data API request.") }
    var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = "GET"; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "youtube_transport_error", message: "YouTube returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume()
    guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "youtube_timeout", message: "YouTube request timed out.") }
        let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "youtube_rate_limited" : "youtube_api_error", message: "YouTube Data API request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "youtube_response_too_large", message: "YouTube response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct YouTubeProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["youtube_channels_list_mine", "youtube_playlists_list_mine", "youtube_playlist_items_list", "youtube_videos_list"]
  private let client: any YouTubeProviderActionClient
  public init(client: any YouTubeProviderActionClient = FakeYouTubeProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "youtube", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "youtube_action_not_allowlisted", message: "YouTube V1 permits only four bounded reads.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeYouTubeAction(request: request).result, error: nil, redactionStatus: "search-history-mutations-pagination-analytics-partner-raw-excluded")
    }
}

public enum YouTubeProviderActionSupport {
  public static let origin = "https://www.googleapis.com/youtube/v3"
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("youtube"), "adapterBoundary": .string("youtube-provider-action-adapter"), "clientMode": .string(mode), "readOnlyV1": .bool(true), "connectedChannelOnly": .bool(true), "maxResults": .number(25), "writesEnabled": .bool(false), "searchEnabled": .bool(false),
            "historyEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false), "youtubeAttributionRequired": .bool(true),
        ]
    }
  static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let record)? = value else { return [:] }; return record }
  static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let values)? = value else { return [] }; return values }
  static func scalar(_ value: JSONValue?, maximum: Int = 512) -> JSONValue { guard let value else { return .null }; if case .string(let text) = value { return .string(String(text.prefix(maximum))) }; if case .number = value { return value }; if case .bool = value { return value }; return .null }
  static func records(_ root: JSONValue?) -> [JSONValue] { Array(array(object(root)["items"]).prefix(25)) }
    public static func maxResults(_ value: JSONValue?) throws -> Int {
        guard let value else { return 25 }; guard let number = value.number, number.rounded() == number, (1...25).contains(Int(number)) else { throw MarketplaceProviderActionAdapterFailure(code: "youtube_invalid_max_results", message: "maxResults must be an integer from 1 through 25.") };
        return Int(number)
    }
    public static func resourceId(_ value: JSONValue?, field: String) throws -> String {
        guard let text = value?.string, !text.isEmpty, text.count <= 128, text.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }) else { throw MarketplaceProviderActionAdapterFailure(code: "youtube_invalid_resource_id", message: "An explicit safe YouTube \(field) is required.") };
        return text
    }
    public static func videoIds(_ value: JSONValue?) throws -> [String] {
        guard case .array(let values)? = value else { throw MarketplaceProviderActionAdapterFailure(code: "youtube_video_ids_required", message: "videoIds must contain 1 through 25 explicit IDs.") }; let ids = try values.map { try resourceId($0, field: "videoId") };
        guard (1...25).contains(ids.count), Set(ids).count == ids.count else { throw MarketplaceProviderActionAdapterFailure(code: "youtube_invalid_video_ids", message: "videoIds must contain 1 through 25 unique explicit IDs.") }; return ids
    }
    static func channel(_ value: JSONValue) -> JSONRecord {
        let r = object(value), s = object(r["snippet"]), c = object(r["contentDetails"]), related = object(c["relatedPlaylists"]), stats = object(r["statistics"]), status = object(r["status"]);
        return [
            "id": scalar(r["id"], maximum: 128), "title": scalar(s["title"]), "description": scalar(s["description"], maximum: 2000), "customUrl": scalar(s["customUrl"], maximum: 256), "country": scalar(s["country"], maximum: 8), "uploadsPlaylistId": scalar(related["uploads"], maximum: 128),
            "viewCount": scalar(stats["viewCount"]), "subscriberCount": scalar(stats["subscriberCount"]), "hiddenSubscriberCount": scalar(stats["hiddenSubscriberCount"]), "videoCount": scalar(stats["videoCount"]), "privacyStatus": scalar(status["privacyStatus"], maximum: 32),
            "isLinked": scalar(status["isLinked"]), "madeForKids": scalar(status["madeForKids"]),
        ]
    }
    static func playlist(_ value: JSONValue) -> JSONRecord {
        let r = object(value), s = object(r["snippet"]), c = object(r["contentDetails"]), status = object(r["status"]);
        return [
            "id": scalar(r["id"], maximum: 128), "title": scalar(s["title"]), "description": scalar(s["description"], maximum: 2000), "publishedAt": scalar(s["publishedAt"], maximum: 64), "channelTitle": scalar(s["channelTitle"]), "itemCount": scalar(c["itemCount"]),
            "privacyStatus": scalar(status["privacyStatus"], maximum: 32),
        ]
    }
    static func playlistItem(_ value: JSONValue) -> JSONRecord {
        let r = object(value), s = object(r["snippet"]), c = object(r["contentDetails"]), status = object(r["status"]), resource = object(s["resourceId"]);
        return [
            "id": scalar(r["id"], maximum: 128), "videoId": scalar(c["videoId"] ?? resource["videoId"], maximum: 128), "title": scalar(s["title"]), "description": scalar(s["description"], maximum: 2000), "publishedAt": scalar(s["publishedAt"], maximum: 64), "position": scalar(s["position"]),
            "channelTitle": scalar(s["channelTitle"]), "videoOwnerChannelTitle": scalar(s["videoOwnerChannelTitle"]), "privacyStatus": scalar(status["privacyStatus"], maximum: 32),
        ]
    }
    static func video(_ value: JSONValue) -> JSONRecord {
        let r = object(value), s = object(r["snippet"]), c = object(r["contentDetails"]), stats = object(r["statistics"]), status = object(r["status"]);
        return [
            "id": scalar(r["id"], maximum: 128), "title": scalar(s["title"]), "description": scalar(s["description"], maximum: 2000), "publishedAt": scalar(s["publishedAt"], maximum: 64), "channelTitle": scalar(s["channelTitle"]),
            "tags": .array(Array(array(s["tags"]).prefix(25)).map { scalar($0, maximum: 100) }), "liveBroadcastContent": scalar(s["liveBroadcastContent"], maximum: 32), "duration": scalar(c["duration"], maximum: 64), "caption": scalar(c["caption"], maximum: 16),
            "definition": scalar(c["definition"], maximum: 16), "privacyStatus": scalar(status["privacyStatus"], maximum: 32), "license": scalar(status["license"], maximum: 32), "embeddable": scalar(status["embeddable"]), "viewCount": scalar(stats["viewCount"]),
            "likeCount": scalar(stats["likeCount"]), "commentCount": scalar(stats["commentCount"]),
        ]
    }
    public static func fakeChannel() -> JSONRecord {
        [
            "id": .string("UCRelayExample"), "title": .string("Relay Example Channel"), "description": .string("Product walkthroughs and creator updates."), "customUrl": .string("@relayexample"), "country": .string("GB"), "uploadsPlaylistId": .string("UURelayExample"), "viewCount": .string("12500"),
            "subscriberCount": .string("840"), "hiddenSubscriberCount": .bool(false), "videoCount": .string("24"), "privacyStatus": .string("public"), "isLinked": .bool(true), "madeForKids": .bool(false),
        ]
    }
    public static func fakePlaylist() -> JSONRecord {
        ["id": .string("PLRelayExample"), "title": .string("Product walkthroughs"), "description": .string("Bounded creator playlist."), "publishedAt": .string("2026-07-01T09:00:00Z"), "channelTitle": .string("Relay Example Channel"), "itemCount": .number(12), "privacyStatus": .string("public")]
    }
    public static func fakePlaylistItem() -> JSONRecord {
        [
            "id": .string("PLIExample"), "videoId": .string("VideoExample1"), "title": .string("Relay Console walkthrough"), "description": .string("A practical overview of Relay Console."), "publishedAt": .string("2026-07-10T12:00:00Z"), "position": .number(0),
            "channelTitle": .string("Relay Example Channel"), "videoOwnerChannelTitle": .string("Relay Example Channel"), "privacyStatus": .string("public"),
        ]
    }
    public static func fakeVideo() -> JSONRecord {
        [
            "id": .string("VideoExample1"), "title": .string("Relay Console walkthrough"), "description": .string("A practical overview of Relay Console."), "publishedAt": .string("2026-07-10T12:00:00Z"), "channelTitle": .string("Relay Example Channel"),
            "tags": .array([.string("relay"), .string("agents")]), "liveBroadcastContent": .string("none"), "duration": .string("PT8M14S"), "caption": .string("true"), "definition": .string("hd"), "privacyStatus": .string("public"), "license": .string("youtube"), "embeddable": .bool(true),
            "viewCount": .string("3100"), "likeCount": .string("220"), "commentCount": .string("18"),
        ]
    }
}
