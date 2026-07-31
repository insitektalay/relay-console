import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct GoogleMeetProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol GoogleMeetProviderActionClient: Sendable { func executeGoogleMeetAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleMeetProviderActionClientResult }

public struct FakeGoogleMeetProviderActionClient: GoogleMeetProviderActionClient {
  public init() {}
  public func executeGoogleMeetAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleMeetProviderActionClientResult {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_meet_space_get": fields = ["semanticReadContract": .string("google-meet-app-created-space-v1"), "space": .object(GoogleMeetProviderActionSupport.fakeSpace())]
    case "google_meet_space_update_prepare": fields = ["semanticDraftContract": .string("google-meet-safe-space-update-prepare-v1"), "draftPreview": .object(try GoogleMeetProviderActionSupport.validatedPreview(request.payload)), "providerMutation": .bool(false)]
        case "google_meet_space_create", "google_meet_space_patch":
            fields = ["semanticWriteContract": .string(request.definition.actionKey == "google_meet_space_create" ? "google-meet-safe-space-create-v1" : "google-meet-safe-space-patch-v1"), "providerMutation": .bool(true), "space": .object(GoogleMeetProviderActionSupport.fakeSpace())]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_meet_action_not_supported", message: "Unsupported Google Meet action.")
    }
    return GoogleMeetProviderActionClientResult(result: GoogleMeetProviderActionSupport.base("fake-meet-api-v2").merging(fields) { _, new in new })
  }
}

public final class LiveGoogleMeetProviderActionClient: GoogleMeetProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService; private let mutationLock = NSLock()
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeGoogleMeetAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleMeetProviderActionClientResult {
        if request.definition.actionKey == "google_meet_space_update_prepare" {
            return GoogleMeetProviderActionClientResult(
                result: GoogleMeetProviderActionSupport.base("local-no-provider-request").merging([
                    "semanticDraftContract": .string("google-meet-safe-space-update-prepare-v1"), "draftPreview": .object(try GoogleMeetProviderActionSupport.validatedPreview(request.payload)), "providerMutation": .bool(false),
                ]) { _, new in new })
        }
    let token = try authorization(request); let root: JSONValue; let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_meet_space_get":
      let name = try GoogleMeetProviderActionSupport.spaceName(request.payload["spaceName"])
      root = try send(token: token, method: "GET", path: "/\(GoogleMeetProviderActionSupport.path(name))", query: [], body: nil)
      fields = ["semanticReadContract": .string("google-meet-app-created-space-v1"), "space": .object(try GoogleMeetProviderActionSupport.space(root))]
    case "google_meet_space_create":
      mutationLock.lock(); defer { mutationLock.unlock() }
      root = try send(token: token, method: "POST", path: "/spaces", query: [], body: try GoogleMeetProviderActionSupport.safeBody(request.payload))
      fields = ["semanticWriteContract": .string("google-meet-safe-space-create-v1"), "providerMutation": .bool(true), "space": .object(try GoogleMeetProviderActionSupport.space(root))]
    case "google_meet_space_patch":
      mutationLock.lock(); defer { mutationLock.unlock() }
      let name = try GoogleMeetProviderActionSupport.spaceName(request.payload["spaceName"])
      root = try send(token: token, method: "PATCH", path: "/\(GoogleMeetProviderActionSupport.path(name))", query: [URLQueryItem(name: "updateMask", value: GoogleMeetProviderActionSupport.updateMask)], body: try GoogleMeetProviderActionSupport.safeBody(request.payload, name: name))
      fields = ["semanticWriteContract": .string("google-meet-safe-space-patch-v1"), "providerMutation": .bool(true), "explicitSafetyUpdateMask": .bool(true), "space": .object(try GoogleMeetProviderActionSupport.space(root))]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_meet_live_action_not_supported", message: "Unsupported live Google Meet action.")
    }
    return GoogleMeetProviderActionClientResult(result: GoogleMeetProviderActionSupport.base("live-meet-api-v2").merging(fields) { _, new in new })
  }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "google-meet", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.googleMeetRelayOwnedOAuthScopes, connection.health.diagnostics["appCreatedSpacesOnly"]?.bool == true, connection.health.diagnostics["broadSpaceAccessEnabled"]?.bool == false,
            connection.health.diagnostics["participantsAccessEnabled"]?.bool == false, connection.health.diagnostics["conferenceRecordsAccessEnabled"]?.bool == false, connection.health.diagnostics["recordingsTranscriptsSmartNotesEnabled"]?.bool == false,
            connection.health.diagnostics["driveArtifactsEnabled"]?.bool == false, connection.health.diagnostics["dialInSipReturned"]?.bool == false, connection.health.diagnostics["endConferenceEnabled"]?.bool == false, connection.health.diagnostics["automaticPagination"]?.bool == false,
            connection.health.diagnostics["domainDelegationEnabled"]?.bool == false, let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "google_meet_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "google_meet_connection_not_ready", message: "Google Meet requires a ready exact-scope app-created-Space connection.") }; return try secrets.getSecretValue(ref)
    }
  private func send(token: String, method: String, path: String, query: [URLQueryItem], body: JSONRecord?) throws -> JSONValue {
    var components = URLComponents(string: GoogleMeetProviderActionSupport.apiOrigin + path)!; components.queryItems = query
    guard let url = components.url, url.scheme == "https", url.host == "meet.googleapis.com", url.path.hasPrefix("/v2/") else { throw MarketplaceProviderActionAdapterFailure(code: "google_meet_unsafe_url", message: "Unsafe Google Meet API URL.") }
        var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = method; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization");
        if let body { request.httpBody = try JSONEncoder().encode(JSONValue.object(body)); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "google_meet_transport_error", message: "Google Meet returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume()
        guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "google_meet_timeout", message: "Google Meet API request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "google_meet_rate_limited" : "google_meet_api_error", message: "Google Meet API request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_meet_response_too_large", message: "Google Meet response exceeded the 1 MB V1 bound.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct GoogleMeetProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["google_meet_space_get", "google_meet_space_update_prepare", "google_meet_space_create", "google_meet_space_patch"]
  private let client: any GoogleMeetProviderActionClient
  public init(client: any GoogleMeetProviderActionClient = FakeGoogleMeetProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "google-meet", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "google_meet_action_not_allowlisted", message: "Google Meet action is not allowlisted.") };
        let write = ["google_meet_space_create", "google_meet_space_patch"].contains(request.definition.actionKey);
        guard write ? request.permission != .blocked : request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "google_meet_permission_denied", message: "Google Meet action is not permitted by policy.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeGoogleMeetAction(request: request).result, error: nil, redactionStatus: "participants-conference-records-artifacts-dial-in-sip-termination-broad-access-excluded")
    }
}

public enum GoogleMeetProviderActionSupport {
  public static let apiOrigin = "https://meet.googleapis.com/v2"
  public static let updateMask = "config.accessType,config.entryPointAccess,config.moderation,config.moderationRestrictions,config.attendanceReportGenerationType,config.artifactConfig"
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("google-meet"), "adapterBoundary": .string("google-meet-provider-action-adapter"), "clientMode": .string(mode), "appCreatedSpacesOnly": .bool(true), "participantsReturned": .bool(false), "conferenceRecordIdentifiersReturned": .bool(false),
            "artifactsReturned": .bool(false), "dialInSipReturned": .bool(false), "endConferenceEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let value)? = value else { return [:] }; return value };
    static func scalar(_ value: JSONValue?, maximum: Int = 1024) -> JSONValue {
        guard let value else { return .null };
        switch value {
        case .string(let text): return .string(String(text.prefix(maximum)));
        case .number, .bool, .null: return value;
        default: return .null
        }
    }
  static func path(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_/~"))) ?? value }
    static func spaceName(_ value: JSONValue?) throws -> String {
        guard let value = value?.string, value.hasPrefix("spaces/"), value.count <= 256, value.dropFirst(7).allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_meet_invalid_space_name", message: "An explicit bounded spaces/* resource name is required.")
        }; return value
    }
    static func choice(_ value: JSONValue?, name: String, allowed: Set<String>, fallback: String) throws -> String {
        let value = value?.string ?? fallback; guard allowed.contains(value) else { throw MarketplaceProviderActionAdapterFailure(code: "google_meet_invalid_\(name)", message: "Google Meet \(name) is outside the safe allowlist.") }; return value
    }
    static func safeBody(_ payload: JSONRecord, name: String? = nil) throws -> JSONRecord {
        let access = try choice(payload["accessType"], name: "access_type", allowed: ["RESTRICTED", "TRUSTED"], fallback: "RESTRICTED"), entry = try choice(payload["entryPointAccess"], name: "entry_point_access", allowed: ["ALL", "CREATOR_APP_ONLY"], fallback: "ALL");
        var body: JSONRecord = [
            "config": .object([
                "accessType": .string(access), "entryPointAccess": .string(entry), "moderation": .string("ON"),
                "moderationRestrictions": .object(["chatRestriction": .string("HOSTS_ONLY"), "reactionRestriction": .string("HOSTS_ONLY"), "presentRestriction": .string("HOSTS_ONLY"), "defaultJoinAsViewerType": .string("ON")]), "attendanceReportGenerationType": .string("DO_NOT_GENERATE"),
                "artifactConfig": .object([
                    "recordingConfig": .object(["autoRecordingGeneration": .string("DO_NOT_GENERATE")]), "transcriptionConfig": .object(["autoTranscriptionGeneration": .string("DO_NOT_GENERATE")]), "smartNotesConfig": .object(["autoSmartNotesGeneration": .string("DO_NOT_GENERATE")]),
                ]),
            ])
        ]
            ;
        if let name { body["name"] = .string(name) }; return body
    }
    static func safeMeetingURI(_ value: JSONValue?) throws -> JSONValue {
        guard let raw = value?.string, raw.count <= 256, let url = URL(string: raw), url.scheme == "https", url.host == "meet.google.com" else { throw MarketplaceProviderActionAdapterFailure(code: "google_meet_invalid_meeting_uri", message: "Meet returned an unsafe meeting URI.") };
        return .string(raw)
    }
    static func space(_ value: JSONValue?) throws -> JSONRecord {
        let record = object(value), config = object(record["config"]), moderation = object(config["moderationRestrictions"]);
        return [
            "name": scalar(record["name"], maximum: 256), "meetingUri": try safeMeetingURI(record["meetingUri"]), "meetingCode": scalar(record["meetingCode"], maximum: 128), "accessType": scalar(config["accessType"], maximum: 32), "entryPointAccess": scalar(config["entryPointAccess"], maximum: 32),
            "moderation": scalar(config["moderation"], maximum: 16), "chatRestriction": scalar(moderation["chatRestriction"], maximum: 32), "reactionRestriction": scalar(moderation["reactionRestriction"], maximum: 32), "presentRestriction": scalar(moderation["presentRestriction"], maximum: 32),
            "defaultJoinAsViewerType": scalar(moderation["defaultJoinAsViewerType"], maximum: 16), "hasActiveConference": .bool(record["activeConference"] != nil), "participantsReturned": .bool(false), "conferenceRecordIdentifierReturned": .bool(false), "artifactsReturned": .bool(false),
            "phoneAccessReturned": .bool(false), "gatewaySipAccessReturned": .bool(false),
        ]
    }
    static func preview(_ payload: JSONRecord) -> JSONRecord {
        [
            "operation": payload["operation"] ?? .null, "spaceName": payload["spaceName"] ?? .null, "accessType": payload["accessType"] ?? .string("RESTRICTED"), "entryPointAccess": payload["entryPointAccess"] ?? .string("ALL"), "moderation": .string("ON"),
            "artifactsAndAttendance": .string("DO_NOT_GENERATE"), "providerMutation": .bool(false),
        ]
    }
    public static func validatedPreview(_ payload: JSONRecord) throws -> JSONRecord {
        let operation = payload["operation"]?.string ?? ""; guard ["create", "patch"].contains(operation) else { throw MarketplaceProviderActionAdapterFailure(code: "google_meet_operation_not_allowlisted", message: "Only create and patch may be prepared.") };
        if operation == "patch" { _ = try spaceName(payload["spaceName"]) }; _ = try safeBody(payload); return preview(payload)
    }
    public static func fakeSpace() -> JSONRecord {
        [
            "name": .string("spaces/relayMeet1"), "meetingUri": .string("https://meet.google.com/abc-defg-hij"), "meetingCode": .string("abc-defg-hij"), "accessType": .string("RESTRICTED"), "entryPointAccess": .string("ALL"), "moderation": .string("ON"), "chatRestriction": .string("HOSTS_ONLY"),
            "reactionRestriction": .string("HOSTS_ONLY"), "presentRestriction": .string("HOSTS_ONLY"), "defaultJoinAsViewerType": .string("ON"), "hasActiveConference": .bool(false), "participantsReturned": .bool(false), "conferenceRecordIdentifierReturned": .bool(false),
            "artifactsReturned": .bool(false), "phoneAccessReturned": .bool(false), "gatewaySipAccessReturned": .bool(false),
        ]
    }
}
