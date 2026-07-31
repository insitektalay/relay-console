import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct GooglePhotosProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol GooglePhotosProviderActionClient: Sendable { func executeGooglePhotosAction(request: MarketplaceProviderActionAdapterRequest) throws -> GooglePhotosProviderActionClientResult }

public struct FakeGooglePhotosProviderActionClient: GooglePhotosProviderActionClient {
  public init() {}
  public func executeGooglePhotosAction(request: MarketplaceProviderActionAdapterRequest) throws -> GooglePhotosProviderActionClientResult {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_photos_picker_session_create": fields = ["semanticWriteContract": .string("google-photos-picker-session-create-v1"), "providerMutation": .bool(true), "session": .object(GooglePhotosProviderActionSupport.fakeSession())]
    case "google_photos_picker_session_get": fields = ["semanticReadContract": .string("google-photos-picker-session-v1"), "session": .object(GooglePhotosProviderActionSupport.fakeSession())]
    case "google_photos_picked_media_list": fields = ["semanticReadContract": .string("google-photos-picked-media-metadata-v1"), "mediaItems": .array([.object(GooglePhotosProviderActionSupport.fakeMediaItem())]), "nextPageAvailable": .bool(false)]
    case "google_photos_picker_session_delete": fields = ["semanticWriteContract": .string("google-photos-picker-session-cleanup-v1"), "providerMutation": .bool(true), "sessionDeleted": .bool(true), "userMediaDeleted": .bool(false)]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_photos_action_not_supported", message: "Unsupported Google Photos Picker action.")
    }
    return GooglePhotosProviderActionClientResult(result: GooglePhotosProviderActionSupport.base("fake-picker-api-v1").merging(fields) { _, new in new })
  }
}

public final class LiveGooglePhotosProviderActionClient: GooglePhotosProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService; private let sessionMutationLock = NSLock()
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeGooglePhotosAction(request: MarketplaceProviderActionAdapterRequest) throws -> GooglePhotosProviderActionClientResult {
    let token = try authorization(request); let root: JSONValue; let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_photos_picker_session_create":
      sessionMutationLock.lock(); defer { sessionMutationLock.unlock() }
      let count = try GooglePhotosProviderActionSupport.maxItemCount(request.payload["maxItemCount"])
      root = try send(token: token, method: "POST", path: "/sessions", query: [], body: ["pickingConfig": .object(["maxItemCount": .string(String(count))])])
      fields = ["semanticWriteContract": .string("google-photos-picker-session-create-v1"), "providerMutation": .bool(true), "session": .object(try GooglePhotosProviderActionSupport.session(root))]
    case "google_photos_picker_session_get":
      let id = try GooglePhotosProviderActionSupport.sessionId(request.payload["sessionId"])
      root = try send(token: token, method: "GET", path: "/sessions/\(GooglePhotosProviderActionSupport.path(id))", query: [], body: nil)
      fields = ["semanticReadContract": .string("google-photos-picker-session-v1"), "session": .object(try GooglePhotosProviderActionSupport.session(root))]
    case "google_photos_picked_media_list":
      let id = try GooglePhotosProviderActionSupport.sessionId(request.payload["sessionId"])
      root = try send(token: token, method: "GET", path: "/mediaItems", query: [URLQueryItem(name: "sessionId", value: id), URLQueryItem(name: "pageSize", value: "25")], body: nil)
      let record = GooglePhotosProviderActionSupport.object(root), items = GooglePhotosProviderActionSupport.array(record["mediaItems"]).prefix(25).map { JSONValue.object(GooglePhotosProviderActionSupport.mediaItem($0)) }
      fields = ["semanticReadContract": .string("google-photos-picked-media-metadata-v1"), "mediaItems": .array(Array(items)), "nextPageAvailable": .bool(record["nextPageToken"] != nil)]
    case "google_photos_picker_session_delete":
      sessionMutationLock.lock(); defer { sessionMutationLock.unlock() }
      let id = try GooglePhotosProviderActionSupport.sessionId(request.payload["sessionId"])
      root = try send(token: token, method: "DELETE", path: "/sessions/\(GooglePhotosProviderActionSupport.path(id))", query: [], body: nil); _ = root
      fields = ["semanticWriteContract": .string("google-photos-picker-session-cleanup-v1"), "providerMutation": .bool(true), "sessionDeleted": .bool(true), "userMediaDeleted": .bool(false)]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_photos_live_action_not_supported", message: "Unsupported live Google Photos Picker action.")
    }
    return GooglePhotosProviderActionClientResult(result: GooglePhotosProviderActionSupport.base("live-picker-api-v1").merging(fields) { _, new in new })
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "google-photos", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.googlePhotosRelayOwnedOAuthScopes, connection.health.diagnostics["pickerOnly"]?.bool == true, connection.health.diagnostics["userSelectionRequired"]?.bool == true,
            connection.health.diagnostics["libraryAPIEnabled"]?.bool == false, connection.health.diagnostics["removedLibraryScopesEnabled"]?.bool == false, connection.health.diagnostics["rawMediaBytesEnabled"]?.bool == false, connection.health.diagnostics["baseURLReturnedToAgents"]?.bool == false,
            connection.health.diagnostics["automaticPolling"]?.bool == false, connection.health.diagnostics["automaticPagination"]?.bool == false, let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "google_photos_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "google_photos_connection_not_ready", message: "Google Photos requires a ready exact-scope Picker-only Relay-owned connection.") }; return try secrets.getSecretValue(ref)
  }
  private func send(token: String, method: String, path: String, query: [URLQueryItem], body: JSONRecord?) throws -> JSONValue {
    var components = URLComponents(string: GooglePhotosProviderActionSupport.apiOrigin + path)!; components.queryItems = query
    guard let url = components.url, url.scheme == "https", url.host == "photospicker.googleapis.com", url.path.hasPrefix("/v1/") else { throw MarketplaceProviderActionAdapterFailure(code: "google_photos_unsafe_url", message: "Unsafe Google Photos Picker API URL.") }
        var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = method; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization");
        if let body { request.httpBody = try JSONEncoder().encode(JSONValue.object(body)); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "google_photos_transport_error", message: "Google Photos Picker returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume()
        guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "google_photos_timeout", message: "Google Photos Picker request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 429 ? "google_photos_rate_limited" : response.statusCode == 400 ? "google_photos_invalid_or_incomplete_session" : "google_photos_api_error", message: "Google Photos Picker request failed.", providerStatusCode: response.statusCode)
        }; guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_photos_response_too_large", message: "Google Photos Picker response exceeded the 1 MB bound.") }; if bytes.isEmpty { return .object([:]) };
        return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct GooglePhotosProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["google_photos_picker_session_create", "google_photos_picker_session_get", "google_photos_picked_media_list", "google_photos_picker_session_delete"]
  private let client: any GooglePhotosProviderActionClient
  public init(client: any GooglePhotosProviderActionClient = FakeGooglePhotosProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "google-photos", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "google_photos_action_not_allowlisted", message: "Google Photos action is not allowlisted.") };
        let mutation = ["google_photos_picker_session_create", "google_photos_picker_session_delete"].contains(request.definition.actionKey);
        guard mutation ? request.permission != .blocked : request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "google_photos_permission_denied", message: "Google Photos action is not permitted by policy.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeGooglePhotosAction(request: request).result, error: nil, redactionStatus: "raw-media-base-url-camera-exif-library-data-page-tokens-excluded")
    }
}

public enum GooglePhotosProviderActionSupport {
  public static let apiOrigin = "https://photospicker.googleapis.com/v1"
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("google-photos"), "adapterBoundary": .string("google-photos-picker-provider-action-adapter"), "clientMode": .string(mode), "pickerOnly": .bool(true), "userSelectionRequired": .bool(true), "libraryAPIEnabled": .bool(false), "removedLibraryScopesEnabled": .bool(false),
            "rawMediaBytesReturned": .bool(false), "baseURLReturnedToAgents": .bool(false), "cameraExifReturned": .bool(false), "automaticPolling": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let value)? = value else { return [:] }; return value }; static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let value)? = value else { return [] }; return value };
    static func scalar(_ value: JSONValue?, maximum: Int = 1024) -> JSONValue {
        guard let value else { return .null };
        switch value {
        case .string(let text): return .string(String(text.prefix(maximum)));
        case .number, .bool, .null: return value;
        default: return .null
        }
    }
  static func path(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_~"))) ?? value }
    static func sessionId(_ value: JSONValue?) throws -> String {
        guard let value = value?.string, !value.isEmpty, value.count <= 512, value.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_photos_invalid_session_id", message: "An explicit bounded Picker session ID is required.")
        }; return value
    }
    static func maxItemCount(_ value: JSONValue?) throws -> Int {
        let count: Int; if case .number(let number)? = value { count = Int(number) } else if let text = value?.string, let parsed = Int(text) { count = parsed } else { count = 25 };
        guard (1...25).contains(count) else { throw MarketplaceProviderActionAdapterFailure(code: "google_photos_invalid_max_item_count", message: "Picker maxItemCount must be between 1 and 25.") }; return count
    }
    static func safePickerURI(_ value: JSONValue?) throws -> JSONValue {
        guard let raw = value?.string, raw.count <= 2048, let url = URL(string: raw), url.scheme == "https", let host = url.host?.lowercased(), host == "photos.google.com" || host.hasSuffix(".photos.google.com") else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_photos_invalid_picker_uri", message: "Picker returned an unsafe URI.")
        }; return .string(raw)
    }
    static func session(_ value: JSONValue?) throws -> JSONRecord {
        let record = object(value), polling = object(record["pollingConfig"]), config = object(record["pickingConfig"]);
        return [
            "id": scalar(record["id"], maximum: 512), "pickerUri": try safePickerURI(record["pickerUri"]), "expireTime": scalar(record["expireTime"], maximum: 64), "mediaItemsSet": scalar(record["mediaItemsSet"]), "pollInterval": scalar(polling["pollInterval"], maximum: 32),
            "timeoutIn": scalar(polling["timeoutIn"], maximum: 32), "maxItemCount": scalar(config["maxItemCount"], maximum: 8), "iframeAllowed": .bool(false), "automaticPolling": .bool(false),
        ]
    }
    static func mediaItem(_ value: JSONValue?) -> JSONRecord {
        let record = object(value), file = object(record["mediaFile"]), metadata = object(file["mediaFileMetadata"]);
        return [
            "id": scalar(record["id"], maximum: 512), "createTime": scalar(record["createTime"], maximum: 64), "type": scalar(record["type"], maximum: 32), "mimeType": scalar(file["mimeType"], maximum: 128), "filename": scalar(file["filename"], maximum: 512), "width": scalar(metadata["width"]),
            "height": scalar(metadata["height"]), "baseURLReturned": .bool(false), "rawMediaBytesReturned": .bool(false), "cameraExifReturned": .bool(false),
        ]
    }
    public static func fakeSession() -> JSONRecord {
        [
            "id": .string("picker-session-1"), "pickerUri": .string("https://photos.google.com/picker/session-1"), "expireTime": .string("2026-07-12T03:00:00Z"), "mediaItemsSet": .bool(true), "pollInterval": .string("5s"), "timeoutIn": .string("300s"), "maxItemCount": .string("25"),
            "iframeAllowed": .bool(false), "automaticPolling": .bool(false),
        ]
    }
    public static func fakeMediaItem() -> JSONRecord {
        [
            "id": .string("picked-media-1"), "createTime": .string("2026-07-01T12:00:00Z"), "type": .string("PHOTO"), "mimeType": .string("image/jpeg"), "filename": .string("holiday.jpg"), "width": .number(2048), "height": .number(1365), "baseURLReturned": .bool(false),
            "rawMediaBytesReturned": .bool(false), "cameraExifReturned": .bool(false),
        ]
    }
}
