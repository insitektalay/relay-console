import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct ZoomProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol ZoomProviderActionClient: Sendable { func executeZoomAction(request: MarketplaceProviderActionAdapterRequest) throws -> ZoomProviderActionClientResult }

public struct FakeZoomProviderActionClient: ZoomProviderActionClient {
  public init() {}
    public func executeZoomAction(request: MarketplaceProviderActionAdapterRequest) throws -> ZoomProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "zoom_scheduled_meetings_list": fields = ["meetings": .array([.object(ZoomProviderActionSupport.fakeMeeting(status: "waiting"))]), "resultCount": .number(1), "meetingSet": .string("scheduled")];
        case "zoom_live_meetings_list": fields = ["meetings": .array([.object(ZoomProviderActionSupport.fakeMeeting(status: "started"))]), "resultCount": .number(1), "meetingSet": .string("live")];
        case "zoom_upcoming_meetings_list": fields = ["meetings": .array([.object(ZoomProviderActionSupport.fakeMeeting(status: "waiting"))]), "resultCount": .number(1), "meetingSet": .string("next-24-hours")];
        case "zoom_meeting_get": _ = try ZoomProviderActionSupport.meetingId(request.payload["meetingId"]); fields = ["meeting": .object(ZoomProviderActionSupport.fakeMeeting(status: "waiting"))];
        default: throw MarketplaceProviderActionAdapterFailure(code: "zoom_action_not_supported", message: "Unsupported Zoom action.")
        }; return ZoomProviderActionClientResult(result: ZoomProviderActionSupport.base("fake-zoom-v2").merging(fields) { _, new in new })
    }
}

public final class LiveZoomProviderActionClient: ZoomProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeZoomAction(request: MarketplaceProviderActionAdapterRequest) throws -> ZoomProviderActionClientResult {
        let token = try authorization(request), root: JSONValue, fields: JSONRecord;
        switch request.definition.actionKey {
        case "zoom_scheduled_meetings_list": root = try get(token: token, path: "/users/me/meetings?type=scheduled&page_size=25"); fields = ZoomProviderActionSupport.meetingList(root, set: "scheduled");
        case "zoom_live_meetings_list": root = try get(token: token, path: "/users/me/meetings?type=live&page_size=25"); fields = ZoomProviderActionSupport.meetingList(root, set: "live");
        case "zoom_upcoming_meetings_list": root = try get(token: token, path: "/users/me/upcoming_meetings?page_size=25"); fields = ZoomProviderActionSupport.meetingList(root, set: "next-24-hours");
        case "zoom_meeting_get": let id = try ZoomProviderActionSupport.meetingId(request.payload["meetingId"]); root = try get(token: token, path: "/meetings/\(id)"); fields = ["meeting": .object(ZoomProviderActionSupport.meeting(root))];
        default: throw MarketplaceProviderActionAdapterFailure(code: "zoom_live_action_not_supported", message: "Unsupported live Zoom action.")
        }; return ZoomProviderActionClientResult(result: ZoomProviderActionSupport.base("live-zoom-v2").merging(fields) { _, new in new })
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "zoom", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.credentialOwnership == .relayOwned, connection.grantedScopes == ProviderConnectionService.zoomRelayOwnedOAuthScopes, connection.health.diagnostics["apiOrigin"]?.string == "https://api.zoom.us/v2",
            connection.health.diagnostics["userManagedOnly"]?.bool == true, connection.health.diagnostics["selfUserOnly"]?.bool == true, connection.health.diagnostics["metadataOnly"]?.bool == true, connection.health.diagnostics["joinStartCredentialsEnabled"]?.bool == false,
            connection.health.diagnostics["peopleContentEnabled"]?.bool == false, connection.health.diagnostics["writesEnabled"]?.bool == false, connection.health.diagnostics["automaticPagination"]?.bool == false, connection.health.diagnostics["rawToolsEnabled"]?.bool == false,
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "zoom_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "zoom_connection_not_ready", message: "Zoom requires a ready exact-scope self-user metadata-only connection.") }; return try secrets.getSecretValue(ref)
    }
    private func get(token: String, path: String) throws -> JSONValue {
        guard path.hasPrefix("/"), !path.contains(".."), let url = URL(string: "https://api.zoom.us/v2" + path), url.scheme == "https", url.host == "api.zoom.us", url.path.hasPrefix("/v2/"),
            url.path == "/v2/users/me/meetings" || url.path == "/v2/users/me/upcoming_meetings" || url.path.hasPrefix("/v2/meetings/")
        else { throw MarketplaceProviderActionAdapterFailure(code: "zoom_unsafe_url", message: "Unsafe Zoom request.") }; var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = "GET"; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization");
        request.setValue("application/json", forHTTPHeaderField: "Accept"); let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?;
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() };
            if let error {
                captured = .failure(error)
            } else if let bytes, let response = response as? HTTPURLResponse {
                captured = .success((bytes, response))
            } else {
                captured = .failure(MarketplaceProviderActionAdapterFailure(code: "zoom_transport_error", message: "Zoom returned no HTTP response."))
            }
        }.resume(); guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "zoom_timeout", message: "Zoom request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "zoom_rate_limited" : "zoom_api_error", message: "Zoom request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "zoom_response_too_large", message: "Zoom response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
    }
}

public struct ZoomProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["zoom_scheduled_meetings_list", "zoom_live_meetings_list", "zoom_upcoming_meetings_list", "zoom_meeting_get"]; private let client: any ZoomProviderActionClient;
    public init(client: any ZoomProviderActionClient = FakeZoomProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "zoom", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "zoom_action_not_allowlisted", message: "Zoom V1 permits only four self-user meeting metadata GET reads.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeZoomAction(request: request).result, error: nil, redactionStatus: "join-start-credentials-people-content-recordings-transcripts-chat-admin-writes-pagination-raw-excluded")
    }
}

public enum ZoomProviderActionSupport {
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("zoom"), "adapterBoundary": .string("zoom-provider-action-adapter"), "clientMode": .string(mode), "selfUserOnly": .bool(true), "metadataOnly": .bool(true), "maxResults": .number(25), "writesEnabled": .bool(false), "automaticPagination": .bool(false),
            "rawProviderToolExposure": .bool(false),
        ]
    }
    static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let record)? = value else { return [:] }; return record }; static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let values)? = value else { return [] }; return values };
    static func scalar(_ value: JSONValue?, _ max: Int = 512) -> JSONValue { guard let value else { return .null }; if case .string(let string) = value { return .string(String(string.prefix(max))) }; if case .number = value { return value }; if case .bool = value { return value }; return .null }
    static func meetingId(_ value: JSONValue?) throws -> String {
        let raw: String?;
        switch value {
        case .string(let text)?: raw = text;
        case .number(let number)?: raw = number.rounded() == number ? String(Int64(number)) : nil;
        default: raw = nil
        }; guard let raw, !raw.isEmpty, raw.count <= 32, raw.allSatisfy(\.isNumber) else { throw MarketplaceProviderActionAdapterFailure(code: "zoom_invalid_meeting_id", message: "An explicit numeric prior-result meetingId is required.") }; return raw
    }
    static func meeting(_ value: JSONValue?) -> JSONRecord {
        let r = object(value);
        return [
            "id": scalar(r["id"], 32), "topic": scalar(r["topic"], 512), "agenda": scalar(r["agenda"], 1000), "type": scalar(r["type"]), "status": scalar(r["status"], 64), "startTime": scalar(r["start_time"], 64), "durationMinutes": scalar(r["duration"]), "timeZone": scalar(r["timezone"], 128),
            "joinStartCredentialsExcluded": .bool(true), "hostPeopleExcluded": .bool(true), "contentAssetsExcluded": .bool(true),
        ]
    }
    static func meetingList(_ root: JSONValue?, set: String) -> JSONRecord {
        let records = Array(array(object(root)["meetings"]).prefix(25)).map(meeting); return ["meetings": .array(records.map(JSONValue.object)), "resultCount": .number(Double(records.count)), "meetingSet": .string(set), "nextPageFollowed": .bool(false)]
    }
    static func fakeMeeting(status: String) -> JSONRecord {
        [
            "id": .string("9876543210"), "topic": .string("Launch readiness review"), "agenda": .string("Review launch risks and owner updates."), "type": .number(2), "status": .string(status), "startTime": .string("2026-07-13T09:00:00Z"), "durationMinutes": .number(45),
            "timeZone": .string("Europe/London"), "joinStartCredentialsExcluded": .bool(true), "hostPeopleExcluded": .bool(true), "contentAssetsExcluded": .bool(true),
        ]
    }
}
