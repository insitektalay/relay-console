import Foundation

public struct GoogleDriveProviderActionClientResult: Sendable {
  public var result: JSONRecord
  public init(result: JSONRecord) { self.result = result }
}

public protocol GoogleDriveProviderActionClient: Sendable {
  func executeGoogleDriveAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> GoogleDriveProviderActionClientResult
}

public struct FakeGoogleDriveProviderActionClient: GoogleDriveProviderActionClient {
  public init() {}
  public func executeGoogleDriveAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> GoogleDriveProviderActionClientResult
  {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_drive_search_files":
      fields = [
        "semanticReadContract": .string("google-drive-app-visible-search-v1"),
        "files": .array([.object(GoogleDriveProviderActionSupport.fakeFile())]),
      ]
    case "google_drive_get_file_metadata":
      fields = [
        "semanticReadContract": .string("google-drive-file-metadata-v1"),
        "file": .object(GoogleDriveProviderActionSupport.fakeFile()),
      ]
    case "google_drive_read_file_content":
      fields = [
        "semanticReadContract": .string("google-drive-bounded-content-v1"),
        "file": .object(GoogleDriveProviderActionSupport.fakeContent()),
      ]
    case "google_drive_prepare_file":
      fields = [
        "semanticDraftContract": .string("google-drive-file-prepare-v1"),
        "draftPreview": .object([
          "providerMutation": .bool(false), "appVisibleCorpusRequired": .bool(true),
        ]),
      ]
    case "google_drive_create_file":
      fields = [
        "semanticWriteContract": .string("google-drive-file-create-v1"),
        "file": .object(GoogleDriveProviderActionSupport.fakeFile()),
        "providerMutation": .bool(true),
      ]
    case "google_drive_copy_file":
      fields = [
        "semanticWriteContract": .string("google-drive-file-copy-v1"),
        "file": .object(GoogleDriveProviderActionSupport.fakeFile()),
        "providerMutation": .bool(true),
      ]
    default:
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_drive_action_not_supported", message: "Unsupported Google Drive action.")
    }
    return GoogleDriveProviderActionClientResult(
      result: GoogleDriveProviderActionSupport.base("fake-drive-api-v3").merging(fields) { _, new in
        new
      })
  }
}

public final class LiveGoogleDriveProviderActionClient: GoogleDriveProviderActionClient,
  @unchecked Sendable
{
  private let data: LocalDataService
  private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) {
    self.data = data
    self.secrets = secrets
  }

  public func executeGoogleDriveAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> GoogleDriveProviderActionClientResult
  {
    let token = try authorization(request)
    switch request.definition.actionKey {
    case "google_drive_search_files":
      let query = try GoogleDriveProviderActionSupport.optionalString(
        request.payload["query"], name: "query", max: 200)
      let limit = GoogleDriveProviderActionSupport.bound(request.payload["maxResults"], maximum: 10)
      var q = "trashed = false"
      if let query {
        q += " and name contains '\(GoogleDriveProviderActionSupport.queryLiteral(query))'"
      }
      let root = try sendJSON(
        token: token, method: "GET", origin: GoogleDriveProviderActionSupport.apiOrigin,
        path: "/files",
        query: [
          URLQueryItem(name: "q", value: q), URLQueryItem(name: "spaces", value: "drive"),
          URLQueryItem(name: "pageSize", value: String(limit)),
          URLQueryItem(name: "orderBy", value: "modifiedTime desc"),
          URLQueryItem(
            name: "fields",
            value:
              "files(id,name,mimeType,modifiedTime,createdTime,size,parents,webViewLink,ownedByMe,capabilities(canCopy,canDownload))"
          ),
        ], body: nil)
      let files = GoogleDriveProviderActionSupport.array(
        GoogleDriveProviderActionSupport.object(root)["files"]
      ).prefix(limit).map { JSONValue.object(GoogleDriveProviderActionSupport.file($0)) }
      return mapped(
        "semanticReadContract", "google-drive-app-visible-search-v1",
        ["files": .array(Array(files))])
    case "google_drive_get_file_metadata":
      let id = try GoogleDriveProviderActionSupport.requiredString(
        request.payload["fileId"], name: "fileId", max: 1024)
      let root = try fileMetadata(token: token, id: id)
      return mapped(
        "semanticReadContract", "google-drive-file-metadata-v1",
        ["file": .object(GoogleDriveProviderActionSupport.file(root))])
    case "google_drive_read_file_content":
      let id = try GoogleDriveProviderActionSupport.requiredString(
        request.payload["fileId"], name: "fileId", max: 1024)
      let limit = GoogleDriveProviderActionSupport.bound(
        request.payload["maxContentChars"], maximum: 8000)
      let metadata = try fileMetadata(token: token, id: id)
      let mime = GoogleDriveProviderActionSupport.object(metadata)["mimeType"]?.string ?? ""
      let export = GoogleDriveProviderActionSupport.exportMimeType(for: mime)
      let bytes = try sendBytes(
        token: token, method: "GET", origin: GoogleDriveProviderActionSupport.apiOrigin,
        path: export == nil
          ? "/files/\(GoogleDriveProviderActionSupport.path(id))"
          : "/files/\(GoogleDriveProviderActionSupport.path(id))/export",
        query: export == nil
          ? [URLQueryItem(name: "alt", value: "media")]
          : [URLQueryItem(name: "mimeType", value: export!)], body: nil, contentType: nil)
      guard bytes.count <= 1_000_000, let text = String(data: bytes, encoding: .utf8) else {
        throw MarketplaceProviderActionAdapterFailure(
          code: "google_drive_content_not_bounded_text",
          message: "Google Drive V1 reads only bounded UTF-8 text or Workspace text exports.")
      }
      var file = GoogleDriveProviderActionSupport.file(metadata)
      file["contentExcerpt"] = .string(String(text.prefix(limit)))
      file["contentTruncated"] = .bool(text.count > limit)
      file["exportMimeType"] = export.map(JSONValue.string) ?? .null
      return mapped(
        "semanticReadContract", "google-drive-bounded-content-v1", ["file": .object(file)])
    case "google_drive_prepare_file":
      let operation = try GoogleDriveProviderActionSupport.requiredString(
        request.payload["operation"], name: "operation", max: 16)
      guard ["create", "copy"].contains(operation) else {
        throw MarketplaceProviderActionAdapterFailure(
          code: "google_drive_invalid_operation",
          message: "Drive preparation supports create or copy only.")
      }
      return mapped(
        "semanticDraftContract", "google-drive-file-prepare-v1",
        [
          "draftPreview": .object([
            "operation": .string(operation), "name": request.payload["name"] ?? .null,
            "sourceFileId": request.payload["sourceFileId"] ?? .null,
            "providerMutation": .bool(false), "appVisibleCorpusRequired": .bool(true),
          ])
        ])
    case "google_drive_create_file":
      let metadata = try GoogleDriveProviderActionSupport.createMetadata(request.payload)
      let root: JSONValue
      if let content = request.payload["textContent"]?.string {
        guard content.count <= 50_000 else {
          throw MarketplaceProviderActionAdapterFailure(
            code: "google_drive_content_too_large",
            message: "Drive text creation is limited to 50,000 characters.")
        }
        let boundary =
          "RelayDriveBoundary\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))"
        let metaData = try JSONEncoder().encode(JSONValue.object(metadata))
        var bytes = Data(
          "--\(boundary)\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n".utf8)
        bytes.append(metaData)
        bytes.append(
          Data(
            "\r\n--\(boundary)\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n\(content)\r\n--\(boundary)--\r\n"
              .utf8))
        root = try sendJSONData(
          token: token, method: "POST", origin: GoogleDriveProviderActionSupport.uploadOrigin,
          path: "/files",
          query: [
            URLQueryItem(name: "uploadType", value: "multipart"),
            URLQueryItem(name: "fields", value: GoogleDriveProviderActionSupport.fileFields),
          ], body: bytes, contentType: "multipart/related; boundary=\(boundary)")
      } else {
        root = try sendJSON(
          token: token, method: "POST", origin: GoogleDriveProviderActionSupport.apiOrigin,
          path: "/files",
          query: [URLQueryItem(name: "fields", value: GoogleDriveProviderActionSupport.fileFields)],
          body: metadata)
      }
      return mapped(
        "semanticWriteContract", "google-drive-file-create-v1",
        [
          "file": .object(GoogleDriveProviderActionSupport.file(root)),
          "providerMutation": .bool(true),
        ])
    case "google_drive_copy_file":
      let source = try GoogleDriveProviderActionSupport.requiredString(
        request.payload["sourceFileId"], name: "sourceFileId", max: 1024)
      let metadata = try GoogleDriveProviderActionSupport.copyMetadata(request.payload)
      let root = try sendJSON(
        token: token, method: "POST", origin: GoogleDriveProviderActionSupport.apiOrigin,
        path: "/files/\(GoogleDriveProviderActionSupport.path(source))/copy",
        query: [URLQueryItem(name: "fields", value: GoogleDriveProviderActionSupport.fileFields)],
        body: metadata)
      return mapped(
        "semanticWriteContract", "google-drive-file-copy-v1",
        [
          "file": .object(GoogleDriveProviderActionSupport.file(root)),
          "sourceFileId": .string(source), "providerMutation": .bool(true),
        ])
    default:
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_drive_live_action_not_supported",
        message: "Unsupported live Google Drive action.")
    }
  }

  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
    guard let id = request.auditIdentity.connectionId,
      let connection = try data.getProviderConnection(
        workspaceId: request.context.workspaceId, connectionId: id),
      connection.appSlug == "google-drive", connection.appId == request.app.id,
      connection.status == .connected, connection.health.state == .ready,
      connection.grantedScopes == ProviderConnectionService.googleDriveRelayOwnedOAuthScopes,
      connection.health.diagnostics["appVisibleFileCorpusEnforced"]?.bool == true,
      let ref = connection.credentialRequirements.first(where: {
        $0.fieldKey == "google_drive_oauth_access_token"
      })?.secretReferenceId
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_drive_connection_not_ready",
        message: "Google Drive requires a ready exact-scope Relay-owned connection.")
    }
    return try secrets.getSecretValue(ref)
  }

  private func fileMetadata(token: String, id: String) throws -> JSONValue {
    try sendJSON(
      token: token, method: "GET", origin: GoogleDriveProviderActionSupport.apiOrigin,
      path: "/files/\(GoogleDriveProviderActionSupport.path(id))",
      query: [URLQueryItem(name: "fields", value: GoogleDriveProviderActionSupport.fileFields)],
      body: nil)
  }
  private func sendJSON(
    token: String, method: String, origin: String, path: String, query: [URLQueryItem],
    body: JSONRecord?
  ) throws -> JSONValue {
    let data = try body.map { try JSONEncoder().encode(JSONValue.object($0)) }
    return try sendJSONData(
      token: token, method: method, origin: origin, path: path, query: query, body: data,
      contentType: body == nil ? nil : "application/json")
  }
  private func sendJSONData(
    token: String, method: String, origin: String, path: String, query: [URLQueryItem], body: Data?,
    contentType: String?
  ) throws -> JSONValue {
    let bytes = try sendBytes(
      token: token, method: method, origin: origin, path: path, query: query, body: body,
      contentType: contentType)
    return bytes.isEmpty
      ? .object([:])
      : GoogleDriveProviderActionSupport.json(try JSONSerialization.jsonObject(with: bytes))
  }
  private func sendBytes(
    token: String, method: String, origin: String, path: String, query: [URLQueryItem], body: Data?,
    contentType: String?
  ) throws -> Data {
    var components = URLComponents(string: origin + path)
    components?.queryItems = query.isEmpty ? nil : query
    guard let url = components?.url else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_drive_invalid_url", message: "Could not build allowlisted Google Drive URL.")
    }
    var request = URLRequest(url: url)
    request.httpMethod = method
    request.timeoutInterval = 30
    request.httpBody = body
    request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    if let contentType { request.setValue(contentType, forHTTPHeaderField: "Content-Type") }
    let semaphore = DispatchSemaphore(value: 0)
    var outcome: Result<(Data, Int), Error>!
    URLSession.shared.dataTask(with: request) { data, response, error in
      outcome =
        error.map(Result.failure)
        ?? .success((data ?? Data(), (response as? HTTPURLResponse)?.statusCode ?? 0))
      semaphore.signal()
    }.resume()
    guard semaphore.wait(timeout: .now() + 30) == .success else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_drive_timeout", message: "Google Drive request timed out.")
    }
    let (bytes, status) = try outcome.get()
    guard (200..<300).contains(status) else {
      throw MarketplaceProviderActionAdapterFailure(
        code: status == 401
          ? "google_drive_access_token_invalid"
          : status == 403
            ? "google_drive_scope_or_file_denied"
            : status == 404
              ? "google_drive_file_not_found_or_not_app_visible"
              : status == 429 ? "google_drive_rate_limited" : "google_drive_api_error",
        message: "Google Drive API request failed.", providerStatusCode: status)
    }
    return bytes
  }
  private func mapped(_ key: String, _ contract: String, _ fields: JSONRecord)
    -> GoogleDriveProviderActionClientResult
  {
    GoogleDriveProviderActionClientResult(
      result: GoogleDriveProviderActionSupport.base("live-drive-api-v3").merging(
        [key: .string(contract)].merging(fields) { _, new in new }
      ) { _, new in new })
  }
}

public struct GoogleDriveProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = [
    "google_drive_search_files", "google_drive_get_file_metadata", "google_drive_read_file_content",
    "google_drive_prepare_file", "google_drive_create_file", "google_drive_copy_file",
  ]
  private let client: any GoogleDriveProviderActionClient
  public init(client: any GoogleDriveProviderActionClient = FakeGoogleDriveProviderActionClient()) {
    self.client = client
  }
  public func execute(request: MarketplaceProviderActionAdapterRequest) throws
    -> MarketplaceProviderActionAdapterResult
  {
    guard request.app.slug == "google-drive", Self.allowed.contains(request.definition.actionKey)
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_drive_action_not_allowlisted",
        message: "Google Drive action is not allowlisted.")
    }
    let write = ["google_drive_create_file", "google_drive_copy_file"].contains(
      request.definition.actionKey)
    guard write ? request.permission != .blocked : request.permission == .allowed else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_drive_permission_denied",
        message: "Google Drive action is not permitted by the compiled policy.")
    }
    return MarketplaceProviderActionAdapterResult(
      result: try client.executeGoogleDriveAction(request: request).result, error: nil,
      redactionStatus: "credentials-permissions-revisions-comments-excluded")
  }
}

public enum GoogleDriveProviderActionSupport {
  public static let apiOrigin = "https://www.googleapis.com/drive/v3"
  public static let uploadOrigin = "https://www.googleapis.com/upload/drive/v3"
  public static let fileFields =
    "id,name,mimeType,modifiedTime,createdTime,size,parents,webViewLink,ownedByMe,capabilities(canCopy,canDownload)"
  static func base(_ mode: String) -> JSONRecord {
    [
      "provider": .string("google-drive"),
      "adapterBoundary": .string("google-drive-provider-action-adapter"),
      "clientMode": .string(mode),
      "appVisibleFileCorpusEnforced": .bool(true),
      "wholeDriveDiscovery": .bool(false), "automaticPagination": .bool(false),
      "permissionsReturned": .bool(false), "revisionsReturned": .bool(false),
      "commentsReturned": .bool(false), "rawProviderToolExposure": .bool(false),
    ]
  }
  static func object(_ value: JSONValue?) -> JSONRecord {
    guard case .object(let value)? = value else { return [:] }
    return value
  }
  static func array(_ value: JSONValue?) -> [JSONValue] {
    guard case .array(let value)? = value else { return [] }
    return value
  }
  static func scalar(_ value: JSONValue?) -> JSONValue {
    guard let value else { return .null }
    switch value {
    case .string(let text): return .string(String(text.prefix(2000)))
    case .number, .bool, .null: return value
    default: return .null
    }
  }
  static func bound(_ value: JSONValue?, maximum: Int) -> Int {
    max(1, min(maximum, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? maximum))
  }
  static func requiredString(_ value: JSONValue?, name: String, max: Int) throws -> String {
    guard let text = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty,
      text.count <= max
    else {
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_drive_invalid_\(name)", message: "Google Drive requires a bounded \(name).")
    }
    return text
  }
  static func optionalString(_ value: JSONValue?, name: String, max: Int) throws -> String? {
    guard let value else { return nil }
    return try requiredString(value, name: name, max: max)
  }
  static func path(_ value: String) -> String {
    value.addingPercentEncoding(
      withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_~."))) ?? value
  }
  static func queryLiteral(_ value: String) -> String {
    value.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
  }
  static func file(_ value: JSONValue?) -> JSONRecord {
    let r = object(value)
    return [
      "id": scalar(r["id"]), "name": scalar(r["name"]), "mimeType": scalar(r["mimeType"]),
      "modifiedTime": scalar(r["modifiedTime"]), "createdTime": scalar(r["createdTime"]),
      "size": scalar(r["size"]), "parents": .array(array(r["parents"]).prefix(10).map(scalar)),
      "webViewLink": scalar(r["webViewLink"]), "ownedByMe": scalar(r["ownedByMe"]),
      "canCopy": scalar(object(r["capabilities"])["canCopy"]),
      "canDownload": scalar(object(r["capabilities"])["canDownload"]), "appVisible": .bool(true),
      "permissionsReturned": .bool(false), "revisionsReturned": .bool(false),
      "commentsReturned": .bool(false),
    ]
  }
  static func createMetadata(_ payload: JSONRecord) throws -> JSONRecord {
    let name = try requiredString(payload["name"], name: "name", max: 500)
    let suppliedMime = payload["mimeType"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines)
    let mime =
      suppliedMime?.isEmpty == false
      ? suppliedMime!
      : (payload["textContent"] == nil ? "application/vnd.google-apps.folder" : "text/plain")
    var result: JSONRecord = ["name": .string(name), "mimeType": .string(mime)]
    if let parent = try optionalString(payload["parentId"], name: "parentId", max: 1024) {
      result["parents"] = .array([.string(parent)])
    }
    return result
  }
  static func copyMetadata(_ payload: JSONRecord) throws -> JSONRecord {
    var result: JSONRecord = [
      "name": .string(try requiredString(payload["name"], name: "name", max: 500))
    ]
    if let parent = try optionalString(payload["parentId"], name: "parentId", max: 1024) {
      result["parents"] = .array([.string(parent)])
    }
    return result
  }
  static func exportMimeType(for mime: String) -> String? {
    switch mime {
    case "application/vnd.google-apps.document", "application/vnd.google-apps.presentation":
      return "text/plain"
    case "application/vnd.google-apps.spreadsheet": return "text/csv"
    default: return nil
    }
  }
  static func json(_ value: Any) -> JSONValue {
    if let value = value as? String { return .string(value) }
    if let value = value as? Bool { return .bool(value) }
    if let value = value as? NSNumber { return .number(value.doubleValue) }
    if let value = value as? [Any] { return .array(value.map(json)) }
    if let value = value as? [String: Any] { return .object(value.mapValues(json)) }
    return .null
  }
  public static func fakeFile() -> JSONRecord {
    file(
      .object([
        "id": .string("relay-file-101"), "name": .string("Relay brief.txt"),
        "mimeType": .string("text/plain"), "modifiedTime": .string("2026-07-12T09:00:00Z"),
        "createdTime": .string("2026-07-12T08:00:00Z"), "size": .string("128"),
        "parents": .array([.string("relay-folder")]),
        "webViewLink": .string("https://drive.google.com/file/d/relay-file-101/view"),
        "ownedByMe": .bool(true),
        "capabilities": .object(["canCopy": .bool(true), "canDownload": .bool(true)]),
      ]))
  }
  public static func fakeContent() -> JSONRecord {
    var value = fakeFile()
    value["contentExcerpt"] = .string("Bounded Relay Drive content.")
    value["contentTruncated"] = .bool(false)
    return value
  }
}
