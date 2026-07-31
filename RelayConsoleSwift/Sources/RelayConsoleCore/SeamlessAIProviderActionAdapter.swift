import Foundation

public protocol SeamlessAIProviderActionClient: Sendable {
    func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord
}

public enum SeamlessAIProviderActionSupport {
    static let actions: Set<String> = ["seamless_company_search"]
    static func failure(_ code: String, _ message: String) -> MarketplaceProviderActionAdapterFailure {
        MarketplaceProviderActionAdapterFailure(code: code, message: message, detail: [
            "automaticRetry": .bool(false), "automaticPagination": .bool(false),
            "providerRequestLimit": .number(1), "maxResponseBytes": .number(262_144),
            "maxResults": .number(5), "apiKey": .string("railway-encrypted-only"),
            "peopleContactData": .string("blocked"), "researchOutreachCampaigns": .string("blocked"),
            "mcpAdminBulkRaw": .string("blocked"),
        ])
    }
}

public struct FakeSeamlessAIProviderActionClient: SeamlessAIProviderActionClient {
    public init() {}
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard request.definition.actionKey == "seamless_company_search" else {
            throw SeamlessAIProviderActionSupport.failure("seamless_action_not_allowlisted", "Seamless.AI V1 permits exactly one bounded company-only search.")
        }
        return [
            "companies": .array([.object([
                "searchResultId": .string("cmp_sr_synthetic"), "name": .string("Synthetic Company"),
                "domain": .string("example.com"), "city": .string("London"), "state": .string("England"),
                "country": .string("United Kingdom"), "description": .string("Synthetic company-only result"),
                "industries": .array([.string("Computer Software")]), "staffCountRange": .string("51 - 200"),
                "companyType": .string("Private"), "stockTicker": .null,
            ])]),
            "resultCount": .number(1), "researchCreditsRemaining": .number(42), "fakeAdapter": .bool(true),
        ]
    }
}

public final class RailwaySeamlessAIProviderActionClient: SeamlessAIProviderActionClient, @unchecked Sendable {
    private let cloudSync: CloudRelaySyncService
    public init(cloudSync: CloudRelaySyncService) { self.cloudSync = cloudSync }
    public func execute(_ request: MarketplaceProviderActionAdapterRequest) throws -> JSONRecord {
        guard let connectionId = Self.nonEmpty(request.auditIdentity.connectionId), let agentId = Self.nonEmpty(request.auditIdentity.agentId) else {
            throw SeamlessAIProviderActionSupport.failure("seamless_railway_identity_missing", "Seamless.AI Railway execution requires a synchronized connection and agent install.")
        }
        guard request.definition.actionKey == "seamless_company_search" else {
            throw SeamlessAIProviderActionSupport.failure("seamless_action_not_allowlisted", "Seamless.AI V1 permits exactly one bounded company-only search.")
        }
        let remoteConnectionId = try cloudSync.remoteMarketplaceConnectionId(localWorkspaceId: request.context.workspaceId, localConnectionId: connectionId)
        let remoteAgentId = try cloudSync.remoteMarketplaceAgentId(localWorkspaceId: request.context.workspaceId, localAgentId: agentId)
        let response = try cloudSync.railwayMarketplaceRequestSync(
            localWorkspaceId: request.context.workspaceId, method: "POST", relativePath: "connectors/seamless-ai/connections/\(remoteConnectionId)/actions/relay_seamless_search_companies", body: ["agentId": remoteAgentId, "payload": Self.foundationObject(request.payload)])
        guard response["ok"] as? Bool == true else {
            let error = response["error"] as? [String: Any]
            throw SeamlessAIProviderActionSupport.failure((error?["code"] as? String) ?? "seamless_railway_action_failed", (error?["message"] as? String) ?? "Railway rejected the Seamless.AI action.")
        }
        return Self.jsonRecord(response["data"] as? [String: Any] ?? [:])
    }
    private static func nonEmpty(_ value: String?) -> String? { guard let value = value?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else { return nil }; return value }
    private static func foundationObject(_ record: JSONRecord) -> [String: Any] { record.mapValues(foundationValue) }
    private static func foundationValue(_ value: JSONValue) -> Any {
        switch value {
        case .string(let v): return v;
        case .number(let v): return v;
        case .bool(let v): return v;
        case .array(let v): return v.map(foundationValue);
        case .object(let v): return foundationObject(v);
        case .null: return NSNull()
        }
    }
    private static func jsonRecord(_ object: [String: Any]) -> JSONRecord { object.mapValues(jsonValue) }
    private static func jsonValue(_ value: Any) -> JSONValue {
        if value is NSNull { return .null }; if let v = value as? String { return .string(v) }; if let v = value as? Bool { return .bool(v) }; if let v = value as? NSNumber { return .number(v.doubleValue) }; if let v = value as? [String: Any] { return .object(jsonRecord(v)) };
        if let v = value as? [Any] { return .array(v.map(jsonValue)) }; return .null
    }
}

public struct SeamlessAIProviderActionAdapter: MarketplaceProviderActionAdapter {
    private let client: any SeamlessAIProviderActionClient
    public init(client: any SeamlessAIProviderActionClient = FakeSeamlessAIProviderActionClient()) { self.client = client }
    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        guard request.app.slug == "seamless-ai", request.definition.actionKey == "seamless_company_search", request.definition.kind == .read else {
            throw SeamlessAIProviderActionSupport.failure("seamless_action_not_allowlisted", "Seamless.AI V1 permits exactly one bounded company-only search.")
        }
        let allowed = Set(["companyName", "companyDomain", "matchType", "limit"])
        guard !request.payload.keys.contains(where: { !allowed.contains($0) }), request.payload["companyName"] != nil || request.payload["companyDomain"] != nil else {
            throw SeamlessAIProviderActionSupport.failure("seamless_invalid_input", "Provide one company name or root domain; pagination and extra fields are unavailable.")
        }
        return MarketplaceProviderActionAdapterResult(result: try client.execute(request), persistResult: false)
    }
}
