import Foundation

public struct HerokuProviderActionClientResult: Sendable {
    public var result: JSONRecord
    public init(result: JSONRecord) { self.result = result }
}

public protocol HerokuProviderActionClient: Sendable {
    func executeHerokuAction(request: MarketplaceProviderActionAdapterRequest) throws -> HerokuProviderActionClientResult
}

public struct FakeHerokuProviderActionClient: HerokuProviderActionClient {
    public init() {}
    public func executeHerokuAction(request: MarketplaceProviderActionAdapterRequest) throws -> HerokuProviderActionClientResult {
        let fields: JSONRecord
        switch request.definition.actionKey {
        case "heroku_team_app_list":
            fields = ["semanticReadContract": .string("heroku-team-app-list-v1"), "apps": .array([.object(HerokuProviderActionSupport.fakeApp())]), "returnedCount": .number(1), "more": .bool(false)]
        case "heroku_app_release_list":
            fields = ["semanticReadContract": .string("heroku-app-release-list-v1"), "releases": .array([.object(HerokuProviderActionSupport.fakeRelease())]), "returnedCount": .number(1), "more": .bool(false)]
        case "heroku_app_dyno_list":
            fields = ["semanticReadContract": .string("heroku-app-dyno-list-v1"), "dynos": .array([.object(HerokuProviderActionSupport.fakeDyno())]), "returnedCount": .number(1), "more": .bool(false)]
        default:
            throw MarketplaceProviderActionAdapterFailure(code: "heroku_action_not_supported", message: "Unsupported Heroku action.")
        }
        return HerokuProviderActionClientResult(result: HerokuProviderActionSupport.base(mode: "fake-heroku-platform-api").merging(fields) { _, new in new })
    }
}

public final class LiveHerokuProviderActionClient: HerokuProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }

    public func executeHerokuAction(request: MarketplaceProviderActionAdapterRequest) throws -> HerokuProviderActionClientResult {
        let auth = try authorization(request)
        let limit = HerokuProviderActionSupport.bound(request.payload["limit"])
        let path: String
        let key: String
        let contract: String
        let mapper: (JSONValue) -> JSONRecord
        switch request.definition.actionKey {
        case "heroku_team_app_list":
            path = "/teams/\(auth.teamId)/apps"; key = "apps"; contract = "heroku-team-app-list-v1"; mapper = HerokuProviderActionSupport.app
        case "heroku_app_release_list":
            path = "/apps/\(auth.appId)/releases"; key = "releases"; contract = "heroku-app-release-list-v1"; mapper = HerokuProviderActionSupport.release
        case "heroku_app_dyno_list":
            path = "/apps/\(auth.appId)/dynos"; key = "dynos"; contract = "heroku-app-dyno-list-v1"; mapper = HerokuProviderActionSupport.dyno
        default:
            throw MarketplaceProviderActionAdapterFailure(code: "heroku_live_action_not_supported", message: "Unsupported live Heroku action.")
        }
        let response = try get(auth.token, path: path, limit: limit)
        let values = (response.value.vArray ?? []).prefix(limit).map(mapper)
        return HerokuProviderActionClientResult(result: HerokuProviderActionSupport.base(mode: "live-heroku-platform-api").merging([
            "semanticReadContract": .string(contract), key: .array(values.map(JSONValue.object)), "returnedCount": .number(Double(values.count)),
            "more": .bool(response.more), "automaticPagination": .bool(false), "rateLimitRemaining": .number(response.remaining)
        ]) { _, new in new })
    }

    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (token: String, teamId: String, appId: String) {
        guard let id = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id),
              connection.appSlug == "heroku", connection.appId == request.app.id, connection.status == .connected, connection.health.state == .ready,
              connection.health.diagnostics["apiOrigin"]?.string == HerokuProviderActionSupport.apiOrigin,
              connection.grantedScopes == ["read"],
              let teamId = connection.health.diagnostics["teamId"]?.string, HerokuProviderActionSupport.safeId(teamId),
              let appId = connection.health.diagnostics["appId"]?.string, HerokuProviderActionSupport.safeId(appId),
              let reference = connection.credentialRequirements.first(where: { $0.fieldKey == "heroku_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "heroku_connection_not_ready", message: "Heroku requires a ready exact-team and selected-app read-scope connection.") }
        return (try secrets.getSecretValue(reference), teamId, appId)
    }

    private func get(_ token: String, path: String, limit: Int) throws -> (value: JSONValue, more: Bool, remaining: Double) {
        guard let url = URL(string: HerokuProviderActionSupport.apiOrigin + path) else { throw MarketplaceProviderActionAdapterFailure(code: "heroku_invalid_url", message: "Could not build an allowlisted Heroku Platform API URL.") }
        var request = URLRequest(url: url); request.timeoutInterval = 20
        request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        request.setValue("application/vnd.heroku+json; version=3", forHTTPHeaderField: "Accept")
        let range = path.hasSuffix("/releases") ? "version ..; order=desc,max=\(limit);" : "name ..; max=\(limit);"
        request.setValue(range, forHTTPHeaderField: "Range")
        let semaphore = DispatchSemaphore(value: 0)
        var result: Result<(Data, Int, [AnyHashable: Any]), Error>!
        URLSession.shared.dataTask(with: request) { data, response, error in
            result = error.map(Result.failure) ?? .success((data ?? Data(), (response as? HTTPURLResponse)?.statusCode ?? 0, (response as? HTTPURLResponse)?.allHeaderFields ?? [:])); semaphore.signal()
        }.resume()
        guard semaphore.wait(timeout: .now() + 20) == .success else { throw MarketplaceProviderActionAdapterFailure(code: "heroku_timeout", message: "Heroku Platform API request timed out.") }
        let (bytes, status, headers) = try result.get()
        let remaining = HerokuProviderActionSupport.headerNumber(headers, "ratelimit-remaining")
        guard (200..<300).contains(status) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: status == 429 ? "heroku_rate_limited" : status == 401 ? "heroku_access_token_invalid" : status == 403 ? "heroku_scope_or_team_denied" : status == 404 ? "heroku_not_found" : "heroku_api_error", message: "Heroku Platform API request failed.", providerStatusCode: status,
                detail: ["rateLimitRemaining": .number(remaining)])
        }
        let value = bytes.isEmpty ? JSONValue.array([]) : HerokuProviderActionSupport.json(try JSONSerialization.jsonObject(with: bytes))
        let nextRange = headers.first { String(describing: $0.key).lowercased() == "next-range" }.map { String(describing: $0.value) } ?? ""
        return (value, status == 206 || !nextRange.isEmpty, remaining)
    }
}

public struct HerokuProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["heroku_team_app_list", "heroku_app_release_list", "heroku_app_dyno_list"]
    private let client: any HerokuProviderActionClient
    public init(client: any HerokuProviderActionClient = FakeHerokuProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "heroku", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "heroku_action_not_allowlisted", message: "Heroku V1 permits only three bounded Team/App reads.") }
        return MarketplaceProviderActionAdapterResult(result: try client.executeHerokuAction(request: request).result, error: nil, redactionStatus: "config-log-drain-command-output-stream-excluded")
    }
}

public enum HerokuProviderActionSupport {
    public static let apiOrigin = "https://api.heroku.com"
    public static func base(mode: String) -> JSONRecord {
        ["provider": .string("heroku"), "adapterBoundary": .string("heroku-provider-action-adapter"), "clientMode": .string(mode), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("config-log-drain-command-output-stream-excluded")]
    }
    public static func safeId(_ value: String) -> Bool { (3...128).contains(value.count) && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" } }
    static func bound(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? 10)) }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(1200))); case .number, .bool, .null: return value; default: return .null } }
    static func app(_ value: JSONValue) -> JSONRecord {
        let o = value.vObject ?? [:], region = o["region"]?.vObject ?? [:], stack = o["stack"]?.vObject ?? o["build_stack"]?.vObject ?? [:], space = o["space"]?.vObject ?? [:];
        return [
            "id": scalar(o["id"]), "name": scalar(o["name"]), "maintenance": scalar(o["maintenance"]), "archivedAt": scalar(o["archived_at"]), "locked": scalar(o["locked"]), "region": .object(["id": scalar(region["id"]), "name": scalar(region["name"])]),
            "stack": .object(["id": scalar(stack["id"]), "name": scalar(stack["name"])]), "space": .object(["id": scalar(space["id"]), "name": scalar(space["name"])]), "releasedAt": scalar(o["released_at"]), "createdAt": scalar(o["created_at"]), "updatedAt": scalar(o["updated_at"]),
            "webUrl": scalar(o["web_url"]), "configValuesReturned": .bool(false), "credentialMetadataReturned": .bool(false),
        ]
    }
    static func release(_ value: JSONValue) -> JSONRecord {
        let o = value.vObject ?? [:];
        return [
            "id": scalar(o["id"]), "version": scalar(o["version"]), "status": scalar(o["status"]), "current": scalar(o["current"]), "eligibleForRollback": scalar(o["eligible_for_rollback"]), "description": scalar(o["description"]), "createdAt": scalar(o["created_at"]),
            "updatedAt": scalar(o["updated_at"]), "artifactDetailsReturned": .bool(false), "outputStreamReturned": .bool(false), "userEmailReturned": .bool(false),
        ]
    }
    static func dyno(_ value: JSONValue) -> JSONRecord {
        let o = value.vObject ?? [:], release = o["release"]?.vObject ?? [:];
        return [
            "id": scalar(o["id"]), "name": scalar(o["name"]), "type": scalar(o["type"]), "size": scalar(o["size"]), "state": scalar(o["state"]), "release": .object(["id": scalar(release["id"]), "version": scalar(release["version"])]), "createdAt": scalar(o["created_at"]),
            "updatedAt": scalar(o["updated_at"]), "attachUrlReturned": .bool(false), "commandReturned": .bool(false), "environmentReturned": .bool(false),
        ]
    }
    public static func fakeApp() -> JSONRecord {
        app(
            .object([
                "id": .string("01234567-89ab-cdef-0123-456789abcdef"), "name": .string("relay-web"), "maintenance": .bool(false), "region": .object(["name": .string("us")]), "stack": .object(["name": .string("heroku-24")]), "released_at": .string("2026-07-11T10:00:00Z"),
                "web_url": .string("https://relay-web.herokuapp.com/"),
            ]))
    }
    public static func fakeRelease() -> JSONRecord {
        release(.object(["id": .string("11234567-89ab-cdef-0123-456789abcdef"), "version": .number(42), "status": .string("succeeded"), "current": .bool(true), "eligible_for_rollback": .bool(true), "description": .string("Deploy abc123"), "created_at": .string("2026-07-11T10:00:00Z")]))
    }
    public static func fakeDyno() -> JSONRecord {
        dyno(.object(["id": .string("21234567-89ab-cdef-0123-456789abcdef"), "name": .string("web.1"), "type": .string("web"), "size": .string("standard-1X"), "state": .string("up"), "release": .object(["version": .number(42)]), "updated_at": .string("2026-07-11T10:05:00Z")]))
    }
    static func headerNumber(_ headers: [AnyHashable: Any], _ name: String) -> Double { headers.first { String(describing: $0.key).lowercased() == name }.flatMap { Double(String(describing: $0.value)) } ?? 0 }
    static func json(_ value: Any) -> JSONValue {
        if let x = value as? String { return .string(x) }; if let x = value as? Bool { return .bool(x) }; if let x = value as? NSNumber { return .number(x.doubleValue) }; if let x = value as? [String: Any] { return .object(x.mapValues(json)) };
        if let x = value as? [Any] { return .array(x.map(json)) }; return .null
    }
}

private extension JSONValue {
    var vObject: JSONRecord? { if case .object(let value) = self { return value }; return nil }
    var vArray: [JSONValue]? { if case .array(let value) = self { return value }; return nil }
}
