import Foundation

public struct VercelProviderActionClientResult: Sendable {
  public var result: JSONRecord
  public init(result: JSONRecord) { self.result = result }
}
public protocol VercelProviderActionClient: Sendable {
  func executeVercelAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> VercelProviderActionClientResult
}
public struct FakeVercelProviderActionClient: VercelProviderActionClient {
  public init() {}
  public func executeVercelAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> VercelProviderActionClientResult
  {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "vercel_project_list":
      fields = [
        "semanticReadContract": .string("vercel-project-list-v1"),
        "projects": .array([.object(VercelProviderActionSupport.fakeProject())]),
        "returnedCount": .number(1), "more": .bool(false),
      ]
    case "vercel_project_get":
      fields = [
        "semanticReadContract": .string("vercel-project-get-v1"),
        "project": .object(VercelProviderActionSupport.fakeProject()),
      ]
    case "vercel_deployment_list":
      fields = [
        "semanticReadContract": .string("vercel-deployment-list-v1"),
        "deployments": .array([.object(VercelProviderActionSupport.fakeDeployment())]),
        "returnedCount": .number(1), "more": .bool(false),
      ]
    default:
      throw MarketplaceProviderActionAdapterFailure(
        code: "vercel_action_not_supported", message: "Unsupported Vercel action.")
    }
    return VercelProviderActionClientResult(
      result: [
        "provider": .string("vercel"), "adapterBoundary": .string("vercel-provider-action-adapter"),
        "clientMode": .string("fake-vercel-rest-client"), "rawProviderToolExposure": .bool(false),
        "redactionStatus": .string("logs-files-environment-source-excluded"),
      ].merging(fields) { _, n in n })
  }
}

public final class LiveVercelProviderActionClient: VercelProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService
  private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) {
    self.data = data
    self.secrets = secrets
  }
  public func executeVercelAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> VercelProviderActionClientResult
  {
    let auth = try authorization(request)
    let limit = VercelProviderActionSupport.bound(request.payload["limit"])
    switch request.definition.actionKey {
    case "vercel_project_list":
      let root = try get(
        auth, path: "/v9/projects",
        query: common(auth) + [URLQueryItem(name: "limit", value: String(limit))])
      let values = (root.vObject?["projects"]?.vArray ?? []).prefix(limit).map(
        VercelProviderActionSupport.project)
      let pagination = root.vObject?["pagination"]?.vObject
      return VercelProviderActionClientResult(
        result: base("vercel-project-list-v1").merging([
          "projects": .array(values.map(JSONValue.object)),
          "returnedCount": .number(Double(values.count)),
          "more": .bool(pagination?["next"] != nil && pagination?["next"] != .null),
          "automaticPagination": .bool(false),
          "rateLimit": root.vObject?["_relayRate"] ?? .object([:]),
        ]) { _, n in n })
    case "vercel_project_get":
      let root = try get(auth, path: "/v9/projects/" + auth.projectId, query: common(auth))
      return VercelProviderActionClientResult(
        result: base("vercel-project-get-v1").merging([
          "project": .object(VercelProviderActionSupport.project(root))
        ]) { _, n in n })
    case "vercel_deployment_list":
      let root = try get(
        auth, path: "/v6/deployments",
        query: common(auth) + [
          URLQueryItem(name: "projectId", value: auth.projectId),
          URLQueryItem(name: "limit", value: String(limit)),
        ])
      let values = (root.vObject?["deployments"]?.vArray ?? []).prefix(limit).map(
        VercelProviderActionSupport.deployment)
      let pagination = root.vObject?["pagination"]?.vObject
      return VercelProviderActionClientResult(
        result: base("vercel-deployment-list-v1").merging([
          "deployments": .array(values.map(JSONValue.object)),
          "returnedCount": .number(Double(values.count)),
          "more": .bool(pagination?["next"] != nil && pagination?["next"] != .null),
          "automaticPagination": .bool(false),
          "rateLimit": root.vObject?["_relayRate"] ?? .object([:]),
        ]) { _, n in n })
    default:
      throw MarketplaceProviderActionAdapterFailure(
        code: "vercel_live_action_not_supported", message: "Unsupported live Vercel action.")
    }
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (
    token: String, teamId: String?, projectId: String
  ) {
    guard let id = request.auditIdentity.connectionId,
      let c = try data.getProviderConnection(
        workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "vercel",
      c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
      c.health.diagnostics["apiOrigin"]?.string == VercelProviderActionSupport.apiOrigin,
      let project = c.health.diagnostics["projectId"]?.string,
      VercelProviderActionSupport.safeId(project),
      let ref = c.credentialRequirements.first(where: {
        $0.fieldKey == "vercel_integration_access_token"
      })?.secretReferenceId
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "vercel_connection_not_ready",
        message: "Vercel requires a ready exact-scope integration connection.")
    }
    return (try secrets.getSecretValue(ref), c.health.diagnostics["teamId"]?.string, project)
  }
  private func common(_ auth: (token: String, teamId: String?, projectId: String)) -> [URLQueryItem]
  { auth.teamId.map { [URLQueryItem(name: "teamId", value: $0)] } ?? [] }
  private func get(
    _ auth: (token: String, teamId: String?, projectId: String), path: String, query: [URLQueryItem]
  ) throws -> JSONValue {
    var c = URLComponents(string: VercelProviderActionSupport.apiOrigin + path)
    c?.queryItems = query
    guard let url = c?.url else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "vercel_invalid_url", message: "Could not build an allowlisted Vercel API URL.")
    }
    var request = URLRequest(url: url)
    request.timeoutInterval = 20
    request.setValue("Bearer " + auth.token, forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    let semaphore = DispatchSemaphore(value: 0)
    var result: Result<(Data, Int, [AnyHashable: Any]), Error>!
    URLSession.shared.dataTask(with: request) { d, r, e in
      result =
        e.map(Result.failure)
        ?? .success(
          (
            d ?? Data(), (r as? HTTPURLResponse)?.statusCode ?? 0,
            (r as? HTTPURLResponse)?.allHeaderFields ?? [:]
          ))
      semaphore.signal()
    }.resume()
    guard semaphore.wait(timeout: .now() + 20) == .success else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "vercel_timeout", message: "Vercel API request timed out.")
    }
    let (bytes, status, headers) = try result.get()
    let reset =
      headers.first { String(describing: $0.key).lowercased() == "x-ratelimit-reset" }.flatMap {
        Double(String(describing: $0.value))
      } ?? 0
    guard (200..<300).contains(status) else {
      throw MarketplaceProviderActionAdapterFailure(
        code: status == 429
          ? "vercel_rate_limited"
          : status == 401
            ? "vercel_access_token_invalid"
            : status == 403
              ? "vercel_scope_denied" : status == 404 ? "vercel_not_found" : "vercel_api_error",
        message: "Vercel API request failed.", providerStatusCode: status,
        detail: ["rateLimitReset": .number(reset)])
    }
    var value =
      bytes.isEmpty
      ? JSONValue.object([:])
      : VercelProviderActionSupport.json(try JSONSerialization.jsonObject(with: bytes))
    if case .object(var o) = value {
      o["_relayRate"] = .object(["reset": .number(reset)])
      value = .object(o)
    }
    return value
  }
  private func base(_ contract: String) -> JSONRecord {
    [
      "provider": .string("vercel"), "adapterBoundary": .string("vercel-provider-action-adapter"),
      "clientMode": .string("live-vercel-rest-api"), "semanticReadContract": .string(contract),
      "rawProviderToolExposure": .bool(false),
      "redactionStatus": .string("logs-files-environment-source-excluded"),
    ]
  }
}

public struct VercelProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = [
    "vercel_project_list", "vercel_project_get", "vercel_deployment_list",
  ]
  private let client: any VercelProviderActionClient
  public init(client: any VercelProviderActionClient = FakeVercelProviderActionClient()) {
    self.client = client
  }
  public func execute(request: MarketplaceProviderActionAdapterRequest) throws
    -> MarketplaceProviderActionAdapterResult
  {
    guard request.app.slug == "vercel", Self.allowed.contains(request.definition.actionKey),
      request.permission == .allowed
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "vercel_action_not_allowlisted",
        message: "Vercel V1 permits only three bounded reads.")
    }
    return MarketplaceProviderActionAdapterResult(
      result: try client.executeVercelAction(request: request).result, error: nil,
      redactionStatus: "logs-files-environment-source-excluded")
  }
}
public enum VercelProviderActionSupport {
  public static let apiOrigin = "https://api.vercel.com"
  public static func safeId(_ v: String) -> Bool {
    (3...128).contains(v.count)
      && v.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }
  }
  static func bound(_ v: JSONValue?) -> Int {
    max(1, min(25, v?.number.map(Int.init) ?? v?.string.flatMap(Int.init) ?? 10))
  }
  static func scalar(_ v: JSONValue?) -> JSONValue {
    guard let v else { return .null }
    switch v {
    case .string(let s): return .string(String(s.prefix(1200)))
    case .number, .bool, .null: return v
    default: return .null
    }
  }
  static func project(_ v: JSONValue) -> JSONRecord {
    let o = v.vObject ?? [:]
    let latest =
      o["latestDeployments"]?.vArray?.first?.vObject ?? o["targets"]?.vObject?["production"]?
      .vObject ?? [:]
    let domains = o["domains"]?.vArray ?? []
    return [
      "id": scalar(o["id"]), "name": scalar(o["name"]), "framework": scalar(o["framework"]),
      "createdAt": scalar(o["createdAt"]), "updatedAt": scalar(o["updatedAt"]),
      "latestDeployment": .object([
        "id": scalar(latest["id"]), "url": scalar(latest["url"]),
        "state": scalar(latest["state"] ?? latest["readyState"]),
        "createdAt": scalar(latest["createdAt"]),
      ]), "domainCount": .number(Double(domains.count)), "environmentValuesReturned": .bool(false),
      "rawLogsReturned": .bool(false), "sourceMetadataReturned": .bool(false),
    ]
  }
  static func deployment(_ v: JSONValue) -> JSONRecord {
    let o = v.vObject ?? [:]
    let creator = o["creator"]?.vObject ?? [:]
    let project = o["project"]?.vObject ?? [:]
    return [
      "id": scalar(o["uid"] ?? o["id"]), "name": scalar(o["name"]), "url": scalar(o["url"]),
      "state": scalar(o["state"] ?? o["readyState"]), "target": scalar(o["target"]),
      "createdAt": scalar(o["created"] ?? o["createdAt"]),
      "readyAt": scalar(o["ready"] ?? o["readyAt"]),
      "project": .object([
        "id": scalar(project["id"] ?? o["projectId"]), "name": scalar(project["name"]),
      ]),
      "creator": .object([
        "id": scalar(creator["uid"] ?? creator["id"]),
        "name": scalar(creator["username"] ?? creator["name"]),
      ]),
      "environmentValuesReturned": .bool(false), "rawLogsReturned": .bool(false),
      "filesReturned": .bool(false), "sourceMetadataReturned": .bool(false),
    ]
  }
  public static func fakeProject() -> JSONRecord {
    [
      "id": .string("prj_abc123"), "name": .string("relay-web"), "framework": .string("nextjs"),
      "createdAt": .number(1_750_000_000_000), "updatedAt": .number(1_780_000_000_000),
      "latestDeployment": .object([
        "id": .string("dpl_abc123"), "url": .string("relay-web.vercel.app"),
        "state": .string("READY"), "createdAt": .number(1_780_000_000_000),
      ]), "domainCount": .number(2), "environmentValuesReturned": .bool(false),
      "rawLogsReturned": .bool(false), "sourceMetadataReturned": .bool(false),
    ]
  }
  public static func fakeDeployment() -> JSONRecord {
    [
      "id": .string("dpl_abc123"), "name": .string("relay-web"),
      "url": .string("relay-web.vercel.app"), "state": .string("READY"),
      "target": .string("production"), "createdAt": .number(1_780_000_000_000),
      "readyAt": .number(1_780_000_060_000),
      "project": .object(["id": .string("prj_abc123"), "name": .string("relay-web")]),
      "creator": .object(["id": .string("user_abc123"), "name": .string("Alex")]),
      "environmentValuesReturned": .bool(false), "rawLogsReturned": .bool(false),
      "filesReturned": .bool(false), "sourceMetadataReturned": .bool(false),
    ]
  }
  static func json(_ v: Any) -> JSONValue {
    if let x = v as? String { return .string(x) }
    if let x = v as? Bool { return .bool(x) }
    if let x = v as? NSNumber { return .number(x.doubleValue) }
    if let x = v as? [String: Any] { return .object(x.mapValues(json)) }
    if let x = v as? [Any] { return .array(x.map(json)) }
    return .null
  }
}
extension JSONValue {
  fileprivate var vObject: JSONRecord? {
    if case .object(let v) = self { return v }
    return nil
  }
  fileprivate var vArray: [JSONValue]? {
    if case .array(let v) = self { return v }
    return nil
  }
}
