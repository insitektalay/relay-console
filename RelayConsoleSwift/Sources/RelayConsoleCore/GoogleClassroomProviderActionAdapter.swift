import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct GoogleClassroomProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol GoogleClassroomProviderActionClient: Sendable { func executeGoogleClassroomAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleClassroomProviderActionClientResult }

public struct FakeGoogleClassroomProviderActionClient: GoogleClassroomProviderActionClient {
  public init() {}
  public func executeGoogleClassroomAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleClassroomProviderActionClientResult {
    let fields: JSONRecord
    switch request.definition.actionKey {
    case "google_classroom_courses_list_mine": _ = try GoogleClassroomProviderActionSupport.maxResults(request.payload["maxResults"]); fields = ["courses": .array([.object(GoogleClassroomProviderActionSupport.fakeCourse())]), "resultCount": .number(1)]
    case "google_classroom_course_get": _ = try GoogleClassroomProviderActionSupport.courseId(request.payload["courseId"]); fields = ["course": .object(GoogleClassroomProviderActionSupport.fakeCourse())]
        case "google_classroom_coursework_list":
            _ = try GoogleClassroomProviderActionSupport.courseId(request.payload["courseId"]); _ = try GoogleClassroomProviderActionSupport.maxResults(request.payload["maxResults"]);
            fields = ["courseWork": .array([.object(GoogleClassroomProviderActionSupport.fakeCourseWork())]), "resultCount": .number(1)]
        case "google_classroom_materials_list":
            _ = try GoogleClassroomProviderActionSupport.courseId(request.payload["courseId"]); _ = try GoogleClassroomProviderActionSupport.maxResults(request.payload["maxResults"]);
            fields = ["courseWorkMaterials": .array([.object(GoogleClassroomProviderActionSupport.fakeMaterialPost())]), "resultCount": .number(1)]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_classroom_action_not_supported", message: "Unsupported Classroom action.")
    }
    return GoogleClassroomProviderActionClientResult(result: GoogleClassroomProviderActionSupport.base("fake-classroom-api").merging(fields) { _, new in new })
  }
}

public final class LiveGoogleClassroomProviderActionClient: GoogleClassroomProviderActionClient, @unchecked Sendable {
  private let data: LocalDataService; private let secrets: SecretService
  public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
  public func executeGoogleClassroomAction(request: MarketplaceProviderActionAdapterRequest) throws -> GoogleClassroomProviderActionClientResult {
    let token = try authorization(request), fields: JSONRecord, root: JSONValue
    switch request.definition.actionKey {
        case "google_classroom_courses_list_mine":
            let maximum = try GoogleClassroomProviderActionSupport.maxResults(request.payload["maxResults"]); root = try send(token: token, path: "/courses", query: ["pageSize": String(maximum)]);
            let values = GoogleClassroomProviderActionSupport.records(root, key: "courses").map(GoogleClassroomProviderActionSupport.course);
            fields = ["courses": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageToken": GoogleClassroomProviderActionSupport.scalar(GoogleClassroomProviderActionSupport.object(root)["nextPageToken"]), "nextPageFollowed": .bool(false)]
    case "google_classroom_course_get": let course = try GoogleClassroomProviderActionSupport.courseId(request.payload["courseId"]); root = try send(token: token, path: "/courses/\(course)", query: [:]); fields = ["course": .object(GoogleClassroomProviderActionSupport.course(root))]
        case "google_classroom_coursework_list":
            let course = try GoogleClassroomProviderActionSupport.courseId(request.payload["courseId"]), maximum = try GoogleClassroomProviderActionSupport.maxResults(request.payload["maxResults"]);
            root = try send(token: token, path: "/courses/\(course)/courseWork", query: ["pageSize": String(maximum), "orderBy": "updateTime desc"]); let values = GoogleClassroomProviderActionSupport.records(root, key: "courseWork").map(GoogleClassroomProviderActionSupport.courseWork);
            fields = [
                "courseId": .string(course), "courseWork": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageToken": GoogleClassroomProviderActionSupport.scalar(GoogleClassroomProviderActionSupport.object(root)["nextPageToken"]),
                "nextPageFollowed": .bool(false),
            ]
        case "google_classroom_materials_list":
            let course = try GoogleClassroomProviderActionSupport.courseId(request.payload["courseId"]), maximum = try GoogleClassroomProviderActionSupport.maxResults(request.payload["maxResults"]);
            root = try send(token: token, path: "/courses/\(course)/courseWorkMaterials", query: ["pageSize": String(maximum), "orderBy": "updateTime desc"]);
            let values = GoogleClassroomProviderActionSupport.records(root, key: "courseWorkMaterial").map(GoogleClassroomProviderActionSupport.materialPost);
            fields = [
                "courseId": .string(course), "courseWorkMaterials": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageToken": GoogleClassroomProviderActionSupport.scalar(GoogleClassroomProviderActionSupport.object(root)["nextPageToken"]),
                "nextPageFollowed": .bool(false),
            ]
    default: throw MarketplaceProviderActionAdapterFailure(code: "google_classroom_live_action_not_supported", message: "Unsupported live Classroom action.")
    }
    return GoogleClassroomProviderActionClientResult(result: GoogleClassroomProviderActionSupport.base("live-classroom-api").merging(fields) { _, new in new })
  }
  private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "google-classroom", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.googleClassroomRelayOwnedOAuthScopes, connection.health.diagnostics["requestingUserOnly"]?.bool == true, connection.health.diagnostics["rostersEnabled"]?.bool == false,
            connection.health.diagnostics["studentSubmissionsGradesEnabled"]?.bool == false, connection.health.diagnostics["writesEnabled"]?.bool == false, connection.health.diagnostics["domainDelegationEnabled"]?.bool == false, connection.health.diagnostics["automaticPagination"]?.bool == false,
            connection.health.diagnostics["rawToolsEnabled"]?.bool == false, let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "google_classroom_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "google_classroom_connection_not_ready", message: "Classroom requires a ready exact-scope requesting-user read-only connection.") }; return try secrets.getSecretValue(ref)
  }
  private func send(token: String, path: String, query: [String: String]) throws -> JSONValue {
    var components = URLComponents(string: GoogleClassroomProviderActionSupport.origin + path); components?.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let url = components?.url, url.scheme == "https", url.host == "classroom.googleapis.com", url.path.hasPrefix("/v1/courses"), !url.path.contains("studentSubmissions"), !url.path.contains("teachers"), !url.path.contains("students"), query["pageToken"] == nil,
            query["previewVersion"] == nil
        else { throw MarketplaceProviderActionAdapterFailure(code: "google_classroom_unsafe_url", message: "Unsafe Classroom API request.") }
    var request = URLRequest(url: url, timeoutInterval: 30); request.httpMethod = "GET"; request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    let semaphore = DispatchSemaphore(value: 0); var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() }; if let error { captured = .failure(error); return };
            guard let bytes, let response = response as? HTTPURLResponse else { captured = .failure(MarketplaceProviderActionAdapterFailure(code: "google_classroom_transport_error", message: "Classroom returned no HTTP response.")); return }; captured = .success((bytes, response))
        }.resume()
        guard semaphore.wait(timeout: .now() + 31) == .success, let captured else { throw MarketplaceProviderActionAdapterFailure(code: "google_classroom_timeout", message: "Classroom request timed out.") }; let (bytes, response) = try captured.get();
        guard (200..<300).contains(response.statusCode) else { throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "google_classroom_rate_limited" : "google_classroom_api_error", message: "Classroom API request failed.", providerStatusCode: response.statusCode) };
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "google_classroom_response_too_large", message: "Classroom response exceeded 1 MB.") }; return try JSONDecoder().decode(JSONValue.self, from: bytes)
  }
}

public struct GoogleClassroomProviderActionAdapter: MarketplaceProviderActionAdapter {
  private static let allowed: Set<String> = ["google_classroom_courses_list_mine", "google_classroom_course_get", "google_classroom_coursework_list", "google_classroom_materials_list"]
  private let client: any GoogleClassroomProviderActionClient
  public init(client: any GoogleClassroomProviderActionClient = FakeGoogleClassroomProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "google-classroom", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "google_classroom_action_not_allowlisted", message: "Classroom V1 permits only four bounded reads.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeGoogleClassroomAction(request: request).result, error: nil, redactionStatus: "rosters-profiles-submissions-grades-guardians-writes-delegation-admin-preview-pagination-raw-excluded")
    }
}

public enum GoogleClassroomProviderActionSupport {
  static let origin = "https://classroom.googleapis.com/v1"
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("google-classroom"), "adapterBoundary": .string("google-classroom-provider-action-adapter"), "clientMode": .string(mode), "requestingUserOnly": .bool(true), "readOnlyV1": .bool(true), "maxResults": .number(25), "rostersEnabled": .bool(false),
            "studentSubmissionsGradesEnabled": .bool(false), "writesEnabled": .bool(false), "domainDelegationEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
  static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let record)? = value else { return [:] }; return record }
  static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let values)? = value else { return [] }; return values }
  static func scalar(_ value: JSONValue?, maximum: Int = 512) -> JSONValue { guard let value else { return .null }; if case .string(let text) = value { return .string(String(text.prefix(maximum))) }; if case .number = value { return value }; if case .bool = value { return value }; return .null }
  static func records(_ root: JSONValue?, key: String) -> [JSONValue] { Array(array(object(root)[key]).prefix(25)) }
    static func maxResults(_ value: JSONValue?) throws -> Int {
        guard let value else { return 25 }; guard let number = value.number, number.rounded() == number, (1...25).contains(Int(number)) else { throw MarketplaceProviderActionAdapterFailure(code: "google_classroom_invalid_max_results", message: "maxResults must be an integer from 1 through 25.") };
        return Int(number)
    }
    static func courseId(_ value: JSONValue?) throws -> String {
        guard let text = value?.string, !text.isEmpty, text.count <= 128, text.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "google_classroom_invalid_course_id", message: "An explicit safe Classroom courseId is required.")
        }; return text
    }
    static func course(_ value: JSONValue?) -> JSONRecord {
        let r = object(value);
        return [
            "id": scalar(r["id"], maximum: 128), "name": scalar(r["name"]), "section": scalar(r["section"]), "subject": scalar(r["subject"]), "levels": scalar(r["levels"]), "descriptionHeading": scalar(r["descriptionHeading"]), "description": scalar(r["description"], maximum: 4000),
            "room": scalar(r["room"]), "courseState": scalar(r["courseState"], maximum: 32), "alternateLink": scalar(r["alternateLink"], maximum: 2048), "creationTime": scalar(r["creationTime"], maximum: 64), "updateTime": scalar(r["updateTime"], maximum: 64), "sensitiveFieldsExcluded": .bool(true),
        ]
    }
    static func safeMaterials(_ value: JSONValue?) -> JSONValue {
        .array(
            Array(array(value).prefix(20)).map { item in
                let r = object(item); if let link = r["link"] { let o = object(link); return .object(["type": .string("link"), "title": scalar(o["title"]), "url": scalar(o["url"], maximum: 2048)]) };
                if let video = r["youtubeVideo"] { let o = object(video); return .object(["type": .string("youtubeVideo"), "title": scalar(o["title"]), "alternateLink": scalar(o["alternateLink"], maximum: 2048)]) };
                if let form = r["form"] { let o = object(form); return .object(["type": .string("form"), "title": scalar(o["title"]), "formUrl": scalar(o["formUrl"], maximum: 2048)]) };
                if let drive = r["driveFile"] { let o = object(object(drive)["driveFile"]); return .object(["type": .string("driveFile"), "title": scalar(o["title"]), "alternateLink": scalar(o["alternateLink"], maximum: 2048)]) }; return .object(["type": .string("unsupported-redacted")])
            })
    }
    static func courseWork(_ value: JSONValue) -> JSONRecord {
        let r = object(value);
        return [
            "courseId": scalar(r["courseId"], maximum: 128), "id": scalar(r["id"], maximum: 128), "title": scalar(r["title"]), "description": scalar(r["description"], maximum: 4000), "workType": scalar(r["workType"], maximum: 64), "state": scalar(r["state"], maximum: 32),
            "creationTime": scalar(r["creationTime"], maximum: 64), "updateTime": scalar(r["updateTime"], maximum: 64), "scheduledTime": scalar(r["scheduledTime"], maximum: 64), "dueDate": r["dueDate"] ?? .null, "dueTime": r["dueTime"] ?? .null, "maxPoints": scalar(r["maxPoints"]),
            "alternateLink": scalar(r["alternateLink"], maximum: 2048), "topicId": scalar(r["topicId"], maximum: 128), "assigneeMode": scalar(r["assigneeMode"], maximum: 32), "materials": safeMaterials(r["materials"]), "individualStudentIdsExcluded": .bool(true),
        ]
    }
    static func materialPost(_ value: JSONValue) -> JSONRecord {
        let r = object(value);
        return [
            "courseId": scalar(r["courseId"], maximum: 128), "id": scalar(r["id"], maximum: 128), "title": scalar(r["title"]), "description": scalar(r["description"], maximum: 4000), "state": scalar(r["state"], maximum: 32), "creationTime": scalar(r["creationTime"], maximum: 64),
            "updateTime": scalar(r["updateTime"], maximum: 64), "scheduledTime": scalar(r["scheduledTime"], maximum: 64), "alternateLink": scalar(r["alternateLink"], maximum: 2048), "topicId": scalar(r["topicId"], maximum: 128), "assigneeMode": scalar(r["assigneeMode"], maximum: 32),
            "materials": safeMaterials(r["materials"]), "individualStudentIdsExcluded": .bool(true),
        ]
    }
    static func fakeCourse() -> JSONRecord {
        [
            "id": .string("123456789"), "name": .string("Year 10 Biology"), "section": .string("Section A"), "subject": .string("Biology"), "levels": .string("Year 10"), "descriptionHeading": .string("Living systems"), "description": .string("Cell structure, genetics, and ecosystems."),
            "room": .string("Lab 3"), "courseState": .string("ACTIVE"), "alternateLink": .string("https://classroom.google.com/c/123456789"), "creationTime": .string("2026-01-08T09:00:00Z"), "updateTime": .string("2026-07-10T12:00:00Z"), "sensitiveFieldsExcluded": .bool(true),
        ]
    }
    static func fakeCourseWork() -> JSONRecord {
        [
            "courseId": .string("123456789"), "id": .string("987654321"), "title": .string("Cell structure worksheet"), "description": .string("Label the organelles and explain their functions."), "workType": .string("ASSIGNMENT"), "state": .string("PUBLISHED"),
            "creationTime": .string("2026-07-01T09:00:00Z"), "updateTime": .string("2026-07-10T12:00:00Z"), "scheduledTime": .null, "dueDate": .object(["year": .number(2026), "month": .number(7), "day": .number(15)]), "dueTime": .object(["hours": .number(16)]), "maxPoints": .number(20),
            "alternateLink": .string("https://classroom.google.com/c/123456789/a/987654321/details"), "topicId": .string("cells"), "assigneeMode": .string("ALL_STUDENTS"),
            "materials": .array([.object(["type": .string("link"), "title": .string("Cell reference"), "url": .string("https://example.edu/cells")])]), "individualStudentIdsExcluded": .bool(true),
        ]
    }
    static func fakeMaterialPost() -> JSONRecord {
        [
            "courseId": .string("123456789"), "id": .string("555555555"), "title": .string("Cell microscopy guide"), "description": .string("Reference guide for the laboratory session."), "state": .string("PUBLISHED"), "creationTime": .string("2026-07-02T09:00:00Z"),
            "updateTime": .string("2026-07-09T12:00:00Z"), "scheduledTime": .null, "alternateLink": .string("https://classroom.google.com/c/123456789/m/555555555/details"), "topicId": .string("cells"), "assigneeMode": .string("ALL_STUDENTS"),
            "materials": .array([.object(["type": .string("link"), "title": .string("Microscopy guide"), "url": .string("https://example.edu/microscopy")])]), "individualStudentIdsExcluded": .bool(true),
        ]
    }
}
