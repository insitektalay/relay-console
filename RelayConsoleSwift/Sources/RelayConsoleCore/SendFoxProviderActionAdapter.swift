import Foundation

public struct SendFoxProviderHTTPRequest: Sendable {
  public let url: URL
  public let headers: [String: String]
  public init(url: URL, headers: [String: String]) {
    self.url = url
    self.headers = headers
  }
}
public struct SendFoxProviderHTTPResponse: Sendable {
  public let statusCode: Int
  public let body: Data
  public init(statusCode: Int, body: Data = Data()) {
    self.statusCode = statusCode
    self.body = body
  }
}
public protocol SendFoxProviderHTTPClient: Sendable {
  func send(_ request: SendFoxProviderHTTPRequest) throws -> SendFoxProviderHTTPResponse
}
private final class SendFoxNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable
{
  func urlSession(
    _ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) { completionHandler(nil) }
}
public struct URLSessionSendFoxProviderHTTPClient: SendFoxProviderHTTPClient {
  public init() {}
  public func send(_ request: SendFoxProviderHTTPRequest) throws -> SendFoxProviderHTTPResponse {
    var value = URLRequest(url: request.url)
    value.httpMethod = "GET"
    value.timeoutInterval = 20
    request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) }
    let session = URLSession(
      configuration: .ephemeral, delegate: SendFoxNoRedirectDelegate(), delegateQueue: nil)
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
        code: "sendfox_http_timeout", message: "SendFox API request timed out.")
    }
    session.invalidateAndCancel()
    if let failure { throw failure }
    return SendFoxProviderHTTPResponse(statusCode: response?.statusCode ?? 0, body: data ?? Data())
  }
}

public struct SendFoxProviderActionClientResult: Sendable {
  public let result: JSONRecord
  public init(result: JSONRecord) { self.result = result }
}
public protocol SendFoxProviderActionClient: Sendable {
  func executeSendFoxAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> SendFoxProviderActionClientResult
}
public struct FakeSendFoxProviderActionClient: SendFoxProviderActionClient {
  public init() {}
  public func executeSendFoxAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> SendFoxProviderActionClientResult
  {
    switch request.definition.actionKey {
    case "sendfox_account_get": return output(["account": .object(SendFoxSupport.fakeAccount())])
    case "sendfox_list_list": return output(["lists": .array([.object(SendFoxSupport.fakeList())])])
    case "sendfox_campaign_list":
      return output(["campaigns": .array([.object(SendFoxSupport.fakeCampaign())])])
    default:
      throw MarketplaceProviderActionAdapterFailure(
        code: "sendfox_fake_action_not_supported", message: "Unsupported SendFox action.")
    }
  }
  private func output(_ fields: JSONRecord) -> SendFoxProviderActionClientResult {
    SendFoxProviderActionClientResult(
      result: [
        "provider": .string("sendfox"),
        "adapterBoundary": .string("sendfox-provider-action-adapter"),
        "rawProviderToolExposure": .bool(false),
        "redactionStatus": .string("contact-and-content-excluded"),
      ].merging(fields) { _, new in new })
  }
}

public final class LiveSendFoxProviderActionClient: SendFoxProviderActionClient, @unchecked Sendable
{
  private let data: LocalDataService
  private let secrets: SecretService
  private let http: any SendFoxProviderHTTPClient
  public init(
    data: LocalDataService, secrets: SecretService,
    httpClient: any SendFoxProviderHTTPClient = URLSessionSendFoxProviderHTTPClient()
  ) {
    self.data = data
    self.secrets = secrets
    self.http = httpClient
  }
  public func executeSendFoxAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> SendFoxProviderActionClientResult
  {
    let auth = try authorization(request)
    switch request.definition.actionKey {
    case "sendfox_account_get":
      let root = try get(auth, path: "/me", page: false)
      let account = SendFoxSupport.account(root)
      guard account["AccountId"]?.string == auth.accountId else {
        throw MarketplaceProviderActionAdapterFailure(
          code: "sendfox_account_changed", message: "SendFox exact-account binding changed.")
      }
      return output(["account": .object(account)])
    case "sendfox_list_list":
      let root = try get(auth, path: "/lists", page: true)
      let values = try (root.sendFoxObject?["data"]?.sendFoxArray ?? []).prefix(25).map {
        value -> JSONValue in
        let summary = SendFoxSupport.list(value)
        guard summary["OwnerId"]?.string == auth.accountId else {
          throw MarketplaceProviderActionAdapterFailure(
            code: "sendfox_account_changed",
            message: "SendFox contact-list ownership changed.")
        }
        var redacted = summary
        redacted.removeValue(forKey: "OwnerId")
        return .object(redacted)
      }
      return output(["lists": .array(Array(values))])
    case "sendfox_campaign_list":
      let root = try get(auth, path: "/campaigns", page: true)
      let values = (root.sendFoxObject?["data"]?.sendFoxArray ?? []).prefix(25).map {
        JSONValue.object(SendFoxSupport.campaign($0))
      }
      return output(["campaigns": .array(Array(values))])
    default:
      throw MarketplaceProviderActionAdapterFailure(
        code: "sendfox_live_action_not_supported", message: "Unsupported SendFox action.")
    }
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (
    token: String, accountId: String
  ) {
    guard let id = request.auditIdentity.connectionId,
      let c = try data.getProviderConnection(
        workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "sendfox",
      c.grantedScopes.isEmpty, let account = c.health.diagnostics["accountId"]?.string,
      SendFoxSupport.safeId(account),
      c.health.diagnostics["apiOrigin"]?.string == "https://api.sendfox.com",
      let ref = c.credentialRequirements.first(where: {
        $0.fieldKey == "sendfox_oauth_access_token"
      })?.secretReferenceId
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "sendfox_connection_not_ready",
        message: "SendFox exact-account OAuth connection is not ready.")
    }
    return (try secrets.getSecretValue(ref), account)
  }
  private func get(_ auth: (token: String, accountId: String), path: String, page: Bool) throws
    -> JSONValue
  {
    var components = URLComponents(string: "https://api.sendfox.com" + path)!
    components.queryItems = page ? [URLQueryItem(name: "page", value: "1")] : nil
    let response = try http.send(
      SendFoxProviderHTTPRequest(
        url: components.url!,
        headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json"]))
    let value =
      (try? JSONSerialization.jsonObject(with: response.body)).map(SendFoxSupport.json) ?? .null
    guard (200..<300).contains(response.statusCode) else {
      throw MarketplaceProviderActionAdapterFailure(
        code: response.statusCode == 401
          ? "sendfox_token_invalid_or_revoked"
          : response.statusCode == 402 || response.statusCode == 403
            ? "sendfox_plan_or_account_forbidden"
            : response.statusCode == 429 ? "sendfox_rate_limited" : "sendfox_api_error",
        message: "SendFox API request failed.", providerStatusCode: response.statusCode)
    }
    return value
  }
  private func output(_ fields: JSONRecord) -> SendFoxProviderActionClientResult {
    SendFoxProviderActionClientResult(
      result: [
        "provider": .string("sendfox"),
        "adapterBoundary": .string("sendfox-provider-action-adapter"),
        "rawProviderToolExposure": .bool(false),
        "redactionStatus": .string("contact-and-content-excluded"),
      ].merging(fields) { _, new in new })
  }
}

public struct SendFoxProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = [
    "sendfox_account_get", "sendfox_list_list", "sendfox_campaign_list",
  ]
  private let client: any SendFoxProviderActionClient
  public init(client: any SendFoxProviderActionClient = FakeSendFoxProviderActionClient()) {
    self.client = client
  }
  public func execute(request: MarketplaceProviderActionAdapterRequest) throws
    -> MarketplaceProviderActionAdapterResult
  {
    guard request.app.slug == "sendfox", Self.allowed.contains(request.definition.actionKey) else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "sendfox_action_not_allowlisted",
        message: "SendFox action is outside bounded metadata-only V1.")
    }
    return MarketplaceProviderActionAdapterResult(
      result: try client.executeSendFoxAction(request: request).result, error: nil,
      redactionStatus: "contact-and-content-excluded")
  }
}

enum SendFoxSupport {
  static func safeId(_ value: String) -> Bool {
    !value.isEmpty && value.count <= 19 && value.allSatisfy { $0.isNumber } && value.first != "0"
  }
  static func account(_ value: JSONValue) -> JSONRecord {
    let o = value.sendFoxObject ?? [:]
    return [
      "AccountId": identifier(o["id"]), "ContactsCount": scalar(o["contacts_count"]),
      "ContactLimit": scalar(o["contact_limit"]), "CreatedAt": scalar(o["created_at"]),
    ]
  }
  static func list(_ value: JSONValue) -> JSONRecord {
    let o = value.sendFoxObject ?? [:]
    return [
      "ListId": identifier(o["id"]), "OwnerId": identifier(o["user_id"]), "Name": scalar(o["name"]),
      "AverageOpenPercent": scalar(o["average_email_open_percent"]),
      "AverageClickPercent": scalar(o["average_email_click_percent"]),
      "CreatedAt": scalar(o["created_at"]), "UpdatedAt": scalar(o["updated_at"]),
    ]
  }
  static func campaign(_ value: JSONValue) -> JSONRecord {
    let o = value.sendFoxObject ?? [:]
    let state: JSONValue =
      o["sent_at"]?.string != nil
      ? .string("sent") : o["scheduled_at"]?.string != nil ? .string("scheduled") : .string("draft")
    return [
      "CampaignId": identifier(o["id"]), "State": state, "ScheduledAt": scalar(o["scheduled_at"]),
      "SentAt": scalar(o["sent_at"]), "CreatedAt": scalar(o["created_at"]),
      "UpdatedAt": scalar(o["updated_at"]),
    ]
  }
  static func scalar(_ value: JSONValue?) -> JSONValue {
    guard let value else { return .null }
    switch value {
    case .string, .number, .bool, .null: return value
    default: return .null
    }
  }
  static func identifier(_ value: JSONValue?) -> JSONValue {
    switch value {
    case .string(let raw) where safeId(raw):
      return .string(raw)
    case .number(let raw) where raw.rounded() == raw && raw > 0 && raw <= Double(Int64.max):
      return .string(String(Int64(raw)))
    default:
      return .null
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
      "AccountId": .string("42"), "ContactsCount": .number(120), "ContactLimit": .number(5000),
      "CreatedAt": .string("2024-01-02T03:04:05Z"),
    ]
  }
  static func fakeList() -> JSONRecord {
    [
      "ListId": .string("7"), "Name": .string("Product updates"), "AverageOpenPercent": .number(40),
      "AverageClickPercent": .number(5),
    ]
  }
  static func fakeCampaign() -> JSONRecord {
    [
      "CampaignId": .string("8"), "State": .string("sent"),
      "SentAt": .string("2026-07-01T00:00:00Z"),
    ]
  }
}
extension JSONValue {
  fileprivate var sendFoxObject: JSONRecord? {
    if case .object(let value) = self { return value }
    return nil
  }
  fileprivate var sendFoxArray: [JSONValue]? {
    if case .array(let value) = self { return value }
    return nil
  }
}
