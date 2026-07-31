import Foundation

public struct BeehiivProviderHTTPRequest: Sendable {
  public let url: URL
  public let headers: [String: String]
  public init(url: URL, headers: [String: String]) {
    self.url = url
    self.headers = headers
  }
}
public struct BeehiivProviderHTTPResponse: Sendable {
  public let statusCode: Int
  public let body: Data
  public init(statusCode: Int, body: Data = Data()) {
    self.statusCode = statusCode
    self.body = body
  }
}
public protocol BeehiivProviderHTTPClient: Sendable {
  func send(_ request: BeehiivProviderHTTPRequest) throws -> BeehiivProviderHTTPResponse
}
private final class BeehiivNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable
{
  func urlSession(
    _ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) { completionHandler(nil) }
}
public struct URLSessionBeehiivProviderHTTPClient: BeehiivProviderHTTPClient {
  public init() {}
  public func send(_ request: BeehiivProviderHTTPRequest) throws -> BeehiivProviderHTTPResponse {
    var value = URLRequest(url: request.url)
    value.httpMethod = "GET"
    value.timeoutInterval = 20
    request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
    let session = URLSession(
      configuration: .ephemeral, delegate: BeehiivNoRedirectDelegate(), delegateQueue: nil)
    let semaphore = DispatchSemaphore(value: 0)
    var data: Data?
    var response: HTTPURLResponse?
    var failure: Error?
    let task = session.dataTask(with: value) {
      data = $0
      response = $1 as? HTTPURLResponse
      failure = $2
      semaphore.signal()
    }
    task.resume()
    if semaphore.wait(timeout: .now() + 20) == .timedOut {
      task.cancel()
      throw MarketplaceProviderActionAdapterFailure(
        code: "beehiiv_http_timeout", message: "beehiiv API request timed out.")
    }
    session.invalidateAndCancel()
    if let failure { throw failure }
    return BeehiivProviderHTTPResponse(statusCode: response?.statusCode ?? 0, body: data ?? Data())
  }
}

public struct BeehiivProviderActionClientResult: Sendable {
  public let result: JSONRecord
  public init(result: JSONRecord) { self.result = result }
}
public protocol BeehiivProviderActionClient: Sendable {
  func executeBeehiivAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> BeehiivProviderActionClientResult
}
public struct FakeBeehiivProviderActionClient: BeehiivProviderActionClient {
  public init() {}
  public func executeBeehiivAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> BeehiivProviderActionClientResult
  {
    switch request.definition.actionKey {
    case "beehiiv_account_get": return output(["account": .object(BeehiivSupport.fakeAccount())])
    case "beehiiv_publication_list":
      return output(["publications": .array([.object(BeehiivSupport.fakePublication())])])
    case "beehiiv_post_list":
      return output([
        "publicationId": .string("pub_00000000-0000-0000-0000-000000000000"),
        "posts": .array([.object(BeehiivSupport.fakePost())]),
      ])
    default:
      throw MarketplaceProviderActionAdapterFailure(
        code: "beehiiv_fake_action_not_supported", message: "Unsupported beehiiv action.")
    }
  }
  private func output(_ fields: JSONRecord) -> BeehiivProviderActionClientResult {
    BeehiivProviderActionClientResult(
      result: [
        "provider": .string("beehiiv"),
        "adapterBoundary": .string("beehiiv-provider-action-adapter"),
        "rawProviderToolExposure": .bool(false),
        "redactionStatus": .string("subscriber-and-content-excluded"),
      ].merging(fields) { _, new in new })
  }
}

public final class LiveBeehiivProviderActionClient: BeehiivProviderActionClient, @unchecked Sendable
{
  private let data: LocalDataService
  private let secrets: SecretService
  private let http: any BeehiivProviderHTTPClient
  public init(
    data: LocalDataService, secrets: SecretService,
    httpClient: any BeehiivProviderHTTPClient = URLSessionBeehiivProviderHTTPClient()
  ) {
    self.data = data
    self.secrets = secrets
    self.http = httpClient
  }
  public func executeBeehiivAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> BeehiivProviderActionClientResult
  {
    let auth = try authorization(request)
    switch request.definition.actionKey {
    case "beehiiv_account_get":
      let root = try get(
        auth, origin: "https://app.beehiiv.com", path: "/oauth/token/info", query: [])
      let account = try BeehiivSupport.account(root)
      guard account["OrganizationId"]?.string == auth.organizationId else {
        throw MarketplaceProviderActionAdapterFailure(
          code: "beehiiv_organization_changed",
          message: "beehiiv exact-organization binding changed.")
      }
      return output(["account": .object(account)])
    case "beehiiv_publication_list":
      let root = try get(
        auth, origin: "https://api.beehiiv.com", path: "/v2/publications",
        query: BeehiivSupport.firstPage)
      let values = try (root.beehiivObject?["data"]?.beehiivArray ?? []).prefix(25).map {
        JSONValue.object(try BeehiivSupport.publication($0))
      }
      return output(["publications": .array(Array(values))])
    case "beehiiv_post_list":
      let publicationId = try BeehiivSupport.requiredPublicationId(request.payload["publicationId"])
      let root = try get(
        auth, origin: "https://api.beehiiv.com", path: "/v2/publications/\(publicationId)/posts",
        query: BeehiivSupport.firstPage)
      let values = try (root.beehiivObject?["data"]?.beehiivArray ?? []).prefix(25).map {
        JSONValue.object(try BeehiivSupport.post($0))
      }
      return output(["publicationId": .string(publicationId), "posts": .array(Array(values))])
    default:
      throw MarketplaceProviderActionAdapterFailure(
        code: "beehiiv_live_action_not_supported", message: "Unsupported beehiiv action.")
    }
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (
    token: String, organizationId: String
  ) {
    let scopes = Set(["identify:read", "publications:read", "posts:read"])
    guard let id = request.auditIdentity.connectionId,
      let connection = try data.getProviderConnection(
        workspaceId: request.context.workspaceId, connectionId: id),
      connection.appSlug == "beehiiv", scopes.isSubset(of: Set(connection.grantedScopes)),
      let organizationId = connection.health.diagnostics["organizationId"]?.string,
      BeehiivSupport.organizationId(organizationId),
      connection.health.diagnostics["apiOrigin"]?.string == "https://api.beehiiv.com",
      let reference = connection.credentialRequirements.first(where: {
        $0.fieldKey == "beehiiv_oauth_access_token"
      })?.secretReferenceId
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "beehiiv_connection_not_ready",
        message: "beehiiv exact-organization OAuth connection is not ready.")
    }
    return (try secrets.getSecretValue(reference), organizationId)
  }
  private func get(
    _ auth: (token: String, organizationId: String), origin: String, path: String,
    query: [URLQueryItem]
  ) throws -> JSONValue {
    var components = URLComponents(string: origin + path)!
    components.queryItems = query.isEmpty ? nil : query
    let response = try http.send(
      BeehiivProviderHTTPRequest(
        url: components.url!,
        headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json"]))
    guard response.body.count <= 2_000_000 else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "beehiiv_response_too_large", message: "beehiiv response exceeded 2 MB.")
    }
    let value =
      (try? JSONSerialization.jsonObject(with: response.body)).map(BeehiivSupport.json) ?? .null
    guard (200..<300).contains(response.statusCode) else {
      throw MarketplaceProviderActionAdapterFailure(
        code: response.statusCode == 401
          ? "beehiiv_token_invalid_or_revoked"
          : response.statusCode == 403
            ? "beehiiv_scope_forbidden"
            : response.statusCode == 429 ? "beehiiv_rate_limited" : "beehiiv_api_error",
        message: "beehiiv API request failed.", providerStatusCode: response.statusCode)
    }
    return value
  }
  private func output(_ fields: JSONRecord) -> BeehiivProviderActionClientResult {
    BeehiivProviderActionClientResult(
      result: [
        "provider": .string("beehiiv"),
        "adapterBoundary": .string("beehiiv-provider-action-adapter"),
        "rawProviderToolExposure": .bool(false),
        "redactionStatus": .string("subscriber-and-content-excluded"),
      ].merging(fields) { _, new in new })
  }
}

public struct BeehiivProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = [
    "beehiiv_account_get", "beehiiv_publication_list", "beehiiv_post_list",
  ]
  private let client: any BeehiivProviderActionClient
  public init(client: any BeehiivProviderActionClient = FakeBeehiivProviderActionClient()) {
    self.client = client
  }
  public func execute(request: MarketplaceProviderActionAdapterRequest) throws
    -> MarketplaceProviderActionAdapterResult
  {
    guard request.app.slug == "beehiiv", Self.allowed.contains(request.definition.actionKey) else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "beehiiv_action_not_allowlisted",
        message: "beehiiv action is outside bounded metadata-only V1.")
    }
    return MarketplaceProviderActionAdapterResult(
      result: try client.executeBeehiivAction(request: request).result, error: nil,
      redactionStatus: "subscriber-and-content-excluded")
  }
}

enum BeehiivSupport {
  static let firstPage = [
    URLQueryItem(name: "limit", value: "25"), URLQueryItem(name: "page", value: "1"),
    URLQueryItem(name: "direction", value: "desc"),
    URLQueryItem(name: "order_by", value: "created"),
  ]
  static func organizationId(_ value: String) -> Bool {
    value.range(of: #"^org_[0-9a-fA-F-]{1,64}$"#, options: .regularExpression) != nil
  }
  static func requiredPublicationId(_ value: JSONValue?) throws -> String {
    guard let id = value?.string,
      id.range(of: #"^pub_[0-9a-fA-F-]{1,64}$"#, options: .regularExpression) != nil
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "beehiiv_publication_id_invalid", message: "beehiiv publication ID is invalid.")
    }
    return id
  }
  static func account(_ value: JSONValue) throws -> JSONRecord {
    let object = value.beehiivObject ?? [:]
    guard let id = object["resource_owner_id"]?.string, organizationId(id) else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "beehiiv_organization_id_invalid", message: "beehiiv organization ID is invalid.")
    }
    return [
      "OrganizationId": .string(id), "ExpiresInSeconds": scalar(object["expires_in_seconds"]),
      "CreatedAtEpoch": scalar(object["created_at"]),
    ]
  }
  static func publication(_ value: JSONValue) throws -> JSONRecord {
    let object = value.beehiivObject ?? [:]
    return [
      "PublicationId": .string(try requiredPublicationId(object["id"])),
      "ReferralProgramEnabled": scalar(object["referral_program_enabled"]),
      "CreatedAtEpoch": scalar(object["created"]),
    ]
  }
  static func post(_ value: JSONValue) throws -> JSONRecord {
    let object = value.beehiivObject ?? [:]
    guard let id = object["id"]?.string,
      id.range(of: #"^post_[0-9a-fA-F-]{1,64}$"#, options: .regularExpression) != nil
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "beehiiv_post_id_invalid", message: "beehiiv post ID is invalid.")
    }
    return [
      "PostId": .string(id),
      "Status": allowed(object["status"], ["draft", "confirmed", "archived"]),
      "Audience": allowed(object["audience"], ["free", "premium"]),
      "Platform": allowed(object["platform"], ["web", "email", "both"]),
      "SplitTested": scalar(object["split_tested"]), "CreatedAtEpoch": scalar(object["created"]),
      "PublishDateEpoch": scalar(object["publish_date"]),
      "DisplayedDateEpoch": scalar(object["displayed_date"]),
    ]
  }
  static func allowed(_ value: JSONValue?, _ values: Set<String>) -> JSONValue {
    guard let text = value?.string, values.contains(text) else { return .null }
    return .string(text)
  }
  static func scalar(_ value: JSONValue?) -> JSONValue {
    guard let value else { return .null }
    switch value {
    case .string, .number, .bool, .null: return value
    default: return .null
    }
  }
  static func json(_ any: Any) -> JSONValue {
    if any is NSNull { return .null }
    if let value = any as? Bool { return .bool(value) }
    if let value = any as? String { return .string(value) }
    if let value = any as? NSNumber { return .number(value.doubleValue) }
    if let value = any as? [Any] { return .array(value.map(json)) }
    if let value = any as? [String: Any] { return .object(value.mapValues(json)) }
    return .null
  }
  static func fakeAccount() -> JSONRecord {
    [
      "OrganizationId": .string("org_00000000-0000-0000-0000-000000000000"),
      "ExpiresInSeconds": .number(7200),
    ]
  }
  static func fakePublication() -> JSONRecord {
    [
      "PublicationId": .string("pub_00000000-0000-0000-0000-000000000000"),
      "ReferralProgramEnabled": .bool(true),
    ]
  }
  static func fakePost() -> JSONRecord {
    [
      "PostId": .string("post_00000000-0000-0000-0000-000000000000"),
      "Status": .string("confirmed"), "Audience": .string("free"), "Platform": .string("both"),
    ]
  }
}
extension JSONValue {
  fileprivate var beehiivObject: JSONRecord? {
    if case .object(let value) = self { return value }
    return nil
  }
  fileprivate var beehiivArray: [JSONValue]? {
    if case .array(let value) = self { return value }
    return nil
  }
}
