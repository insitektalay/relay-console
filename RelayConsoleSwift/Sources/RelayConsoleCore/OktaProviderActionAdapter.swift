import Foundation

public struct OktaProviderActionClientResult: Sendable { public var result: JSONRecord; public init(result: JSONRecord) { self.result = result } }
public protocol OktaProviderActionClient: Sendable { func executeOktaAction(request: MarketplaceProviderActionAdapterRequest) throws -> OktaProviderActionClientResult }

public struct FakeOktaProviderActionClient: OktaProviderActionClient {
    public init() {}
    public func executeOktaAction(request: MarketplaceProviderActionAdapterRequest) throws -> OktaProviderActionClientResult {
        let fields: JSONRecord
        switch request.definition.actionKey {
        case "okta_application_list": fields = ["semanticReadContract": .string("okta-application-list-v1"), "applications": .array([.object(OktaProviderActionSupport.fakeApplication())]), "automaticPagination": .bool(false)]
        case "okta_application_get": fields = ["semanticReadContract": .string("okta-application-get-v1"), "application": .object(OktaProviderActionSupport.fakeApplication())]
        case "okta_application_group_list": fields = ["semanticReadContract": .string("okta-application-group-list-v1"), "groups": .array([.object(OktaProviderActionSupport.fakeGroup())]), "automaticPagination": .bool(false)]
        default: throw MarketplaceProviderActionAdapterFailure(code: "okta_action_not_supported", message: "Unsupported Okta action.")
        }
        return OktaProviderActionClientResult(result: OktaProviderActionSupport.base("fake-okta-management-api").merging(fields) { _, new in new })
    }
}

public final class LiveOktaProviderActionClient: OktaProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService; private let secrets: SecretService
    public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }
    public func executeOktaAction(request: MarketplaceProviderActionAdapterRequest) throws -> OktaProviderActionClientResult {
        let auth = try authorization(request), token = try accessToken(auth), limit = OktaProviderActionSupport.bound(request.payload["limit"])
        switch request.definition.actionKey {
        case "okta_application_list":
            let values = OktaProviderActionSupport.array(try get(auth.origin, token: token, path: "/api/v1/apps", query: [URLQueryItem(name: "limit", value: String(limit))])).prefix(limit).map(OktaProviderActionSupport.application)
            return mapped("okta-application-list-v1", ["applications": .array(values.map(JSONValue.object)), "automaticPagination": .bool(false)])
        case "okta_application_get":
            return mapped("okta-application-get-v1", ["application": .object(OktaProviderActionSupport.application(try get(auth.origin, token: token, path: "/api/v1/apps/" + auth.applicationId, query: [])))])
        case "okta_application_group_list":
            let values = OktaProviderActionSupport.array(try get(auth.origin, token: token, path: "/api/v1/apps/" + auth.applicationId + "/groups", query: [URLQueryItem(name: "limit", value: String(limit))])).prefix(limit).map(OktaProviderActionSupport.group)
            return mapped("okta-application-group-list-v1", ["groups": .array(values.map(JSONValue.object)), "automaticPagination": .bool(false)])
        default: throw MarketplaceProviderActionAdapterFailure(code: "okta_live_action_not_supported", message: "Unsupported live Okta action.")
        }
    }
    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> (origin: String, clientId: String, secret: String, applicationId: String) {
        guard let id = request.auditIdentity.connectionId, let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id), connection.appSlug == "okta", connection.appId == request.app.id, connection.status == .connected,
            connection.health.state == .ready, connection.grantedScopes == ProviderConnectionService.oktaReadScopes, let origin = connection.health.diagnostics["apiOrigin"]?.string, OktaProviderActionSupport.safeOrigin(origin) != nil, let clientId = connection.health.diagnostics["clientId"]?.string,
            OktaProviderActionSupport.safeId(clientId), let application = connection.health.diagnostics["applicationId"]?.string, OktaProviderActionSupport.safeId(application),
            let secretId = connection.credentialRequirements.first(where: { $0.fieldKey == "okta_oin_client_secret" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "okta_connection_not_ready", message: "Okta requires a ready exact-scope org and selected Application connection.") }
        return (origin, clientId, try secrets.getSecretValue(secretId), application)
    }
    private func accessToken(_ auth: (origin: String, clientId: String, secret: String, applicationId: String)) throws -> String {
        guard let url = URL(string: auth.origin + "/oauth2/v1/token"), let basic = (auth.clientId + ":" + auth.secret).data(using: .utf8)?.base64EncodedString() else {
            throw MarketplaceProviderActionAdapterFailure(code: "okta_token_request_invalid", message: "Could not build the allowlisted Okta token request.")
        }
        var request = URLRequest(url: url); request.httpMethod = "POST"; request.timeoutInterval = 20; request.setValue("Basic " + basic, forHTTPHeaderField: "Authorization"); request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type");
        request.setValue("application/json", forHTTPHeaderField: "Accept"); request.httpBody = "grant_type=client_credentials&scope=okta.apps.read".data(using: .utf8)
        let root = try send(request, prefix: "okta_token"), object = OktaProviderActionSupport.object(root)
        guard let rawToken = object["access_token"]?.string else { throw MarketplaceProviderActionAdapterFailure(code: "okta_access_token_missing", message: "Okta did not return an access token.") }; let token = rawToken.trimmingCharacters(in: .whitespacesAndNewlines);
        guard !token.isEmpty else { throw MarketplaceProviderActionAdapterFailure(code: "okta_access_token_missing", message: "Okta did not return an access token.") }; return token
    }
    private func get(_ origin: String, token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: origin + path); components?.queryItems = query.isEmpty ? nil : query
        guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "okta_invalid_url", message: "Could not build an allowlisted Okta API URL.") }
        var request = URLRequest(url: url); request.timeoutInterval = 20; request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization"); request.setValue("application/json", forHTTPHeaderField: "Accept")
        return try send(request, prefix: "okta_api")
    }
    private func send(_ request: URLRequest, prefix: String) throws -> JSONValue {
        let semaphore = DispatchSemaphore(value: 0); var outcome: Result<(Data, Int), Error>!
        URLSession.shared.dataTask(with: request) { data, response, error in outcome = error.map(Result.failure) ?? .success((data ?? Data(), (response as? HTTPURLResponse)?.statusCode ?? 0)); semaphore.signal() }.resume()
        guard semaphore.wait(timeout: .now() + 20) == .success else { throw MarketplaceProviderActionAdapterFailure(code: prefix + "_timeout", message: "Okta request timed out.") }
        let (bytes, status) = try outcome.get();
        guard (200..<300).contains(status) else {
            throw MarketplaceProviderActionAdapterFailure(
                code: status == 429 ? "okta_rate_limited" : status == 401 ? "okta_credentials_invalid" : status == 403 ? "okta_scope_denied" : status == 404 ? "okta_resource_not_found" : prefix + "_failed", message: "Okta request failed.", providerStatusCode: status)
        }
        return bytes.isEmpty ? .object([:]) : OktaProviderActionSupport.json(try JSONSerialization.jsonObject(with: bytes))
    }
    private func mapped(_ contract: String, _ fields: JSONRecord) -> OktaProviderActionClientResult {
        OktaProviderActionClientResult(result: OktaProviderActionSupport.base("live-okta-management-api").merging(["semanticReadContract": .string(contract)].merging(fields) { _, new in new }) { _, new in new })
    }
}

public struct OktaProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["okta_application_list", "okta_application_get", "okta_application_group_list"]
    private let client: any OktaProviderActionClient
    public init(client: any OktaProviderActionClient = FakeOktaProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "okta", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else { throw MarketplaceProviderActionAdapterFailure(code: "okta_action_not_allowlisted", message: "Okta V1 permits only three bounded Application inventory reads.") };
        return MarketplaceProviderActionAdapterResult(result: try client.executeOktaAction(request: request).result, error: nil, redactionStatus: "credentials-users-members-settings-excluded")
    }
}

public enum OktaProviderActionSupport {
    static func base(_ mode: String) -> JSONRecord { ["provider": .string("okta"), "adapterBoundary": .string("okta-provider-action-adapter"), "clientMode": .string(mode), "rawProviderToolExposure": .bool(false), "redactionStatus": .string("credentials-users-members-settings-excluded")] }
    public static func safeOrigin(_ value: String) -> String? {
        guard let url = URL(string: value), url.scheme == "https", url.user == nil, url.password == nil, url.port == nil, url.query == nil, url.fragment == nil, url.path.isEmpty || url.path == "/", let host = url.host?.lowercased(), !host.isEmpty,
            [".okta.com", ".okta-emea.com", ".oktapreview.com"].contains(where: host.hasSuffix), !host.hasPrefix("localhost"), !host.contains(":")
        else { return nil }; return "https://" + host
    }
    public static func safeId(_ value: String) -> Bool { (3...128).contains(value.count) && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" } }
    static func bound(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? 25)) }
    static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let object)? = value else { return [:] }; return object }
    static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let array)? = value else { return [] }; return array }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(1200))); case .number, .bool, .null: return value; default: return .null } }
    static func application(_ value: JSONValue) -> JSONRecord {
        let record = object(value), accessibility = object(record["accessibility"]), visibility = object(record["visibility"]), features = array(record["features"]).compactMap(\.string).prefix(25);
        return [
            "id": scalar(record["id"]), "name": scalar(record["name"]), "label": scalar(record["label"]), "status": scalar(record["status"]), "signOnMode": scalar(record["signOnMode"]), "createdAt": scalar(record["created"]), "updatedAt": scalar(record["lastUpdated"]),
            "selfService": scalar(accessibility["selfService"]), "hideIOS": scalar(visibility["hide"]), "features": .array(features.map(JSONValue.string)), "credentialsReturned": .bool(false), "settingsReturned": .bool(false), "userAssignmentsReturned": .bool(false),
        ]
    }
    static func group(_ value: JSONValue) -> JSONRecord {
        let record = object(value), profile = object(record["profile"]);
        return [
            "id": scalar(record["id"]), "type": scalar(record["type"]), "name": scalar(profile["name"]), "description": scalar(profile["description"]), "createdAt": scalar(record["created"]), "updatedAt": scalar(record["lastUpdated"]), "membershipRulePresent": .bool(record["_embedded"] != nil),
            "membersReturned": .bool(false),
        ]
    }
    public static func fakeApplication() -> JSONRecord {
        application(
            .object([
                "id": .string("0oaRelayApp"), "name": .string("oidc_client"), "label": .string("Relay Production"), "status": .string("ACTIVE"), "signOnMode": .string("OPENID_CONNECT"), "created": .string("2026-01-01T00:00:00Z"), "lastUpdated": .string("2026-07-01T00:00:00Z"),
                "features": .array([.string("PUSH_NEW_USERS")]),
            ]))
    }
    public static func fakeGroup() -> JSONRecord {
        group(.object(["id": .string("00gRelayOps"), "type": .string("OKTA_GROUP"), "profile": .object(["name": .string("Relay Operators"), "description": .string("Production operations")]), "created": .string("2026-01-01T00:00:00Z"), "lastUpdated": .string("2026-07-01T00:00:00Z")]))
    }
    static func json(_ value: Any) -> JSONValue {
        if let value = value as? String { return .string(value) }; if let value = value as? Bool { return .bool(value) }; if let value = value as? NSNumber { return .number(value.doubleValue) }; if let value = value as? [String: Any] { return .object(value.mapValues(json)) };
        if let value = value as? [Any] { return .array(value.map(json)) }; return .null
    }
}
