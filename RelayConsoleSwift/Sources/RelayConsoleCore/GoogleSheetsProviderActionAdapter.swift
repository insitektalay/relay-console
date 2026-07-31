import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct GoogleSheetsProviderActionClientResult: Sendable {
  public var result: JSONRecord
  public init(result: JSONRecord) { self.result = result }
}

public protocol GoogleSheetsProviderActionClient: Sendable {
  func executeGoogleSheetsAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> GoogleSheetsProviderActionClientResult
}

public struct FakeGoogleSheetsProviderActionClient: GoogleSheetsProviderActionClient {
  public init() {}
  public func executeGoogleSheetsAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> GoogleSheetsProviderActionClientResult
  {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_sheets_spreadsheet_get":
      fields = ["semanticReadContract": .string("google-sheets-spreadsheet-metadata-v1"),
        "spreadsheet": .object(GoogleSheetsProviderActionSupport.fakeSpreadsheet())]
    case "google_sheets_values_get":
      fields = ["semanticReadContract": .string("google-sheets-bounded-values-v1"),
        "valueRange": .object(GoogleSheetsProviderActionSupport.fakeValueRange())]
    case "google_sheets_values_prepare":
      fields = ["semanticDraftContract": .string("google-sheets-values-prepare-v1"),
        "draftPreview": .object(GoogleSheetsProviderActionSupport.preview(request.payload))]
    case "google_sheets_values_update", "google_sheets_values_append":
      fields = ["semanticWriteContract": .string(
          request.definition.actionKey == "google_sheets_values_update"
            ? "google-sheets-values-update-v1" : "google-sheets-values-append-v1"),
        "providerMutation": .bool(true), "updatedRange": request.payload["range"] ?? .null]
    default:
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_sheets_action_not_supported", message: "Unsupported Google Sheets action.")
    }
    return GoogleSheetsProviderActionClientResult(result:
      GoogleSheetsProviderActionSupport.base("fake-sheets-api-v4").merging(fields) { _, new in new })
  }
}

public final class LiveGoogleSheetsProviderActionClient: GoogleSheetsProviderActionClient,
  @unchecked Sendable
{
  private let data: LocalDataService
  private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }

  public func executeGoogleSheetsAction(request: MarketplaceProviderActionAdapterRequest) throws
    -> GoogleSheetsProviderActionClientResult
  {
    if request.definition.actionKey == "google_sheets_values_prepare" {
      return GoogleSheetsProviderActionClientResult(result:
        GoogleSheetsProviderActionSupport.base("local-no-provider-request").merging([
          "semanticDraftContract": .string("google-sheets-values-prepare-v1"),
          "draftPreview": .object(try GoogleSheetsProviderActionSupport.validatedPreview(request.payload)),
          "providerMutation": .bool(false),
        ]) { _, new in new })
    }
    let token = try authorization(request)
    let spreadsheetId = try GoogleSheetsProviderActionSupport.safeId(request.payload["spreadsheetId"])
    let pathId = GoogleSheetsProviderActionSupport.path(spreadsheetId)
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_sheets_spreadsheet_get":
      let root = try send(token: token, method: "GET", path: "/spreadsheets/\(pathId)", query: [
        URLQueryItem(name: "includeGridData", value: "false"),
        URLQueryItem(name: "fields", value: "spreadsheetId,properties(title,locale,timeZone),sheets(properties(sheetId,title,index,sheetType,gridProperties(rowCount,columnCount)))"),
      ], body: nil)
      fields = ["semanticReadContract": .string("google-sheets-spreadsheet-metadata-v1"),
        "spreadsheet": .object(GoogleSheetsProviderActionSupport.spreadsheet(root))]
    case "google_sheets_values_get":
      let range = try GoogleSheetsProviderActionSupport.safeRange(request.payload["range"])
      let root = try send(token: token, method: "GET",
        path: "/spreadsheets/\(pathId)/values/\(GoogleSheetsProviderActionSupport.path(range))",
        query: [URLQueryItem(name: "majorDimension", value: "ROWS")], body: nil)
      fields = ["semanticReadContract": .string("google-sheets-bounded-values-v1"),
        "valueRange": .object(try GoogleSheetsProviderActionSupport.valueRange(root))]
    case "google_sheets_values_update", "google_sheets_values_append":
      let range = try GoogleSheetsProviderActionSupport.safeRange(request.payload["range"])
      let values = try GoogleSheetsProviderActionSupport.values(request.payload["values"])
      let option = try GoogleSheetsProviderActionSupport.inputOption(request.payload["valueInputOption"])
      let append = request.definition.actionKey == "google_sheets_values_append"
      var query = [URLQueryItem(name: "valueInputOption", value: option)]
      if append {
        query += [URLQueryItem(name: "insertDataOption", value: "INSERT_ROWS"),
          URLQueryItem(name: "includeValuesInResponse", value: "false")]
      } else { query.append(URLQueryItem(name: "includeValuesInResponse", value: "false")) }
      let root = try send(token: token, method: append ? "POST" : "PUT",
        path: "/spreadsheets/\(pathId)/values/\(GoogleSheetsProviderActionSupport.path(range))\(append ? ":append" : "")",
        query: query, body: ["range": .string(range), "majorDimension": .string("ROWS"), "values": .array(values)])
      fields = ["semanticWriteContract": .string(append
          ? "google-sheets-values-append-v1" : "google-sheets-values-update-v1"),
        "providerMutation": .bool(true), "response": .object(GoogleSheetsProviderActionSupport.boundedObject(root))]
    default:
      throw MarketplaceProviderActionAdapterFailure(
        code: "google_sheets_live_action_not_supported", message: "Unsupported live Google Sheets action.")
    }
    return GoogleSheetsProviderActionClientResult(result:
      GoogleSheetsProviderActionSupport.base("live-sheets-api-v4").merging(fields) { _, new in new })
  }

  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
    guard let id = request.auditIdentity.connectionId,
      let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id),
      connection.appSlug == "google-sheets", connection.appId == request.app.id,
      connection.status == .connected, connection.health.state == .ready,
      connection.grantedScopes == ProviderConnectionService.googleSheetsRelayOwnedOAuthScopes,
      connection.health.diagnostics["appVisibleSpreadsheetCorpusEnforced"]?.bool == true,
      let ref = connection.credentialRequirements.first(where: {
        $0.fieldKey == "google_sheets_oauth_access_token"
      })?.secretReferenceId
    else {
      throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_connection_not_ready",
        message: "Google Sheets requires a ready exact-scope Relay-owned connection.")
    }
    return try secrets.getSecretValue(ref)
  }

  private func send(token: String, method: String, path: String, query: [URLQueryItem], body: JSONRecord?) throws -> JSONValue {
    var components = URLComponents(string: GoogleSheetsProviderActionSupport.apiOrigin + path)!
    components.queryItems = query
    guard let url = components.url, url.scheme == "https", url.host == "sheets.googleapis.com" else {
      throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_unsafe_url", message: "Unsafe Google Sheets API URL.")
    }
    var request = URLRequest(url: url, timeoutInterval: 30)
    request.httpMethod = method
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    if let body { request.httpBody = try JSONEncoder().encode(JSONValue.object(body)); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
    let semaphore = DispatchSemaphore(value: 0)
    var captured: Result<(Data, HTTPURLResponse), Error>?
    URLSession.shared.dataTask(with: request) { bytes, response, error in
      defer { semaphore.signal() }
      if let error { captured = .failure(error); return }
      guard let bytes, let response = response as? HTTPURLResponse else {
        captured = .failure(MarketplaceProviderActionAdapterFailure(code: "google_sheets_transport_error", message: "Google Sheets returned no HTTP response.")); return
      }
      captured = .success((bytes, response))
    }.resume()
    guard semaphore.wait(timeout: .now() + 31) == .success, let captured else {
      throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_timeout", message: "Google Sheets API request timed out.")
    }
    let (bytes, response) = try captured.get()
    guard (200..<300).contains(response.statusCode) else {
      throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "google_sheets_rate_limited" : "google_sheets_api_error", message: "Google Sheets API request failed.", providerStatusCode: response.statusCode)
    }
    guard bytes.count <= 2_000_000 else {
      throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_response_too_large", message: "Google Sheets response exceeded the 2 MB V1 bound.")
    }
    return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct GoogleSheetsProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["google_sheets_spreadsheet_get", "google_sheets_values_get",
    "google_sheets_values_prepare", "google_sheets_values_update", "google_sheets_values_append"]
  private let client: any GoogleSheetsProviderActionClient
  public init(client: any GoogleSheetsProviderActionClient = FakeGoogleSheetsProviderActionClient()) { self.client = client }
  public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
    guard request.app.slug == "google-sheets", Self.allowed.contains(request.definition.actionKey) else {
      throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_action_not_allowlisted", message: "Google Sheets action is not allowlisted.")
    }
    let write = ["google_sheets_values_update", "google_sheets_values_append"].contains(request.definition.actionKey)
    guard write ? request.permission != .blocked : request.permission == .allowed else {
      throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_permission_denied", message: "Google Sheets action is not permitted by the compiled policy.")
    }
    return MarketplaceProviderActionAdapterResult(result: try client.executeGoogleSheetsAction(request: request).result,
      error: nil, redactionStatus: "formulas-not-evaluated-values-bounded-sharing-drive-metadata-excluded")
  }
}

public enum GoogleSheetsProviderActionSupport {
  public static let apiOrigin = "https://sheets.googleapis.com/v4"
  static func base(_ mode: String) -> JSONRecord { ["provider": .string("google-sheets"),
    "adapterBoundary": .string("google-sheets-provider-action-adapter"), "clientMode": .string(mode),
    "appVisibleSpreadsheetCorpusEnforced": .bool(true), "wholeDriveDiscovery": .bool(false),
    "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false)] }
  static func safeId(_ value: JSONValue?) throws -> String {
    guard let text = value?.string, !text.isEmpty, text.count <= 1024,
      text.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }) else {
      throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_invalid_spreadsheet_id", message: "A bounded spreadsheet ID is required.")
    }; return text
  }
  static func safeRange(_ value: JSONValue?) throws -> String {
    guard let text = value?.string?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty,
      text.count <= 500, !text.contains("\n"), !text.contains("\r") else {
      throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_invalid_range", message: "A bounded explicit A1 range is required.")
    }; return text
  }
  static func path(_ value: String) -> String { value.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_~.!'()*:$"))) ?? value }
  static func values(_ value: JSONValue?) throws -> [JSONValue] {
    guard case .array(let rows)? = value, !rows.isEmpty, rows.count <= 200 else { throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_invalid_values", message: "Values require 1-200 rows.") }
    var cells = 0; var chars = 0
    let bounded = try rows.map { row -> JSONValue in
      guard case .array(let columns) = row, columns.count <= 26 else { throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_invalid_values", message: "Each row is limited to 26 cells.") }
      cells += columns.count
      let scalar = try columns.map { cell -> JSONValue in
        switch cell { case .string(let s): chars += s.count; return .string(s); case .number, .bool, .null: return cell; default: throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_invalid_cell", message: "Cells must be string, number, boolean, or empty.") }
      }; return .array(scalar)
    }
    guard cells <= 5000, chars <= 100_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_values_too_large", message: "Values exceed the 5,000-cell or 100,000-character V1 bound.") }
    return bounded
  }
    static func inputOption(_ value: JSONValue?) throws -> String {
        let option = value?.string ?? "RAW"; guard option == "RAW" || option == "USER_ENTERED" else { throw MarketplaceProviderActionAdapterFailure(code: "google_sheets_invalid_input_option", message: "valueInputOption must be RAW or USER_ENTERED.") }; return option
    }
  static func preview(_ payload: JSONRecord) -> JSONRecord { ["spreadsheetId": payload["spreadsheetId"] ?? .null, "range": payload["range"] ?? .null, "operation": payload["operation"] ?? .null, "providerMutation": .bool(false)] }
  static func validatedPreview(_ payload: JSONRecord) throws -> JSONRecord { _ = try safeId(payload["spreadsheetId"]); _ = try safeRange(payload["range"]); _ = try values(payload["values"]); return preview(payload) }
  static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let value)? = value else { return [:] }; return value }
  static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let value)? = value else { return [] }; return value }
  static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let s): return .string(String(s.prefix(2000))); case .number, .bool, .null: return value; default: return .null } }
    static func boundedObject(_ root: JSONValue) -> JSONRecord {
        let r = object(root); return ["spreadsheetId": scalar(r["spreadsheetId"]), "updatedRange": scalar(r["updatedRange"]), "updatedRows": scalar(r["updatedRows"]), "updatedColumns": scalar(r["updatedColumns"]), "updatedCells": scalar(r["updatedCells"]), "tableRange": scalar(r["tableRange"])]
    }
    static func spreadsheet(_ root: JSONValue) -> JSONRecord {
        let r = object(root), p = object(r["properties"]);
        return [
            "spreadsheetId": scalar(r["spreadsheetId"]), "title": scalar(p["title"]), "locale": scalar(p["locale"]), "timeZone": scalar(p["timeZone"]),
            "sheets": .array(
                array(r["sheets"]).prefix(50).map { sheet in
                    let s = object(object(sheet)["properties"]), g = object(s["gridProperties"]);
                    return .object(["sheetId": scalar(s["sheetId"]), "title": scalar(s["title"]), "index": scalar(s["index"]), "sheetType": scalar(s["sheetType"]), "rowCount": scalar(g["rowCount"]), "columnCount": scalar(g["columnCount"])])
                }),
        ]
    }
  static func valueRange(_ root: JSONValue) throws -> JSONRecord { let r = object(root), values = try values(r["values"]); return ["range": scalar(r["range"]), "majorDimension": .string("ROWS"), "values": .array(values)] }
    public static func fakeSpreadsheet() -> JSONRecord {
        [
            "spreadsheetId": .string("relay-sheet-101"), "title": .string("Relay plan"), "locale": .string("en_GB"), "timeZone": .string("Europe/London"),
            "sheets": .array([.object(["sheetId": .number(0), "title": .string("Sheet1"), "index": .number(0), "sheetType": .string("GRID"), "rowCount": .number(100), "columnCount": .number(10)])]),
        ]
    }
  public static func fakeValueRange() -> JSONRecord { ["range": .string("Sheet1!A1:B2"), "majorDimension": .string("ROWS"), "values": .array([.array([.string("Name"), .string("Status")]), .array([.string("Relay"), .string("Ready")])])] }
}
