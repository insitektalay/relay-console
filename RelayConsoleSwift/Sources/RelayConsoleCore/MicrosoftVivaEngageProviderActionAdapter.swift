import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct MicrosoftVivaEngageProviderActionClientResult: Sendable {
  public var result: JSONRecord
  public init(result: JSONRecord) { self.result = result }
}

public protocol MicrosoftVivaEngageProviderActionClient: Sendable {
  func executeMicrosoftVivaEngageAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftVivaEngageProviderActionClientResult
}

public struct FakeMicrosoftVivaEngageProviderActionClient: MicrosoftVivaEngageProviderActionClient {
  public init() {}
  public func executeMicrosoftVivaEngageAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftVivaEngageProviderActionClientResult {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "microsoft_viva_engage_network_get": fields = ["network": .object(MicrosoftVivaEngageProviderActionSupport.fakeNetwork())]
    case "microsoft_viva_engage_current_user_get": fields = ["currentUser": .object(MicrosoftVivaEngageProviderActionSupport.fakeUser())]
    case "microsoft_viva_engage_my_communities_list": fields = ["communities": .array([.object(MicrosoftVivaEngageProviderActionSupport.fakeCommunity())]), "resultCount": .number(1)]
    case "microsoft_viva_engage_selected_community_messages_list": fields = ["messages": .array([.object(MicrosoftVivaEngageProviderActionSupport.fakeMessage())]), "resultCount": .number(1)]
    default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_viva_engage_action_not_supported", message: "Unsupported Viva Engage action.")
    }
    return MicrosoftVivaEngageProviderActionClientResult(result: MicrosoftVivaEngageProviderActionSupport.base("fake-yammer-core").merging(fields) { _, new in new })
  }
}

public final class LiveMicrosoftVivaEngageProviderActionClient: MicrosoftVivaEngageProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService
  private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }

  public func executeMicrosoftVivaEngageAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftVivaEngageProviderActionClientResult {
    let auth = try authorization(request)
    let root: JSONValue
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "microsoft_viva_engage_network_get":
      root = try get(token: auth.token, path: "/networks/current.json")
      fields = ["network": .object(MicrosoftVivaEngageProviderActionSupport.network(root))]
    case "microsoft_viva_engage_current_user_get":
      root = try get(token: auth.token, path: "/users/current.json")
      fields = ["currentUser": .object(MicrosoftVivaEngageProviderActionSupport.user(root))]
    case "microsoft_viva_engage_my_communities_list":
      root = try get(token: auth.token, path: "/groups/for_user/\(auth.userId).json")
      let values = MicrosoftVivaEngageProviderActionSupport.array(root).prefix(25).map(MicrosoftVivaEngageProviderActionSupport.community)
      fields = ["communities": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)]
    case "microsoft_viva_engage_selected_community_messages_list":
      root = try get(token: auth.token, path: "/messages/in_group/\(auth.communityId).json?threaded=extended&limit=25")
      let messages = Array(MicrosoftVivaEngageProviderActionSupport.array(MicrosoftVivaEngageProviderActionSupport.object(root)["messages"]).prefix(25))
            guard messages.allSatisfy({ MicrosoftVivaEngageProviderActionSupport.object($0)["group_id"]?.stringValue == auth.communityId }) else {
                throw MarketplaceProviderActionAdapterFailure(code: "microsoft_viva_engage_selected_community_mismatch", message: "Viva Engage returned a message outside the selected community.")
            }
      fields = ["messages": .array(messages.map { .object(MicrosoftVivaEngageProviderActionSupport.message($0)) }), "resultCount": .number(Double(messages.count)), "nextPageFollowed": .bool(false)]
    default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_viva_engage_live_action_not_supported", message: "Unsupported live Viva Engage action.")
    }
    return MicrosoftVivaEngageProviderActionClientResult(result: MicrosoftVivaEngageProviderActionSupport.base("live-yammer-core").merging(fields) { _, new in new })
  }

  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, userId: String, communityId: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "microsoft-viva-engage", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.microsoftVivaEngageRelayOwnedOAuthScopes, connection.health.diagnostics["selectedCommunityVerified"]?.bool == true, connection.health.diagnostics["getOnly"]?.bool == true,
            connection.health.diagnostics["privateMessagesEnabled"]?.bool == false, connection.health.diagnostics["writesEnabled"]?.bool == false, connection.health.diagnostics["automaticPagination"]?.bool == false, connection.health.diagnostics["rawToolsEnabled"]?.bool == false,
            let userId = connection.health.diagnostics["currentUserId"]?.string, let communityId = connection.health.diagnostics["selectedCommunityId"]?.string,
            let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == "microsoft_viva_engage_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_viva_engage_connection_not_ready", message: "Viva Engage requires a ready exact-scope selected-community GET-only connection.") }
    return (try secrets.getSecretValue(secretId), try MicrosoftVivaEngageProviderActionSupport.identifier(userId, "currentUserId"), try MicrosoftVivaEngageProviderActionSupport.identifier(communityId, "selectedCommunityId"))
  }

  private func get(token: String, path: String) throws -> JSONValue {
        guard path.hasPrefix("/"), !path.contains(".."), let url = URL(string: "https://www.yammer.com/api/v1" + path), url.scheme == "https", url.host == "www.yammer.com", url.path.hasPrefix("/api/v1/"),
            ["/networks/current.json", "/users/current.json"].contains(path) || path.hasPrefix("/groups/for_user/") || path.hasPrefix("/messages/in_group/")
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_viva_engage_unsafe_url", message: "Unsafe Viva Engage request.") }
    var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = "GET"; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Accept")
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() };
            if let error {
                captured = .failure(error)
            } else if let bytes, let response = response as? HTTPURLResponse {
                captured = .success((bytes, response))
            } else {
                captured = .failure(MarketplaceProviderActionAdapterFailure(code: "microsoft_viva_engage_transport_error", message: "Viva Engage returned no HTTP response."))
            }
        }.resume()
    guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_viva_engage_timeout", message: "Viva Engage request timed out.") }
        let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "microsoft_viva_engage_rate_limited" : "microsoft_viva_engage_api_error", message: "Viva Engage request failed.", providerStatusCode: response.statusCode)
        }; guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_viva_engage_response_too_large", message: "Viva Engage response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct MicrosoftVivaEngageProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["microsoft_viva_engage_network_get", "microsoft_viva_engage_current_user_get", "microsoft_viva_engage_my_communities_list", "microsoft_viva_engage_selected_community_messages_list"]
  private let client: any MicrosoftVivaEngageProviderActionClient
  public init(client: any MicrosoftVivaEngageProviderActionClient = FakeMicrosoftVivaEngageProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "microsoft-viva-engage", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_viva_engage_action_not_allowlisted", message: "Viva Engage V1 permits only four fixed selected-community GET reads.")
        }; return MarketplaceProviderActionAdapterResult(result: try client.executeMicrosoftVivaEngageAction(request: request).result, error: nil, redactionStatus: "private-global-feeds-identities-attachments-search-export-writes-pagination-raw-excluded")
    }
}

public enum MicrosoftVivaEngageProviderActionSupport {
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("microsoft-viva-engage"), "adapterBoundary": .string("microsoft-viva-engage-provider-action-adapter"), "clientMode": .string(mode), "selectedCommunityOnly": .bool(true), "getOnly": .bool(true), "maxResults": .number(25), "writesEnabled": .bool(false),
            "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
  static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let record)? = value else { return [:] }; return record }
  static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let values)? = value else { return [] }; return values }
  static func scalar(_ value: JSONValue?, _ max: Int = 512) -> JSONValue { guard let value else { return .null }; if case .string(let string) = value { return .string(String(string.prefix(max))) }; if case .number = value { return value }; if case .bool = value { return value }; return .null }
    static func identifier(_ value: String, _ field: String) throws -> String {
        guard !value.isEmpty, value.count <= 32, value.allSatisfy(\.isNumber) else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_viva_engage_invalid_identifier", message: "A numeric \(field) is required.") }; return value
    }
  static func network(_ value: JSONValue?) -> JSONRecord { let r = object(value); return ["id": scalar(r["id"], 32), "name": scalar(r["name"]), "permalink": scalar(r["permalink"], 1024), "adminFieldsExcluded": .bool(true)] }
  static func user(_ value: JSONValue?) -> JSONRecord { let r = object(value); return ["id": scalar(r["id"], 32), "displayName": scalar(r["full_name"] ?? r["name"]), "emailContactExcluded": .bool(true), "profileDetailsExcluded": .bool(true)] }
    static func community(_ value: JSONValue?) -> JSONRecord {
        let r = object(value); return ["id": scalar(r["id"], 32), "name": scalar(r["name"]), "description": scalar(r["description"], 1000), "privacy": scalar(r["privacy"], 32), "moderated": scalar(r["moderated"]), "external": scalar(r["external"]), "membershipDirectoryExcluded": .bool(true)]
    }
    static func message(_ value: JSONValue?) -> JSONRecord {
        let r = object(value), body = object(r["body"]);
        return [
            "id": scalar(r["id"], 32), "threadId": scalar(r["thread_id"], 32), "communityId": scalar(r["group_id"], 32), "bodyText": scalar(body["plain"] ?? r["content_excerpt"], 4000), "createdAt": scalar(r["created_at"], 64), "messageType": scalar(r["message_type"], 64),
            "senderIdentityExcluded": .bool(true), "mentionsReactionsExcluded": .bool(true), "attachmentsExcluded": .bool(true),
        ]
    }
  static func fakeNetwork() -> JSONRecord { ["id": .string("1001"), "name": .string("Contoso"), "permalink": .string("https://www.yammer.com/contoso.com"), "adminFieldsExcluded": .bool(true)] }
  static func fakeUser() -> JSONRecord { ["id": .string("2001"), "displayName": .string("Alex Morgan"), "emailContactExcluded": .bool(true), "profileDetailsExcluded": .bool(true)] }
  static func fakeCommunity() -> JSONRecord { ["id": .string("3001"), "name": .string("Product Launch"), "description": .string("Cross-functional launch updates"), "privacy": .string("private"), "moderated": .bool(true), "external": .bool(false), "membershipDirectoryExcluded": .bool(true)] }
    static func fakeMessage() -> JSONRecord {
        [
            "id": .string("4001"), "threadId": .string("4001"), "communityId": .string("3001"), "bodyText": .string("Launch readiness review is scheduled for Friday; owners should update risks before Thursday."), "createdAt": .string("2026-07-12T08:30:00Z"), "messageType": .string("normal"),
            "senderIdentityExcluded": .bool(true), "mentionsReactionsExcluded": .bool(true), "attachmentsExcluded": .bool(true),
        ]
    }
}

private extension JSONValue {
  var stringValue: String? { switch self { case .string(let value): return value; case .number(let value): return value.rounded() == value ? String(Int64(value)) : String(value); default: return nil } }
}
