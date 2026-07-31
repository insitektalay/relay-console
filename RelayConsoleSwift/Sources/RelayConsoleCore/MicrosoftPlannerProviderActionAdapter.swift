import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct MicrosoftPlannerProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol MicrosoftPlannerProviderActionClient: Sendable { func executeMicrosoftPlannerAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftPlannerProviderActionClientResult }
public struct FakeMicrosoftPlannerProviderActionClient: MicrosoftPlannerProviderActionClient {
  public init() {}
    public func executeMicrosoftPlannerAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftPlannerProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "microsoft_planner_assigned_tasks_list", "microsoft_planner_plan_tasks_list":
            if request.definition.actionKey.hasSuffix("plan_tasks_list") { _ = try MicrosoftPlannerProviderActionSupport.identifier(request.payload["planId"], "planId") }; fields = ["tasks": .array([.object(MicrosoftPlannerProviderActionSupport.fakeTask())]), "resultCount": .number(1)];
        case "microsoft_planner_task_get": _ = try MicrosoftPlannerProviderActionSupport.identifier(request.payload["taskId"], "taskId"); fields = ["task": .object(MicrosoftPlannerProviderActionSupport.fakeTask())];
        case "microsoft_planner_plan_get": _ = try MicrosoftPlannerProviderActionSupport.identifier(request.payload["planId"], "planId"); fields = ["plan": .object(MicrosoftPlannerProviderActionSupport.fakePlan())];
        default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_planner_action_not_supported", message: "Unsupported Planner action.")
        }; return MicrosoftPlannerProviderActionClientResult(result: MicrosoftPlannerProviderActionSupport.base("fake-microsoft-graph").merging(fields) { _, new in new })
    }
}
public final class LiveMicrosoftPlannerProviderActionClient: MicrosoftPlannerProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeMicrosoftPlannerAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftPlannerProviderActionClientResult {
        let token = try authorization(request), root: JSONValue, fields: JSONRecord;
        switch request.definition.actionKey {
        case "microsoft_planner_assigned_tasks_list":
            root = try get(token: token, path: "/me/planner/tasks"); let values = MicrosoftPlannerProviderActionSupport.records(root).map(MicrosoftPlannerProviderActionSupport.task);
            fields = ["tasks": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        case "microsoft_planner_task_get": let id = try MicrosoftPlannerProviderActionSupport.identifier(request.payload["taskId"], "taskId"); root = try get(token: token, path: "/planner/tasks/\(id)"); fields = ["task": .object(MicrosoftPlannerProviderActionSupport.task(root))];
        case "microsoft_planner_plan_get": let id = try MicrosoftPlannerProviderActionSupport.identifier(request.payload["planId"], "planId"); root = try get(token: token, path: "/planner/plans/\(id)"); fields = ["plan": .object(MicrosoftPlannerProviderActionSupport.plan(root))];
        case "microsoft_planner_plan_tasks_list":
            let id = try MicrosoftPlannerProviderActionSupport.identifier(request.payload["planId"], "planId"); root = try get(token: token, path: "/planner/plans/\(id)/tasks"); let values = MicrosoftPlannerProviderActionSupport.records(root).map(MicrosoftPlannerProviderActionSupport.task);
            fields = ["tasks": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)];
        default: throw MarketplaceProviderActionAdapterFailure(code: "microsoft_planner_live_action_not_supported", message: "Unsupported live Planner action.")
        }; return MicrosoftPlannerProviderActionClientResult(result: MicrosoftPlannerProviderActionSupport.base("live-microsoft-graph").merging(fields) { _, new in new })
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let c = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), c.appSlug == "microsoft-planner", c.appId == request.app.id, c.status == .connected, c.health.state == .ready,
            c.grantedScopes == ProviderConnectionService.microsoftPlannerRelayOwnedOAuthScopes, c.health.diagnostics["delegatedOnly"]?.bool == true, c.health.diagnostics["workSchoolOnly"]?.bool == true, c.health.diagnostics["assignmentIdentitiesEnabled"]?.bool == false,
            c.health.diagnostics["detailsEnabled"]?.bool == false, c.health.diagnostics["writesEnabled"]?.bool == false, c.health.diagnostics["automaticPagination"]?.bool == false, c.health.diagnostics["rawToolsEnabled"]?.bool == false,
            let ref = c.credentialRequirements.first(where: { $0.fieldKey == "microsoft_planner_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_planner_connection_not_ready", message: "Planner requires a ready exact-scope delegated read-only connection.") }; return try secrets.getSecretValue(ref)
    }
    private func get(token: String, path: String) throws -> JSONValue {
        guard let url = URL(string: "https://graph.microsoft.com/v1.0" + path), url.scheme == "https", url.host == "graph.microsoft.com", url.path == "/v1.0/me/planner/tasks" || url.path.hasPrefix("/v1.0/planner/tasks/") || url.path.hasPrefix("/v1.0/planner/plans/"), !url.path.contains("/details")
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_planner_unsafe_url", message: "Unsafe Planner Graph request.") }; var r = URLRequest(url: url, timeoutInterval: 30); r.httpMethod = "GET"; r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization");
        let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?;
        URLSession.shared.dataTask(with: r) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "microsoft_planner_transport_error", message: "Graph returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume(); guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_planner_timeout", message: "Graph request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "microsoft_planner_rate_limited" : "microsoft_planner_graph_error", message: "Planner Graph request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_planner_response_too_large", message: "Graph response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
    }
}
public struct MicrosoftPlannerProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["microsoft_planner_assigned_tasks_list", "microsoft_planner_task_get", "microsoft_planner_plan_get", "microsoft_planner_plan_tasks_list"]; private let client: any MicrosoftPlannerProviderActionClient;
    public init(client: any MicrosoftPlannerProviderActionClient = FakeMicrosoftPlannerProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "microsoft-planner", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_planner_action_not_allowlisted", message: "Planner V1 permits only four bounded reads.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeMicrosoftPlannerAction(request: request).result, error: nil, redactionStatus: "assignment-identities-details-checklists-references-groups-writes-other-users-pagination-raw-excluded")
    }
}
public enum MicrosoftPlannerProviderActionSupport {
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("microsoft-planner"), "adapterBoundary": .string("microsoft-planner-provider-action-adapter"), "clientMode": .string(mode), "delegatedOnly": .bool(true), "workSchoolOnly": .bool(true), "maxResults": .number(25), "assignmentIdentitiesEnabled": .bool(false),
            "detailsEnabled": .bool(false), "writesEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    static func identifier(_ v: JSONValue?, _ field: String) throws -> String {
        guard let s = v?.string, !s.isEmpty, s.count <= 256, s.allSatisfy({ $0.isLetter || $0.isNumber || "-_.!~".contains($0) }) else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_planner_invalid_identifier", message: "An explicit safe \(field) is required.") }; return s
    }
    static func object(_ v: JSONValue?) -> JSONRecord { guard case .object(let r)? = v else { return [:] }; return r }; static func array(_ v: JSONValue?) -> [JSONValue] { guard case .array(let a)? = v else { return [] }; return a };
    static func scalar(_ v: JSONValue?, _ max: Int = 512) -> JSONValue { guard let v else { return .null }; if case .string(let s) = v { return .string(String(s.prefix(max))) }; if case .number = v { return v }; if case .bool = v { return v }; return .null };
    static func records(_ root: JSONValue?) -> [JSONValue] { Array(array(object(root)["value"]).prefix(25)) }
    static func task(_ v: JSONValue?) -> JSONRecord {
        let r = object(v), assignments = object(r["assignments"]);
        return [
            "id": scalar(r["id"], 256), "title": scalar(r["title"]), "planId": scalar(r["planId"], 256), "bucketId": scalar(r["bucketId"], 256), "percentComplete": scalar(r["percentComplete"]), "priority": scalar(r["priority"]), "startDateTime": scalar(r["startDateTime"], 64),
            "dueDateTime": scalar(r["dueDateTime"], 64), "createdDateTime": scalar(r["createdDateTime"], 64), "completedDateTime": scalar(r["completedDateTime"], 64), "conversationThreadId": scalar(r["conversationThreadId"], 256), "assignmentCount": .number(Double(assignments.count)),
            "assignmentIdentitiesExcluded": .bool(true), "detailsExcluded": .bool(true),
        ]
    }
    static func plan(_ v: JSONValue?) -> JSONRecord {
        let r = object(v), container = object(r["container"]);
        return [
            "id": scalar(r["id"], 256), "title": scalar(r["title"]), "ownerGroupId": scalar(r["owner"], 256), "createdDateTime": scalar(r["createdDateTime"], 64), "containerType": scalar(container["type"], 64), "containerURL": scalar(container["url"], 2048), "groupDirectoryExcluded": .bool(true),
        ]
    }
    static func fakeTask() -> JSONRecord {
        [
            "id": .string("task-001"), "title": .string("Review launch checklist"), "planId": .string("plan-001"), "bucketId": .string("bucket-001"), "percentComplete": .number(50), "priority": .number(3), "startDateTime": .string("2026-07-10T09:00:00Z"),
            "dueDateTime": .string("2026-07-15T17:00:00Z"), "createdDateTime": .string("2026-07-01T10:00:00Z"), "completedDateTime": .null, "conversationThreadId": .string("thread-001"), "assignmentCount": .number(1), "assignmentIdentitiesExcluded": .bool(true), "detailsExcluded": .bool(true),
        ]
    }
  static func fakePlan() -> JSONRecord { ["id": .string("plan-001"), "title": .string("Product Launch"), "ownerGroupId": .string("group-001"), "createdDateTime": .string("2026-06-01T10:00:00Z"), "containerType": .string("group"), "containerURL": .null, "groupDirectoryExcluded": .bool(true)] }
}
