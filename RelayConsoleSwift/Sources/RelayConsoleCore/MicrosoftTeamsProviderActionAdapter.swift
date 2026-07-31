import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct MicrosoftTeamsProviderActionClientResult: Sendable {
    public var result: JSONRecord
    public init(result: JSONRecord) { self.result = result }
}

public protocol MicrosoftTeamsProviderActionClient: Sendable {
    func executeMicrosoftTeamsAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftTeamsProviderActionClientResult
}

public struct FakeMicrosoftTeamsProviderActionClient: MicrosoftTeamsProviderActionClient {
    public init() {}
    public func executeMicrosoftTeamsAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftTeamsProviderActionClientResult {
        let fields: JSONRecord
        switch request.definition.actionKey {
        case "microsoft_teams_joined_teams_list":
            fields = ["teams": .array([.object(MicrosoftTeamsProviderActionSupport.fakeTeam())]), "resultCount": .number(1)]
        case "microsoft_teams_team_get":
            _ = try MicrosoftTeamsProviderActionSupport.identifier(request.payload["teamId"], field: "teamId")
            fields = ["team": .object(MicrosoftTeamsProviderActionSupport.fakeTeam())]
        case "microsoft_teams_channels_list":
            _ = try MicrosoftTeamsProviderActionSupport.identifier(request.payload["teamId"], field: "teamId")
            fields = ["channels": .array([.object(MicrosoftTeamsProviderActionSupport.fakeChannel())]), "resultCount": .number(1)]
        case "microsoft_teams_channel_get":
            _ = try MicrosoftTeamsProviderActionSupport.identifier(request.payload["teamId"], field: "teamId")
            _ = try MicrosoftTeamsProviderActionSupport.identifier(request.payload["channelId"], field: "channelId")
            fields = ["channel": .object(MicrosoftTeamsProviderActionSupport.fakeChannel())]
        default:
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_teams_action_not_supported", message: "Unsupported Microsoft Teams action.")
        }
        return MicrosoftTeamsProviderActionClientResult(result: MicrosoftTeamsProviderActionSupport.base("fake-microsoft-graph").merging(fields) { _, new in new })
    }
}

public final class LiveMicrosoftTeamsProviderActionClient: MicrosoftTeamsProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }

    public func executeMicrosoftTeamsAction(request: MarketplaceProviderActionAdapterRequest) throws -> MicrosoftTeamsProviderActionClientResult {
        let token = try authorization(request)
        let fields: JSONRecord
        switch request.definition.actionKey {
        case "microsoft_teams_joined_teams_list":
            let root = try get(token: token, path: "/me/joinedTeams", query: [:])
            let values = MicrosoftTeamsProviderActionSupport.records(root).map(MicrosoftTeamsProviderActionSupport.team)
            fields = ["teams": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)]
        case "microsoft_teams_team_get":
            let teamId = try MicrosoftTeamsProviderActionSupport.identifier(request.payload["teamId"], field: "teamId")
            let root = try get(token: token, path: "/teams/\(teamId)", query: ["$select": "id,displayName,description,visibility,webUrl,isArchived,specialization"])
            fields = ["team": .object(MicrosoftTeamsProviderActionSupport.team(root))]
        case "microsoft_teams_channels_list":
            let teamId = try MicrosoftTeamsProviderActionSupport.identifier(request.payload["teamId"], field: "teamId")
            let root = try get(token: token, path: "/teams/\(teamId)/channels", query: ["$select": "id,displayName,description,membershipType,webUrl"])
            let values = MicrosoftTeamsProviderActionSupport.records(root).map(MicrosoftTeamsProviderActionSupport.channel)
            fields = ["channels": .array(values.map(JSONValue.object)), "resultCount": .number(Double(values.count)), "nextPageFollowed": .bool(false)]
        case "microsoft_teams_channel_get":
            let teamId = try MicrosoftTeamsProviderActionSupport.identifier(request.payload["teamId"], field: "teamId")
            let channelId = try MicrosoftTeamsProviderActionSupport.identifier(request.payload["channelId"], field: "channelId")
            let root = try get(token: token, path: "/teams/\(teamId)/channels/\(channelId)", query: ["$select": "id,displayName,description,membershipType,webUrl,summary"])
            fields = ["channel": .object(MicrosoftTeamsProviderActionSupport.channel(root))]
        default:
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_teams_live_action_not_supported", message: "Unsupported live Microsoft Teams action.")
        }
        return MicrosoftTeamsProviderActionClientResult(result: MicrosoftTeamsProviderActionSupport.base("live-microsoft-graph").merging(fields) { _, new in new })
    }

    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let connectionId = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: connectionId),
              connection.appSlug == "microsoft-teams", connection.appId == request.app.id,
              connection.status == .connected, connection.health.state == .ready,
              connection.grantedScopes == ProviderConnectionService.microsoftTeamsRelayOwnedOAuthScopes,
              connection.health.diagnostics["delegatedOnly"]?.bool == true,
              connection.health.diagnostics["workSchoolOnly"]?.bool == true,
              connection.health.diagnostics["messageContentEnabled"]?.bool == false,
              connection.health.diagnostics["adminConsentScopesEnabled"]?.bool == false,
              connection.health.diagnostics["meteredAPIsEnabled"]?.bool == false,
              connection.health.diagnostics["writesEnabled"]?.bool == false,
              connection.health.diagnostics["automaticPagination"]?.bool == false,
              connection.health.diagnostics["rawToolsEnabled"]?.bool == false,
              let reference = connection.credentialRequirements.first(where: { $0.fieldKey == "microsoft_teams_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_teams_connection_not_ready", message: "Microsoft Teams requires a ready exact-scope delegated metadata connection.") }
        return try secrets.getSecretValue(reference)
    }

    private func get(token: String, path: String, query: [String: String]) throws -> JSONValue {
        var components = URLComponents(string: MicrosoftTeamsProviderActionSupport.origin + path)
        components?.queryItems = query.sorted { $0.key < $1.key }.map { URLQueryItem(name: $0.key, value: $0.value) }
        guard let url = components?.url, url.scheme == "https", url.host == "graph.microsoft.com",
              url.path == "/v1.0/me/joinedTeams" || url.path.hasPrefix("/v1.0/teams/"),
              !url.path.contains("/messages"), !url.path.contains("/members"), !url.path.contains("/files"),
              query.keys.allSatisfy({ $0 == "$select" })
        else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_teams_unsafe_url", message: "Unsafe Microsoft Graph Teams request.") }
        var request = URLRequest(url: url, timeoutInterval: 30)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        let semaphore = DispatchSemaphore(value: 0)
        var captured: Result<(Data, HTTPURLResponse), Error>?
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            defer { semaphore.signal() }
            if let error { captured = .failure(error); return }
            guard let bytes, let response = response as? HTTPURLResponse else {
                captured = .failure(MarketplaceProviderActionAdapterFailure(code: "microsoft_teams_transport_error", message: "Microsoft Graph returned no HTTP response.")); return
            }
            captured = .success((bytes, response))
        }.resume()
        guard semaphore.wait(timeout: .now() + 31) == .success, let captured else {
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_teams_timeout", message: "Microsoft Graph request timed out.")
        }
        let (bytes, response) = try captured.get()
        guard (200..<300).contains(response.statusCode) else {
            throw MarketplaceProviderActionAdapterFailure(code: response.statusCode == 429 ? "microsoft_teams_rate_limited" : "microsoft_teams_graph_error", message: "Microsoft Graph Teams request failed.", providerStatusCode: response.statusCode)
        }
        guard bytes.count <= 1_000_000 else { throw MarketplaceProviderActionAdapterFailure(code: "microsoft_teams_response_too_large", message: "Graph response exceeded 1 MB.") }
        return try JSONDecoder().decode(JSONValue.self, from: bytes)
    }
}

public struct MicrosoftTeamsProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["microsoft_teams_joined_teams_list", "microsoft_teams_team_get", "microsoft_teams_channels_list", "microsoft_teams_channel_get"]
    private let client: any MicrosoftTeamsProviderActionClient
    public init(client: any MicrosoftTeamsProviderActionClient = FakeMicrosoftTeamsProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "microsoft-teams", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_teams_action_not_allowlisted", message: "Microsoft Teams V1 permits only four bounded metadata reads.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.executeMicrosoftTeamsAction(request: request).result, error: nil, redactionStatus: "messages-chats-members-files-meetings-writes-admin-metered-pagination-raw-excluded")
    }
}

public enum MicrosoftTeamsProviderActionSupport {
    static let origin = "https://graph.microsoft.com/v1.0"
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("microsoft-teams"), "adapterBoundary": .string("microsoft-teams-provider-action-adapter"), "clientMode": .string(mode), "delegatedOnly": .bool(true), "workSchoolOnly": .bool(true), "maxResults": .number(25), "messageContentEnabled": .bool(false),
            "adminConsentScopesEnabled": .bool(false), "meteredAPIsEnabled": .bool(false), "writesEnabled": .bool(false), "automaticPagination": .bool(false), "rawProviderToolExposure": .bool(false),
        ]
    }
    static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let record)? = value else { return [:] }; return record }
    static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let values)? = value else { return [] }; return values }
    static func scalar(_ value: JSONValue?, maximum: Int = 512) -> JSONValue {
        guard let value else { return .null }; if case .string(let string) = value { return .string(String(string.prefix(maximum))) }; if case .number = value { return value }; if case .bool = value { return value }; return .null
    }
    static func records(_ root: JSONValue?) -> [JSONValue] { Array(array(object(root)["value"]).prefix(25)) }
    static func identifier(_ value: JSONValue?, field: String) throws -> String {
        guard let string = value?.string, !string.isEmpty, string.count <= 256, string.allSatisfy({ $0.isLetter || $0.isNumber || "-_.:@".contains($0) }) else {
            throw MarketplaceProviderActionAdapterFailure(code: "microsoft_teams_invalid_identifier", message: "An explicit safe \(field) is required.")
        }; return string
    }
    static func team(_ value: JSONValue?) -> JSONRecord {
        let record = object(value);
        return [
            "id": scalar(record["id"], maximum: 256), "displayName": scalar(record["displayName"]), "description": scalar(record["description"], maximum: 2000), "visibility": scalar(record["visibility"], maximum: 32), "webUrl": scalar(record["webUrl"], maximum: 2048),
            "isArchived": scalar(record["isArchived"]), "specialization": scalar(record["specialization"], maximum: 64),
        ]
    }
    static func channel(_ value: JSONValue?) -> JSONRecord {
        let record = object(value);
        return [
            "id": scalar(record["id"], maximum: 256), "displayName": scalar(record["displayName"]), "description": scalar(record["description"], maximum: 2000), "membershipType": scalar(record["membershipType"], maximum: 32), "webUrl": scalar(record["webUrl"], maximum: 2048),
            "summary": scalar(record["summary"], maximum: 2000),
        ]
    }
    static func fakeTeam() -> JSONRecord {
        [
            "id": .string("893075dd-2487-4122-925f-022c42e20265"), "displayName": .string("Product Planning"), "description": .string("Roadmap and release coordination"), "visibility": .string("private"), "webUrl": .string("https://teams.microsoft.com/l/team/example"), "isArchived": .bool(false),
            "specialization": .string("none"),
        ]
    }
    static func fakeChannel() -> JSONRecord {
        ["id": .string("19:roadmap@thread.tacv2"), "displayName": .string("Roadmap"), "description": .string("Quarterly roadmap decisions"), "membershipType": .string("standard"), "webUrl": .string("https://teams.microsoft.com/l/channel/example"), "summary": .string("Quarterly roadmap decisions")]
    }
}
