import Foundation

public struct LeverProviderActionClientResult: Sendable {
    public var result: JSONRecord
    public init(result: JSONRecord) { self.result = result }
}

public protocol LeverProviderActionClient: Sendable {
    func executeLeverAction(request: MarketplaceProviderActionAdapterRequest) throws -> LeverProviderActionClientResult
}

public struct FakeLeverProviderActionClient: LeverProviderActionClient {
    public init() {}
    public func executeLeverAction(request: MarketplaceProviderActionAdapterRequest) throws -> LeverProviderActionClientResult {
        let fields: JSONRecord
        switch request.definition.actionKey {
        case "lever_posting_list":
            fields = ["semanticReadContract": .string("lever-posting-list-v1"), "postings": .array([.object(LeverProviderActionSupport.fakePosting())])]
        case "lever_stage_list":
            fields = ["semanticReadContract": .string("lever-stage-list-v1"), "stages": .array([.object(LeverProviderActionSupport.fakeStage())])]
        default:
            throw MarketplaceProviderActionAdapterFailure(code: "lever_action_not_supported", message: "Unsupported Lever action.")
        }
        return LeverProviderActionClientResult(result: LeverProviderActionSupport.base("fake-data-api-v1").merging(fields) { _, new in new })
    }
}

public final class LiveLeverProviderActionClient: LeverProviderActionClient, @unchecked Sendable {
    private let data: LocalDataService
    private let secrets: SecretService
    public init(data: LocalDataService, secrets: SecretService) { self.data = data; self.secrets = secrets }

    public func executeLeverAction(request: MarketplaceProviderActionAdapterRequest) throws -> LeverProviderActionClientResult {
        let token = try authorization(request)
        let limit = LeverProviderActionSupport.bound(request.payload["limit"])
        switch request.definition.actionKey {
        case "lever_posting_list":
            let root = try get(token, path: "/postings", query: LeverProviderActionSupport.postingQuery(limit: limit))
            let values = LeverProviderActionSupport.array(LeverProviderActionSupport.object(root)["data"]).prefix(limit)
            return mapped("lever-posting-list-v1", ["postings": .array(values.map { .object(LeverProviderActionSupport.posting($0)) })])
        case "lever_stage_list":
            let root = try get(token, path: "/stages", query: [URLQueryItem(name: "limit", value: String(limit))])
            let values = LeverProviderActionSupport.array(LeverProviderActionSupport.object(root)["data"]).prefix(limit)
            return mapped("lever-stage-list-v1", ["stages": .array(values.map { .object(LeverProviderActionSupport.stage($0)) })])
        default:
            throw MarketplaceProviderActionAdapterFailure(code: "lever_live_action_not_supported", message: "Unsupported live Lever action.")
        }
    }

    private func authorization(_ request: MarketplaceProviderActionAdapterRequest) throws -> String {
        guard let id = request.auditIdentity.connectionId,
              let connection = try data.getProviderConnection(workspaceId: request.context.workspaceId, connectionId: id),
              connection.appSlug == "lever", connection.appId == request.app.id,
              connection.status == .connected, connection.health.state == .ready,
              connection.grantedScopes == ProviderConnectionService.leverReadScopes,
              connection.health.diagnostics["apiOrigin"]?.string == LeverProviderActionSupport.apiOrigin,
              let secret = connection.credentialRequirements.first(where: { $0.fieldKey == "lever_oauth_access_token" })?.secretReferenceId
        else { throw MarketplaceProviderActionAdapterFailure(code: "lever_connection_not_ready", message: "Lever requires a ready exact-scope account connection.") }
        return try secrets.getSecretValue(secret)
    }

    private func get(_ token: String, path: String, query: [URLQueryItem]) throws -> JSONValue {
        var components = URLComponents(string: LeverProviderActionSupport.apiOrigin + path)
        components?.queryItems = query
        guard let url = components?.url else { throw MarketplaceProviderActionAdapterFailure(code: "lever_invalid_url", message: "Could not build allowlisted Lever URL.") }
        var request = URLRequest(url: url)
        request.timeoutInterval = 20
        request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let semaphore = DispatchSemaphore(value: 0)
        var outcome: Result<(Data, Int), Error>!
        URLSession.shared.dataTask(with: request) { bytes, response, error in
            outcome = error.map(Result.failure) ?? .success((bytes ?? Data(), (response as? HTTPURLResponse)?.statusCode ?? 0))
            semaphore.signal()
        }.resume()
        guard semaphore.wait(timeout: .now() + 20) == .success else { throw MarketplaceProviderActionAdapterFailure(code: "lever_timeout", message: "Lever request timed out.") }
        let (bytes, status) = try outcome.get()
        guard (200..<300).contains(status) else {
            let code = status == 429 ? "lever_rate_limited" : status == 401 ? "lever_access_token_invalid" : status == 403 ? "lever_scope_or_admin_denied" : status == 404 ? "lever_resource_not_found" : "lever_api_error"
            throw MarketplaceProviderActionAdapterFailure(code: code, message: "Lever Data API request failed.", providerStatusCode: status)
        }
        return bytes.isEmpty ? .object([:]) : LeverProviderActionSupport.json(try JSONSerialization.jsonObject(with: bytes))
    }

    private func mapped(_ contract: String, _ fields: JSONRecord) -> LeverProviderActionClientResult {
        LeverProviderActionClientResult(result: LeverProviderActionSupport.base("live-data-api-v1").merging(["semanticReadContract": .string(contract)].merging(fields) { _, new in new }) { _, new in new })
    }
}

public struct LeverProviderActionAdapter: MarketplaceProviderActionAdapter {
    private static let allowed: Set<String> = ["lever_posting_list", "lever_stage_list"]
    private let client: any LeverProviderActionClient
    public init(client: any LeverProviderActionClient = FakeLeverProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "lever", Self.allowed.contains(request.definition.actionKey), request.permission == .allowed else {
            throw MarketplaceProviderActionAdapterFailure(code: "lever_action_not_allowlisted", message: "Lever V1 permits only bounded Posting and Stage reads.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.executeLeverAction(request: request).result, error: nil, redactionStatus: "candidate-opportunity-contact-content-confidential-data-excluded")
    }
}

public enum LeverProviderActionSupport {
    public static let apiOrigin = "https://api.lever.co/v1"
    public static func safeId(_ value: String) -> Bool { (1...160).contains(value.count) && value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "_" || $0 == "-" || $0 == "." } }
    static func base(_ mode: String) -> JSONRecord {
        [
            "provider": .string("lever"), "adapterBoundary": .string("lever-provider-action-adapter"), "clientMode": .string(mode), "rawProviderToolExposure": .bool(false), "automaticPagination": .bool(false), "confidentialDataReturned": .bool(false), "candidateDataReturned": .bool(false),
            "redactionStatus": .string("candidate-opportunity-contact-content-confidential-data-excluded"),
        ]
    }
    static func bound(_ value: JSONValue?) -> Int { max(1, min(25, value?.number.map(Int.init) ?? value?.string.flatMap(Int.init) ?? 25)) }
    static func object(_ value: JSONValue?) -> JSONRecord { guard case .object(let value)? = value else { return [:] }; return value }
    static func array(_ value: JSONValue?) -> [JSONValue] { guard case .array(let value)? = value else { return [] }; return value }
    static func scalar(_ value: JSONValue?) -> JSONValue { guard let value else { return .null }; switch value { case .string(let text): return .string(String(text.prefix(600))); case .number, .bool, .null: return value; default: return .null } }
    static func stringArray(_ value: JSONValue?) -> JSONValue { .array(array(value).prefix(20).map(scalar)) }
    static func postingQuery(limit: Int) -> [URLQueryItem] {
        [URLQueryItem(name: "limit", value: String(limit)), URLQueryItem(name: "confidentiality", value: "non-confidential")]
            + ["id", "text", "createdAt", "updatedAt", "state", "distributionChannels", "confidentiality", "categories", "workplaceType"].map { URLQueryItem(name: "include", value: $0) }
    }
    static func posting(_ value: JSONValue) -> JSONRecord {
        let record = object(value), categories = object(record["categories"]);
        return [
            "id": scalar(record["id"]), "text": scalar(record["text"]), "state": scalar(record["state"]), "confidentiality": scalar(record["confidentiality"]), "team": scalar(categories["team"]), "department": scalar(categories["department"]), "location": scalar(categories["location"]),
            "commitment": scalar(categories["commitment"]), "workplaceType": scalar(record["workplaceType"]), "distributionChannels": stringArray(record["distributionChannels"]), "createdAt": scalar(record["createdAt"]), "updatedAt": scalar(record["updatedAt"]), "contentReturned": .bool(false),
            "salaryReturned": .bool(false), "peopleReturned": .bool(false), "candidateDataReturned": .bool(false),
        ]
    }
    static func stage(_ value: JSONValue) -> JSONRecord { let record = object(value); return ["id": scalar(record["id"]), "text": scalar(record["text"]), "opportunityMembershipReturned": .bool(false), "candidateDataReturned": .bool(false)] }
    public static func fakePosting() -> JSONRecord {
        posting(
            .object([
                "id": .string("posting-101"), "text": .string("Platform Engineer"), "state": .string("published"), "confidentiality": .string("non-confidential"),
                "categories": .object(["team": .string("Platform"), "department": .string("Engineering"), "location": .string("London"), "commitment": .string("Full-time")]), "workplaceType": .string("hybrid"), "distributionChannels": .array([.string("public")]),
                "createdAt": .number(1_767_225_600_000), "updatedAt": .number(1_767_225_600_000),
            ]))
    }
    public static func fakeStage() -> JSONRecord { stage(.object(["id": .string("stage-new-applicant"), "text": .string("New applicant")])) }
    static func json(_ value: Any) -> JSONValue {
        if let value = value as? String { return .string(value) }; if let value = value as? Bool { return .bool(value) }; if let value = value as? NSNumber { return .number(value.doubleValue) }; if let value = value as? [String: Any] { return .object(value.mapValues(json)) };
        if let value = value as? [Any] { return .array(value.map(json)) }; return .null
    }
}
