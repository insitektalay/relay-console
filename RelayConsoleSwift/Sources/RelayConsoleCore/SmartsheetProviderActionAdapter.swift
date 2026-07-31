import Foundation

public struct SmartsheetProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct SmartsheetProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol SmartsheetProviderHTTPClient: Sendable { func send(_ request: SmartsheetProviderHTTPRequest) throws -> SmartsheetProviderHTTPResponse }
private final class SmartsheetNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionSmartsheetProviderHTTPClient: SmartsheetProviderHTTPClient {
    public init() {}
    public func send(_ request: SmartsheetProviderHTTPRequest) throws -> SmartsheetProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: SmartsheetNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "smartsheet_http_timeout", message: "Smartsheet API 2.0 request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return SmartsheetProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct SmartsheetProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol SmartsheetProviderActionClient: Sendable { func executeSmartsheetAction(request: MarketplaceProviderActionAdapterRequest) throws -> SmartsheetProviderActionClientResult }
public struct FakeSmartsheetProviderActionClient: SmartsheetProviderActionClient {
    public init() {}
    public func executeSmartsheetAction(request: MarketplaceProviderActionAdapterRequest) throws -> SmartsheetProviderActionClientResult {
        switch request.definition.actionKey {
        case "smartsheet_sheet_list": return output(["semanticReadContract": .string("smartsheet-sheet-list-v1"), "sheets": .array([.object(SmartsheetProviderActionSupport.fakeSheet())])]);
        case "smartsheet_sheet_get": return output(["semanticReadContract": .string("smartsheet-sheet-get-v1"), "sheet": .object(SmartsheetProviderActionSupport.fakeSheetDetail())]);
        case "smartsheet_row_get": return output(["semanticReadContract": .string("smartsheet-row-get-v1"), "row": .object(SmartsheetProviderActionSupport.fakeRow())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "smartsheet_fake_action_not_supported", message: "Unsupported Smartsheet action.")
        }
    }
    private func output(_ fields: JSONRecord) -> SmartsheetProviderActionClientResult {
        SmartsheetProviderActionClientResult(
            result: ["provider": .string("smartsheet"), "adapterBoundary": .string("smartsheet-provider-action-adapter"), "clientMode": .string("fake-smartsheet-api-2.0"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public final class LiveSmartsheetProviderActionClient: SmartsheetProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any SmartsheetProviderHTTPClient
    public init(data: LocalDataService, secrets: SecretService, httpClient: any SmartsheetProviderHTTPClient = URLSessionSmartsheetProviderHTTPClient()) { self.data = data; self.secrets = secrets; self.http = httpClient }
    public func executeSmartsheetAction(request: MarketplaceProviderActionAdapterRequest) throws -> SmartsheetProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "smartsheet_sheet_list":
            let root = try get(auth, path: "/sheets", query: SmartsheetProviderActionSupport.listQuery), values = (root.smartsheetObject?["data"]?.smartsheetArray ?? []).prefix(25).map { JSONValue.object(SmartsheetProviderActionSupport.sheet($0)) };
            return output(["semanticReadContract": .string("smartsheet-sheet-list-v1"), "sheets": .array(Array(values))]);
        case "smartsheet_sheet_get":
            let id = try SmartsheetProviderActionSupport.id(request.payload["sheetId"], field: "sheet"), root = try get(auth, path: "/sheets/\(id)", query: SmartsheetProviderActionSupport.sheetQuery);
            return output(["semanticReadContract": .string("smartsheet-sheet-get-v1"), "sheet": .object(SmartsheetProviderActionSupport.sheetDetail(root))]);
        case "smartsheet_row_get":
            let sheet = try SmartsheetProviderActionSupport.id(request.payload["sheetId"], field: "sheet"), row = try SmartsheetProviderActionSupport.id(request.payload["rowId"], field: "row"),
                root = try get(auth, path: "/sheets/\(sheet)/rows/\(row)", query: SmartsheetProviderActionSupport.rowQuery)
            ; return output(["semanticReadContract": .string("smartsheet-row-get-v1"), "row": .object(SmartsheetProviderActionSupport.row(root, columns: root.smartsheetObject?["columns"]?.smartsheetArray ?? []))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "smartsheet_live_action_not_supported", message: "Unsupported live Smartsheet action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, origin: URL) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "smartsheet", c.grantedScopes == ["READ_SHEETS"], let originText = c.health.diagnostics["apiOrigin"]?.string,
            let origin = SmartsheetProviderActionSupport.safeOrigin(originText), let ref = c.credentialRequirements.first(where: { $0.fieldKey == "smartsheet_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "smartsheet_connection_not_ready", message: "Smartsheet account connection is not ready.") }; return (try secrets.getSecretValue(ref), origin)
    }
    private func get(_ auth: (token: String, origin: URL), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(url: auth.origin.appendingPathComponent(String(path.dropFirst())), resolvingAgainstBaseURL: false)!; components.queryItems = query;
        let response = try http.send(SmartsheetProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.token, "Accept": "application/json", "smartsheet-integration-source": "AI,ClawChat,RelayConsole", "User-Agent": "RelayConsole-Smartsheet/1.0"])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(SmartsheetProviderActionSupport.json) ?? .null
        ;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 301 || response.statusCode == 302
                    ? "smartsheet_redirect_blocked"
                    : response.statusCode == 401 ? "smartsheet_token_or_region_invalid" : response.statusCode == 403 ? "smartsheet_access_forbidden" : response.statusCode == 404 ? "smartsheet_resource_not_found" : response.statusCode == 429 ? "smartsheet_rate_limited" : "smartsheet_api_error",
                message: "Smartsheet API 2.0 request failed.", providerStatusCode: response.statusCode, detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func output(_ fields: JSONRecord) -> SmartsheetProviderActionClientResult {
        SmartsheetProviderActionClientResult(
            result: ["provider": .string("smartsheet"), "adapterBoundary": .string("smartsheet-provider-action-adapter"), "clientMode": .string("live-smartsheet-api-2.0"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public struct SmartsheetProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["smartsheet_sheet_list", "smartsheet_sheet_get", "smartsheet_row_get"]; private let client: any SmartsheetProviderActionClient; public init(client: any SmartsheetProviderActionClient = FakeSmartsheetProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "smartsheet", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "smartsheet_action_not_allowlisted", message: "Smartsheet action is outside bounded read-only Sheet and Row V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeSmartsheetAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum SmartsheetProviderActionSupport {
    static let listQuery = [URLQueryItem(name: "page", value: "1"), URLQueryItem(name: "pageSize", value: "25")],
        sheetQuery = [URLQueryItem(name: "page", value: "1"), URLQueryItem(name: "pageSize", value: "25"), URLQueryItem(name: "exclude", value: "filteredOutRows,linkInFromCellDetails,linksOutToCellsDetails,nonexistentCells")],
        rowQuery = [URLQueryItem(name: "include", value: "columns"), URLQueryItem(name: "exclude", value: "linkInFromCellDetails,linksOutToCellsDetails,nonexistentCells")]
    static let hosts: Set<String> = ["api.smartsheet.com", "api.smartsheet.eu", "api.smartsheet.au", "api.smartsheetgov.com"]
    static func safeOrigin(_ text: String) -> URL? {
        guard var c = URLComponents(string: text), c.scheme?.lowercased() == "https", let host = c.host?.lowercased(), hosts.contains(host), c.user == nil, c.password == nil, c.port == nil, c.query == nil, c.fragment == nil, c.path == "/2.0" || c.path == "/2.0/" else { return nil };
        c.path = "/2.0/"; return c.url
    }
    static func id(_ value: JSONValue?, field: String) throws -> String {
        guard let raw = value?.string, !raw.isEmpty, raw.first != "0", raw.count <= 20, raw.allSatisfy(\.isNumber) else { throw MarketplaceProviderActionAdapterFailure(code: "smartsheet_\(field)_id_invalid", message: "An exact positive numeric Smartsheet \(field) ID is required.") }; return raw
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let s): return .string(String(s.prefix(2000))); case .number, .bool, .null: return value; default: return .null } }
    static func sheet(_ value: JSONValue) -> JSONRecord { let o = value.smartsheetObject ?? [:]; return ["SheetId": scalar(o["id"]), "Name": scalar(o["name"]), "AccessLevel": scalar(o["accessLevel"]), "CreatedAt": scalar(o["createdAt"]), "ModifiedAt": scalar(o["modifiedAt"])] }
    static func sheetDetail(_ value: JSONValue) -> JSONRecord {
        let o = value.smartsheetObject ?? [:], columns = o["columns"]?.smartsheetArray ?? [], rows = o["rows"]?.smartsheetArray ?? [];
        return sheet(value).merging(["TotalRowCount": scalar(o["totalRowCount"]), "Columns": .array(columns.prefix(100).map { .object(column($0)) }), "Rows": .array(rows.prefix(25).map { .object(row($0, columns: columns)) })]) { _, n in n }
    }
    static func column(_ value: JSONValue) -> JSONRecord { let o = value.smartsheetObject ?? [:]; return ["ColumnId": scalar(o["id"]), "Title": scalar(o["title"]), "Type": scalar(o["type"]), "Primary": scalar(o["primary"])] }
    static func row(_ value: JSONValue, columns: [JSONValue]) -> JSONRecord {
        let o = value.smartsheetObject ?? [:],
            names = Dictionary(
                uniqueKeysWithValues: columns.compactMap { columnValue -> (String, JSONValue)? in
                    let c = columnValue.smartsheetObject ?? [:]; guard let id = identifier(c["id"]) else { return nil }; return (id, scalar(c["title"]))
                }),
            cells = (o["cells"]?.smartsheetArray ?? []).prefix(100).map { cellValue -> JSONValue in
                let c = cellValue.smartsheetObject ?? [:], id = identifier(c["columnId"]) ?? ""; return .object(["ColumnId": scalar(c["columnId"]), "ColumnTitle": names[id] ?? .null, "DisplayValue": scalar(c["displayValue"] ?? c["value"])])
            }
        ; return ["RowId": scalar(o["id"]), "SheetId": scalar(o["sheetId"]), "RowNumber": scalar(o["rowNumber"]), "Expanded": scalar(o["expanded"]), "CreatedAt": scalar(o["createdAt"]), "ModifiedAt": scalar(o["modifiedAt"]), "Cells": .array(cells)]
    }
    static func identifier(_ value: JSONValue?) -> String? { guard let value else { return nil }; switch value { case .string(let s): return s; case .number(let n): return String(format: "%.0f", n); default: return nil } }
    static func fakeSheet() -> JSONRecord { ["SheetId": .string("5100000000000001"), "Name": .string("Relay launch"), "AccessLevel": .string("VIEWER"), "CreatedAt": .string("2026-07-01T09:00:00Z"), "ModifiedAt": .string("2026-07-11T09:00:00Z")] }
    static func fakeRow() -> JSONRecord {
        [
            "RowId": .string("5100000000000051"), "SheetId": .string("5100000000000001"), "RowNumber": .number(1), "Expanded": .bool(true), "CreatedAt": .string("2026-07-11T09:00:00Z"), "ModifiedAt": .string("2026-07-11T09:30:00Z"),
            "Cells": .array([.object(["ColumnId": .string("5100000000000101"), "ColumnTitle": .string("Status"), "DisplayValue": .string("Ready")])]),
        ]
    }
    static func fakeSheetDetail() -> JSONRecord {
        fakeSheet().merging(["TotalRowCount": .number(1), "Columns": .array([.object(["ColumnId": .string("5100000000000101"), "Title": .string("Status"), "Type": .string("TEXT_NUMBER"), "Primary": .bool(true)])]), "Rows": .array([.object(fakeRow())])]) { _, n in n }
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .string(String(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var smartsheetObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var smartsheetArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
