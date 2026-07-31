import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct GoogleChatProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol GoogleChatProviderActionClient: Sendable { func executeGoogleChatAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleChatProviderActionClientResult }

public struct FakeGoogleChatProviderActionClient: GoogleChatProviderActionClient {
  public init() {}
  public func executeGoogleChatAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleChatProviderActionClientResult {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_chat_space_get":
      fields = ["semanticReadContract": .string("google-chat-explicit-space-v1"), "space": .object(GoogleChatProviderActionSupport.fakeSpace())]
    case "google_chat_messages_list":
      _ = try GoogleChatProviderActionSupport.spaceName(request.payload["spaceName"])
      fields = ["semanticReadContract": .string("google-chat-bounded-plain-text-messages-v1"), "messages": .array([.object(GoogleChatProviderActionSupport.fakeMessage())]), "resultCount": .number(1)]
    case "google_chat_message_prepare":
      fields = ["semanticDraftContract": .string("google-chat-plain-text-message-prepare-v1"), "draftPreview": .object(try GoogleChatProviderActionSupport.validatedPreview(request.payload)), "providerMutation": .bool(false)]
    case "google_chat_message_create":
      _ = try GoogleChatProviderActionSupport.createBody(request.payload)
      fields = ["semanticWriteContract": .string("google-chat-plain-text-message-create-v1"), "providerMutation": .bool(true), "message": .object(GoogleChatProviderActionSupport.fakeMessage())]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_chat_action_not_supported", message: "Unsupported Google Chat action.")
    }
    return GoogleChatProviderActionClientResult(result: GoogleChatProviderActionSupport.base("fake-chat-api-v1").merging(fields) { _, new in new })
  }
}

public final class LiveGoogleChatProviderActionClient: GoogleChatProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService; private let mutationLock = NSLock()
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeGoogleChatAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleChatProviderActionClientResult {
        if request.definition.actionKey == "google_chat_message_prepare" {
            return GoogleChatProviderActionClientResult(
                result: GoogleChatProviderActionSupport.base("local-no-provider-request").merging([
                    "semanticDraftContract": .string("google-chat-plain-text-message-prepare-v1"), "draftPreview": .object(try GoogleChatProviderActionSupport.validatedPreview(request.payload)), "providerMutation": .bool(false),
                ]) { _, new in new })
        }
    let token = try authorization(request); let root: JSONValue; let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_chat_space_get":
      let space = try GoogleChatProviderActionSupport.spaceName(request.payload["spaceName"])
      root = try send(token: token, method: "GET", path: "/\(GoogleChatProviderActionSupport.path(space))", query: [], body: nil)
      fields = ["semanticReadContract": .string("google-chat-explicit-space-v1"), "space": .object(GoogleChatProviderActionSupport.space(root))]
    case "google_chat_messages_list":
      let space = try GoogleChatProviderActionSupport.spaceName(request.payload["spaceName"]), pageSize = try GoogleChatProviderActionSupport.pageSize(request.payload["pageSize"])
            root = try send(
                token: token, method: "GET", path: "/\(GoogleChatProviderActionSupport.path(space))/messages", query: [URLQueryItem(name: "pageSize", value: String(pageSize)), URLQueryItem(name: "orderBy", value: "createTime DESC"), URLQueryItem(name: "showDeleted", value: "false")], body: nil)
      let messages = GoogleChatProviderActionSupport.messages(root)
      fields = ["semanticReadContract": .string("google-chat-bounded-plain-text-messages-v1"), "messages": .array(messages.map(JSONValue.object)), "resultCount": .number(Double(messages.count)), "nextPageTokenFollowed": .bool(false)]
    case "google_chat_message_create":
      mutationLock.lock(); defer { mutationLock.unlock() }
      let space = try GoogleChatProviderActionSupport.spaceName(request.payload["spaceName"]), requestID = try GoogleChatProviderActionSupport.requestID(request.payload["requestId"]), thread = try GoogleChatProviderActionSupport.threadName(request.payload["threadName"], in: space)
      var query = [URLQueryItem(name: "requestId", value: requestID)]
      if thread != nil { query.append(URLQueryItem(name: "messageReplyOption", value: "REPLY_MESSAGE_OR_FAIL")) }
      root = try send(token: token, method: "POST", path: "/\(GoogleChatProviderActionSupport.path(space))/messages", query: query, body: try GoogleChatProviderActionSupport.createBody(request.payload, thread: thread))
      fields = ["semanticWriteContract": .string("google-chat-plain-text-message-create-v1"), "providerMutation": .bool(true), "message": .object(GoogleChatProviderActionSupport.message(root))]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_chat_live_action_not_supported", message: "Unsupported live Google Chat action.")
    }
    return GoogleChatProviderActionClientResult(result: GoogleChatProviderActionSupport.base("live-chat-api-v1").merging(fields) { _, new in new })
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "google-chat", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.googleChatRelayOwnedOAuthScopes, connection.health.diagnostics["userAuthOnly"]?.bool == true, connection.health.diagnostics["explicitSpacesOnly"]?.bool == true,
            connection.health.diagnostics["spaceDiscoveryEnabled"]?.bool == false, connection.health.diagnostics["membershipsEnabled"]?.bool == false, connection.health.diagnostics["adminAccessEnabled"]?.bool == false, connection.health.diagnostics["appBotAuthEnabled"]?.bool == false,
            connection.health.diagnostics["importModeEnabled"]?.bool == false, connection.health.diagnostics["privateMessagesEnabled"]?.bool == false, connection.health.diagnostics["attachmentsMediaEnabled"]?.bool == false, connection.health.diagnostics["reactionsEnabled"]?.bool == false,
            connection.health.diagnostics["messageMutationExceptCreateEnabled"]?.bool == false, connection.health.diagnostics["automaticPagination"]?.bool == false, connection.health.diagnostics["domainDelegationEnabled"]?.bool == false,
            let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "google_chat_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "google_chat_connection_not_ready", message: "Google Chat requires a ready exact-scope user OAuth connection.") }
    return try secrets.getSecretValue(ref)
  }
  private func send(token: String, method: String, path: String, query: [URLQueryItem], body: JSONRecord?) throws -> JSONValue {
    var components = URLComponents(string: GoogleChatProviderActionSupport.apiOrigin + path)!; components.queryItems = query
    guard let url = components.url, url.scheme == "https", url.host == "chat.googleapis.com", url.path.hasPrefix("/v1/spaces/") else { throw MarketplaceProviderActionAdapterFailure(code: "google_chat_unsafe_url", message: "Unsafe Google Chat API URL.") }
        var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = method; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization");
        if let body { request.httpBody = try JSONEncoder().encode(JSONValue.object(body)); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "google_chat_transport_error", message: "Google Chat returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume()
        guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "google_chat_timeout", message: "Google Chat API request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "google_chat_rate_limited" : "google_chat_api_error", message: "Google Chat API request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_chat_response_too_large", message: "Google Chat response exceeded the 1 MB V1 bound.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct GoogleChatProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["google_chat_space_get", "google_chat_messages_list", "google_chat_message_prepare", "google_chat_message_create"]
  private let client: any GoogleChatProviderActionClient
  public init(client: any GoogleChatProviderActionClient = FakeGoogleChatProviderActionClient()) { self.client = client }
  public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
    guard request.app.slug == "google-chat", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "google_chat_action_not_allowlisted", message: "Google Chat action is not allowlisted.") }
        let write = request.definition.actionKey == "google_chat_message_create";
        guard write ? request.permission != .blocked : request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "google_chat_permission_denied", message: "Google Chat action is not permitted by policy.") }
    return MarketplaceProviderActionAdapterResult(result: try client.executeGoogleChatAction(request: request).result, error: nil, redactionStatus: "identities-memberships-rich-private-media-reactions-pagination-admin-app-auth-excluded")
  }
}

public enum GoogleChatProviderActionSupport {
  public static let apiOrigin = "https://chat.googleapis.com/v1"
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("google-chat"), "adapterBoundary": .string("google-chat-provider-action-adapter"), "clientMode": .string(mode), "userAuthOnly": .bool(true), "explicitSpacesOnly": .bool(true), "senderIdentityReturned": .bool(false), "membershipsReturned": .bool(false),
            "attachmentsMediaReturned": .bool(false), "reactionsReturned": .bool(false), "privateMessagesReturned": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
  static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let value)? = value else { return [:] }; return value }
  static func scalar(_ value: JSONValue?, maximum: Int = 1024) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(maximum))); case .number, .bool, .null: return value; default: return .null } }
  static func path(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_/~"))) ?? value }
    static func spaceName(_ value: JSONValue?) throws -> String {
        guard let value = value?.string, value.hasPrefix("spaces/"), value.count <= 256, !value.dropFirst(7).isEmpty, value.dropFirst(7).allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_chat_invalid_space_name", message: "An explicit bounded spaces/* resource name is required.")
        }; return value
    }
  static func pageSize(_ value: JSONValue?) throws -> Int { let size = value?.number.map(Int.init) ?? 25; guard (1...25).contains(size) else { throw MarketplaceProviderActionAdapterFailure(code: "google_chat_invalid_page_size", message: "Google Chat V1 permits at most 25 messages.") }; return size }
    static func requestID(_ value: JSONValue?) throws -> String {
        guard let value = value?.string, (1...128).contains(value.count), value.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_chat_invalid_request_id", message: "A bounded idempotency requestId is required.")
        }; return value
    }
    static func threadName(_ value: JSONValue?, in space: String) throws -> String? {
        guard let value else { return nil };
        guard let name = value.string, name.hasPrefix(space + "/threads/"), name.count <= 384, name.dropFirst((space + "/threads/").count).allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_chat_invalid_thread_name", message: "Thread must be an explicit same-space resource.")
        }; return name
    }
    static func text(_ value: JSONValue?) throws -> String {
        guard let value = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty, value.count <= 4000, !value.localizedCaseInsensitiveContains("@all"), !value.localizedCaseInsensitiveContains("<users/") else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_chat_invalid_message_text", message: "Plain text must be non-empty, at most 4,000 characters, and contain no mass or user markup mentions.")
        }; return value
    }
  static func createBody(_ payload: JSONRecord, thread: String? = nil) throws -> JSONRecord { _ = try spaceName(payload["spaceName"]); var body: JSONRecord = ["text": .string(try text(payload["text"]))]; if let thread { body["thread"] = .object(["name": .string(thread)]) }; return body }
    public static func validatedPreview(_ payload: JSONRecord) throws -> JSONRecord {
        let space = try spaceName(payload["spaceName"]), message = try text(payload["text"]), thread = try threadName(payload["threadName"], in: space);
        return ["spaceName": .string(space), "text": .string(message), "characterCount": .number(Double(message.count)), "threadName": thread.map(JSONValue.string) ?? .null, "replyFallbackAllowed": .bool(false), "providerMutation": .bool(false)]
    }
    static func space(_ value: JSONValue?) -> JSONRecord {
        let record = object(value);
        return [
            "name": scalar(record["name"], maximum: 256), "displayName": scalar(record["displayName"], maximum: 256), "spaceType": scalar(record["spaceType"], maximum: 32), "spaceThreadingState": scalar(record["spaceThreadingState"], maximum: 64),
            "externalUserAllowed": scalar(record["externalUserAllowed"], maximum: 8), "membershipsReturned": .bool(false),
        ]
    }
    static func message(_ value: JSONValue?) -> JSONRecord {
        let record = object(value), sender = object(record["sender"]), thread = object(record["thread"]);
        return [
            "name": scalar(record["name"], maximum: 384), "text": scalar(record["text"], maximum: 4000), "createTime": scalar(record["createTime"], maximum: 64), "updateTime": scalar(record["lastUpdateTime"] ?? record["updateTime"], maximum: 64), "threadName": scalar(thread["name"], maximum: 384),
            "authorType": scalar(sender["type"], maximum: 32), "senderIdentityReturned": .bool(false), "formattedTextReturned": .bool(false), "annotationsReturned": .bool(false), "attachmentsReturned": .bool(false), "reactionsReturned": .bool(false), "privateMessageViewerReturned": .bool(false),
            "quotedMessageReturned": .bool(false),
        ]
    }
  static func messages(_ root: JSONValue?) -> [JSONRecord] { let record = object(root); guard case .array(let values)? = record["messages"] else { return [] }; return values.prefix(25).map { message($0) } }
  public static func fakeSpace() -> JSONRecord { ["name": .string("spaces/relayChat1"), "displayName": .string("Product launch"), "spaceType": .string("SPACE"), "spaceThreadingState": .string("THREADED_MESSAGES"), "externalUserAllowed": .bool(false), "membershipsReturned": .bool(false)] }
    public static func fakeMessage() -> JSONRecord {
        [
            "name": .string("spaces/relayChat1/messages/message1"), "text": .string("The launch checklist is ready for review."), "createTime": .string("2026-07-12T00:00:00Z"), "updateTime": .string("2026-07-12T00:00:00Z"), "threadName": .string("spaces/relayChat1/threads/thread1"),
            "authorType": .string("HUMAN"), "senderIdentityReturned": .bool(false), "formattedTextReturned": .bool(false), "annotationsReturned": .bool(false), "attachmentsReturned": .bool(false), "reactionsReturned": .bool(false), "privateMessageViewerReturned": .bool(false),
            "quotedMessageReturned": .bool(false),
        ]
    }
}
