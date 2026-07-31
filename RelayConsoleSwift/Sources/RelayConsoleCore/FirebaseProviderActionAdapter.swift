import Foundation

public struct FirebaseProviderActionClientResult:Sendable{public var result:JSONRecord;public init(result:JSONRecord){self.result=result}}
public protocol FirebaseProviderActionClient:Sendable{func executeFirebaseAction(request:MarketplaceProviderActionAdapterRequest)throws->FirebaseProviderActionClientResult}
public struct FakeFirebaseProviderActionClient: FirebaseProviderActionClient {
    public init() {};
    public func executeFirebaseAction(request: MarketplaceProviderActionAdapterRequest) throws -> FirebaseProviderActionClientResult {
        let fields: JSONRecord;
        switch request.definition.actionKey {
        case "firebase_project_list": fields = ["semanticReadContract": .string("firebase-project-list-v1"), "projects": .array([.object(FirebaseProviderActionSupport.fakeProject())]), "returnedCount": .number(1), "more": .bool(false)];
        case "firebase_project_get": fields = ["semanticReadContract": .string("firebase-project-get-v1"), "project": .object(FirebaseProviderActionSupport.fakeProject())];
        case "firebase_app_list": fields = ["semanticReadContract": .string("firebase-app-list-v1"), "apps": .array([.object(FirebaseProviderActionSupport.fakeApp())]), "returnedCount": .number(1), "more": .bool(false)];
        default: throw MarketplaceProviderActionAdapterFailure(code: "firebase_action_not_supported", message: "Unsupported Firebase action.")
        }; return FirebaseProviderActionClientResult(result: FirebaseProviderActionSupport.base("fake-firebase-management-api").merging(fields) { _, n in n })
    }
}

public final class LiveFirebaseProviderActionClient: FirebaseProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService; public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets };
    public func executeFirebaseAction(request: MarketplaceProviderActionAdapterRequest) throws -> FirebaseProviderActionClientResult {
        let auth = try authorization(request), limit = FirebaseProviderActionSupport.bound(request.payload["limit"]);
        switch request.definition.actionKey {
        case "firebase_project_list":
            let root = try get(auth.token, path: "/v1beta1/projects", query: [URLQueryItem(name: "pageSize", value: String(limit)), URLQueryItem(name: "showDeleted", value: "false")]), values = (root.vObject?["results"]?.vArray ?? []).prefix(limit).map(FirebaseProviderActionSupport.project);
            return result("firebase-project-list-v1", ["projects": .array(values.map(JSONValue.object)), "returnedCount": .number(Double(values.count)), "more": .bool(root.vObject?["nextPageToken"]?.string?.isEmpty == false), "automaticPagination": .bool(false)]);
        case "firebase_project_get": let root = try get(auth.token, path: "/v1beta1/projects/" + auth.projectId, query: []); return result("firebase-project-get-v1", ["project": .object(FirebaseProviderActionSupport.project(root))]);
        case "firebase_app_list":
            let root = try get(auth.token, path: "/v1beta1/projects/" + auth.projectId + ":searchApps", query: [URLQueryItem(name: "pageSize", value: String(limit))]),
                values = (root.vObject?["apps"]?.vArray ?? root.vObject?["results"]?.vArray ?? []).prefix(limit).map(FirebaseProviderActionSupport.app)
            ; return result("firebase-app-list-v1", ["apps": .array(values.map(JSONValue.object)), "returnedCount": .number(Double(values.count)), "more": .bool(root.vObject?["nextPageToken"]?.string?.isEmpty == false), "automaticPagination": .bool(false)]);
        default: throw MarketplaceProviderActionAdapterFailure(code: "firebase_live_action_not_supported", message: "Unsupported live Firebase action.")
        }
    };
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, projectId: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "firebase", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.health.diagnostics["apiOrigin"]?.string == FirebaseProviderActionSupport.apiOrigin, connection.grantedScopes == ProviderConnectionService.firebaseReadScopes, let project = connection.health.diagnostics["projectId"]?.string,
            FirebaseProviderActionSupport.safeId(project), let ref = connection.credentialRequirements.first(where: { $0.fieldKey == "firebase_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "firebase_connection_not_ready", message: "Firebase requires a ready exact-scope selected-Project OAuth connection.") }; return (try secrets.getSecretValue(ref), project)
    };
    private func result(_ contract: String, _ fields: JSONRecord) -> FirebaseProviderActionClientResult {
        FirebaseProviderActionClientResult(result: FirebaseProviderActionSupport.base("live-firebase-management-api").merging(["semanticReadContract": .string(contract)].merging(fields) { _, n in n }) { _, n in n })
    };
    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: FirebaseProviderActionSupport.apiOrigin + path); components?.queryItems = query.isEmpty ? nil : query;
        guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "firebase_invalid_url", message: "Could not build an allowlisted Firebase Management API URL.") }; var request = URLRequest(url: url); request.timeoutInterval = 20;
        request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Accept"); let semaphore = DispatchSemaphore(value: 0); var outcome: Result<(Data, Int), Error>!;
        URLSession.shared.dataTask(with: request) { d, r, e in
            outcome = e.map(Result.failure) ?? .success((d ?? Data(), (r as? HTTPURLResponse)?.statusCode ?? 0)); semaphore.signal()
        }.resume(); guard semaphore.wait(timeout: .now() + 20) == .success else { throw MarketplaceProviderActionAdapterFailure(code: "firebase_timeout", message: "Firebase Management API request timed out.") }; let (bytes, status) = try outcome.get();
        guard (200..<300).contains(status) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: status == 429 ? "firebase_rate_limited" : status == 401 ? "firebase_access_token_invalid" : status == 403 ? "firebase_scope_or_iam_denied" : status == 404 ? "firebase_project_not_found" : "firebase_api_error", message: "Firebase Management API request failed.",
                providerStatusCode: status)
        }; return bytes.isEmpty ? .object([:]) : FirebaseProviderActionSupport.json(try JSONSerialization.jsonObject(with: bytes))
    }
}
public struct FirebaseProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["firebase_project_list", "firebase_project_get", "firebase_app_list"]; private let client: any FirebaseProviderActionClient; public init(client: any FirebaseProviderActionClient = FakeFirebaseProviderActionClient()) { self.client = client };
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "firebase", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "firebase_action_not_allowlisted", message: "Firebase V1 permits only three bounded Management API reads.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeFirebaseAction(request: request).result, error: nil, redactionStatus: "api-key-config-product-data-excluded")
    }
}
public enum FirebaseProviderActionSupport {
    public static let apiOrigin = "https://firebase.googleapis.com";
    static func base(_ mode: String) -> JSONRecord { ["provider": .string("firebase"), "adapterBoundary": .string("firebase-provider-action-adapter"), "clientMode": .string(mode), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("api-key-config-product-data-excluded")] };
    public static func safeId(_ value: String) -> Bool { (6...30).contains(value.count) && value.range(of: "^[a-z][a-z0-9-]{4,28}[a-z0-9]$", options: .regularExpression) != nil };
    static func bound(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? 10)) };
    static func scalar(_ value: JSONValue?) -> JSONValue {
        guard let value else { return .null };
        switch value {
        case .string(let text): return .string(String(text.prefix(1200)));
        case .number, .bool, .null: return value;
        default: return .null
        }
    };
    static func project(_ value: JSONValue) -> JSONRecord {
        let o = value.vObject ?? [:], annotations = o["annotations"]?.vObject ?? [:];
        return [
            "name": scalar(o["name"]), "projectId": scalar(o["projectId"]), "projectNumber": scalar(o["projectNumber"]), "displayName": scalar(o["displayName"]), "state": scalar(o["state"]), "resourcesLocationId": scalar(o["resourcesLocationId"]),
            "defaultHostingSite": scalar(o["defaultHostingSite"]), "lifecycle": .object(["createTime": scalar(annotations["createTime"]), "updateTime": scalar(annotations["updateTime"])]), "adminSdkConfigReturned": .bool(false),
        ]
    };
    static func app(_ value: JSONValue) -> JSONRecord {
        let o = value.vObject ?? [:];
        return [
            "name": scalar(o["name"]), "displayName": scalar(o["displayName"]), "platform": scalar(o["platform"]), "appId": scalar(o["appId"]), "namespace": scalar(o["namespace"]), "state": scalar(o["state"]), "expireTime": scalar(o["expireTime"]), "apiKeyIdReturned": .bool(false),
            "configReturned": .bool(false),
        ]
    };
    public static func fakeProject() -> JSONRecord {
        project(.object(["name": .string("projects/relay-prod"), "projectId": .string("relay-prod"), "projectNumber": .string("123456789"), "displayName": .string("Relay Production"), "state": .string("ACTIVE"), "resourcesLocationId": .string("europe-west")]))
    }; public static func fakeApp() -> JSONRecord { app(.object(["name": .string("projects/relay-prod/webApps/1:123:web:abc"), "displayName": .string("Relay Web"), "platform": .string("WEB"), "appId": .string("1:123:web:abc"), "state": .string("ACTIVE")])) };
    static func json(_ value: Any) -> JSONValue {
        if let x = value as? String { return .string(x) }; if let x = value as? Bool { return .bool(x) }; if let x = value as? NSNumber { return .number(x.doubleValue) }; if let x = value as? [String: Any] { return .object(x.mapValues(json)) };
        if let x = value as? [Any] { return .array(x.map(json)) }; return .null
    }
}
private extension JSONValue{var vObject:JSONRecord?{if case .object(let value)=self{return value};return nil};var vArray:[JSONValue]?{if case .array(let value)=self{return value};return nil}}
