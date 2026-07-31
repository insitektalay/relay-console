import Foundation

public struct HarvestProviderHTTPRequest: Sendable { public let url: URL; public let headers: [String: String]; public init(url: URL, headers: [String: String]) { self.url = url; self.headers = headers } }
public struct HarvestProviderHTTPResponse: Sendable {
    public let statusCode: Int; public let headers: [String: String]; public let body: Data; public init(statusCode: Int, headers: [String: String] = [:], body: Data = Data()) { self.statusCode = statusCode; self.headers = headers; self.body = body }
}
public protocol HarvestProviderHTTPClient: Sendable { func send(_ request: HarvestProviderHTTPRequest) throws -> HarvestProviderHTTPResponse }
private final class HarvestNoRedirectDelegate: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public struct URLSessionHarvestProviderHTTPClient: HarvestProviderHTTPClient {
    public init() {};
    public func send(_ request: HarvestProviderHTTPRequest) throws -> HarvestProviderHTTPResponse {
        var value = URLRequest(url: request.url); value.httpMethod = "GET"; value.timeoutInterval = 20; request.headers.forEach { value.setValue($0.value, forHTTPHeaderField: $0.key) };
        let session = URLSession(configuration: .ephemeral, delegate: HarvestNoRedirectDelegate(), delegateQueue: nil), semaphore = DispatchSemaphore(value: 0); var data: Data?, response: HTTPURLResponse?, failure: Error?;
        let task = session.dataTask(with: value) {
            data = $0; response = $1 as? HTTPURLResponse; failure = $2; semaphore.signal()
        }; task.resume(); if semaphore.wait(timeout: .now() + 20) == .timedOut { task.cancel(); throw MarketplaceProviderActionAdapterFailure(code: "harvest_http_timeout", message: "Harvest API v2 request timed out.") }; session.invalidateAndCancel(); if let failure { throw failure };
        return HarvestProviderHTTPResponse(statusCode: response?.statusCode ?? 0, headers: response?.allHeaderFields.reduce(into: [:]) { $0[String(describing: $1.key)] = String(describing: $1.value) } ?? [:], body: data ?? Data())
    }
}

public struct HarvestProviderActionClientResult: Sendable { public let result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol HarvestProviderActionClient: Sendable { func executeHarvestAction(request: MarketplaceProviderActionAdapterRequest) throws -> HarvestProviderActionClientResult }
public struct FakeHarvestProviderActionClient: HarvestProviderActionClient {
    public init() {};
    public func executeHarvestAction(request: MarketplaceProviderActionAdapterRequest) throws -> HarvestProviderActionClientResult {
        switch request.definition.actionKey {
        case "harvest_project_assignment_list": return output(["semanticReadContract": .string("harvest-project-assignment-list-v1"), "projectAssignments": .array([.object(HarvestProviderActionSupport.fakeProjectAssignment())])]);
        case "harvest_time_entry_list": return output(["semanticReadContract": .string("harvest-time-entry-list-v1"), "timeEntries": .array([.object(HarvestProviderActionSupport.fakeTimeEntry())])]);
        case "harvest_time_entry_get": return output(["semanticReadContract": .string("harvest-time-entry-get-v1"), "timeEntry": .object(HarvestProviderActionSupport.fakeTimeEntry())]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "harvest_fake_action_not_supported", message: "Unsupported Harvest action.")
        }
    };
    private func output(_ fields: JSONRecord) -> HarvestProviderActionClientResult {
        HarvestProviderActionClientResult(
            result: ["provider": .string("harvest"), "adapterBoundary": .string("harvest-provider-action-adapter"), "clientMode": .string("fake-harvest-api-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public final class LiveHarvestProviderActionClient: HarvestProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; private let http: any HarvestProviderHTTPClient; private let now: @Sendable () -> Date
    public init(data: LocalDataService, secrets: SecretService, httpClient: any HarvestProviderHTTPClient = URLSessionHarvestProviderHTTPClient(), now: @escaping @Sendable () -> Date = { Date() }) { self.data = data; self.secrets = secrets; self.http = httpClient; self.now = now }
    public func executeHarvestAction(request: MarketplaceProviderActionAdapterRequest) throws -> HarvestProviderActionClientResult {
        let auth = try authorization(request);
        switch request.definition.actionKey {
        case "harvest_project_assignment_list":
            let root = try get(auth, path: "/users/me/project_assignments", query: HarvestProviderActionSupport.assignmentQuery), values = (root.harvestObject?["project_assignments"]?.harvestArray ?? []).prefix(25).map { JSONValue.object(HarvestProviderActionSupport.projectAssignment($0)) };
            return output(["semanticReadContract": .string("harvest-project-assignment-list-v1"), "projectAssignments": .array(Array(values))]);
        case "harvest_time_entry_list":
            let root = try get(auth, path: "/time_entries", query: HarvestProviderActionSupport.timeEntryQuery(userId: auth.userId, now: now())), values = (root.harvestObject?["time_entries"]?.harvestArray ?? []).prefix(25).map { JSONValue.object(HarvestProviderActionSupport.timeEntry($0)) };
            return output(["semanticReadContract": .string("harvest-time-entry-list-v1"), "timeEntries": .array(Array(values))]);
        case "harvest_time_entry_get":
            let id = try HarvestProviderActionSupport.id(request.payload["timeEntryId"]), root = try get(auth, path: "/time_entries/\(id)", query: []); return output(["semanticReadContract": .string("harvest-time-entry-get-v1"), "timeEntry": .object(HarvestProviderActionSupport.timeEntry(root))]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "harvest_live_action_not_supported", message: "Unsupported live Harvest action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, accountId: String, userId: String) {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "harvest", let accountId = c.health.diagnostics["accountId"]?.string, c.grantedScopes == ["harvest:" + accountId],
            c.health.diagnostics["apiOrigin"] == .string("https://api.harvestapp.com/v2"), let userId = c.health.diagnostics["apiUserId"]?.string, let ref = c.credentialRequirements.first(where: { $0.fieldKey == "harvest_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "harvest_connection_not_ready", message: "Harvest account connection is not ready.") }; return (try secrets.getSecretValue(ref), accountId, userId)
    }
    private func get(_ auth: (token: String, accountId: String, userId: String), path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: "https://api.harvestapp.com/v2" + path)!; components.queryItems = query.isEmpty ? nil : query;
        let response = try http.send(HarvestProviderHTTPRequest(url: components.url!, headers: ["Authorization": "Bearer " + auth.token, "Harvest-Account-Id": auth.accountId, "Accept": "application/json", "User-Agent": "Relay Console (support@clawchat.app)"])),
            value = (try? JSONSerialization.jsonObject(with: response.body)).map(HarvestProviderActionSupport.json) ?? .null
        ;
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: response.statusCode == 301 || response.statusCode == 302
                    ? "harvest_redirect_blocked"
                    : response.statusCode == 401 ? "harvest_token_invalid_or_expired" : response.statusCode == 403 ? "harvest_access_forbidden" : response.statusCode == 404 ? "harvest_resource_not_found" : response.statusCode == 429 ? "harvest_rate_limited" : "harvest_api_error",
                message: "Harvest API v2 request failed.", providerStatusCode: response.statusCode, detail: ["retryAfter": response.headers.first { $0.key.lowercased() == "retry-after" }.map { .string(String($0.value.prefix(32))) } ?? .null])
        }; return value
    }
    private func output(_ fields: JSONRecord) -> HarvestProviderActionClientResult {
        HarvestProviderActionClientResult(
            result: ["provider": .string("harvest"), "adapterBoundary": .string("harvest-provider-action-adapter"), "clientMode": .string("live-harvest-api-v2"), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("private-state-excluded")].merging(fields) { _, n in n })
    }
}

public struct HarvestProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["harvest_project_assignment_list", "harvest_time_entry_list", "harvest_time_entry_get"]; private let client: any HarvestProviderActionClient;
    public init(client: any HarvestProviderActionClient = FakeHarvestProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "harvest", Self.allowed.contains(request.definition.actionKey) else { throw MarketplaceProviderActionAdapterFailure(code: "harvest_action_not_allowlisted", message: "Harvest action is outside bounded read-only Project Assignment and Time Entry V1.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeHarvestAction(request: request).result, error: nil, redactionStatus: "private-state-excluded")
    }
}

enum HarvestProviderActionSupport {
    static let assignmentQuery = [URLQueryItem(name: "is_active", value: "true"), URLQueryItem(name: "per_page", value: "25")]
    static func timeEntryQuery(userId: String, now: Date) -> [URLQueryItem] {
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(secondsFromGMT: 0)!; let start = calendar.date(byAdding: .day, value: -13, to: now)!, f = DateFormatter(); f.calendar = calendar; f.timeZone = calendar.timeZone; f.dateFormat = "yyyy-MM-dd";
        return [URLQueryItem(name: "user_id", value: userId), URLQueryItem(name: "from", value: f.string(from: start)), URLQueryItem(name: "to", value: f.string(from: now)), URLQueryItem(name: "per_page", value: "25")]
    }
    static func id(_ value: JSONValue?) throws -> String {
        guard let raw = value?.string, !raw.isEmpty, raw.first != "0", raw.count <= 20, raw.allSatisfy(\.isNumber) else { throw MarketplaceProviderActionAdapterFailure(code: "harvest_time_entry_id_invalid", message: "An exact positive Harvest Time Entry ID is required.") }; return raw
    }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let s): return .string(String(s.prefix(1000))); case .number, .bool, .null: return value; default: return .null } }
    static func projectAssignment(_ value: JSONValue) -> JSONRecord {
        let o = value.harvestObject ?? [:], p = o["project"]?.harvestObject ?? [:], tasks = o["task_assignments"]?.harvestArray ?? [];
        return [
            "ProjectAssignmentId": scalar(o["id"]), "Active": scalar(o["is_active"]), "ProjectId": scalar(p["id"]), "ProjectName": scalar(p["name"]), "ProjectCode": scalar(p["code"]), "ProjectActive": scalar(p["is_active"]), "TaskAssignmentCount": .number(Double(min(tasks.count, 10_000))),
            "CreatedAt": scalar(o["created_at"]), "UpdatedAt": scalar(o["updated_at"]),
        ]
    }
    static func timeEntry(_ value: JSONValue) -> JSONRecord {
        let o = value.harvestObject ?? [:], p = o["project"]?.harvestObject ?? [:], t = o["task"]?.harvestObject ?? [:];
        return [
            "TimeEntryId": scalar(o["id"]), "SpentDate": scalar(o["spent_date"]), "Hours": scalar(o["hours"]), "StartedTime": scalar(o["started_time"]), "EndedTime": scalar(o["ended_time"]), "Running": scalar(o["is_running"]), "ProjectId": scalar(p["id"]), "ProjectName": scalar(p["name"]),
            "TaskId": scalar(t["id"]), "TaskName": scalar(t["name"]), "CreatedAt": scalar(o["created_at"]), "UpdatedAt": scalar(o["updated_at"]),
        ]
    }
    static func fakeProjectAssignment() -> JSONRecord {
        [
            "ProjectAssignmentId": .string("5501"), "Active": .bool(true), "ProjectId": .string("5502"), "ProjectName": .string("Relay launch"), "ProjectCode": .string("RELAY"), "ProjectActive": .bool(true), "TaskAssignmentCount": .number(3), "CreatedAt": .string("2026-07-01T09:00:00Z"),
            "UpdatedAt": .string("2026-07-11T09:00:00Z"),
        ]
    }
    static func fakeTimeEntry() -> JSONRecord {
        [
            "TimeEntryId": .string("5503"), "SpentDate": .string("2026-07-11"), "Hours": .number(1.5), "StartedTime": .string("09:00"), "EndedTime": .string("10:30"), "Running": .bool(false), "ProjectId": .string("5502"), "ProjectName": .string("Relay launch"), "TaskId": .string("5504"),
            "TaskName": .string("Verify Railway callback"), "CreatedAt": .string("2026-07-11T09:00:00Z"), "UpdatedAt": .string("2026-07-11T10:30:00Z"),
        ]
    }
    static func json(_ value: Any) -> JSONValue {
        if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? Int { return .string(String(v)) }; if let v = value as? Double { return .number(v) }; if let v = value as? [String: Any] { return .object(v.mapValues(json)) };
        if let v = value as? [Any] { return .array(v.map(json)) }; return .null
    }
}
private extension JSONValue { var harvestObject: JSONRecord? { if case .object(let v) = self { return v }; return nil }; var harvestArray: [JSONValue]? { if case .array(let v) = self { return v }; return nil } }
