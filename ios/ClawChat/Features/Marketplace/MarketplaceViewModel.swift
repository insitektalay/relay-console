import Foundation
import UIKit

enum MarketplaceDangerousPolicy {
    static let id = "dangerously_skip_permissions"
    static let warning = "This advanced policy removes Relay Console per-action approval for every selected provider-supported action. Workspace and connection ownership, provider-granted authority, selected capabilities, blocked actions, fixed origins, request bounds, rate limits, audit evidence, and secret non-exposure still apply."

    static func ordinaryProfiles(_ profiles: [MarketplaceApprovalProfile]) -> [MarketplaceApprovalProfile] {
        profiles.filter { $0.id != id }
    }
}

@MainActor
final class MarketplaceViewModel: ObservableObject {
    @Published var catalog: MarketplaceCatalog?
    @Published var connections: [MarketplaceConnection] = []
    @Published var installs: [MarketplaceInstall] = []
    @Published var toolRequests: [MarketplaceToolRequest] = []
    @Published var isLoading = false
    @Published var isLoadingMore = false
    @Published var catalogTotalCount = 0
    @Published var catalogNextCursor: String?
    @Published var appDetails: [String: MarketplaceApp] = [:]
    @Published var actionInProgress = false
    @Published var error: String?
    @Published var notice: String?

    let workspaceId: String
    private let api: APIClient
    private var catalogRequestGeneration = 0

    init(workspaceId: String, api: APIClient = .shared) {
        self.workspaceId = workspaceId
        self.api = api
    }

    var hasMoreCatalogApps: Bool { catalogNextCursor != nil }

    func load(query: String = "", category: String? = nil) async {
        guard !isLoading else { return }
        catalogRequestGeneration += 1
        let generation = catalogRequestGeneration
        isLoading = true
        error = nil
        do {
            async let catalogRequest: MarketplaceCatalogPage = api.request(
                .marketplaceCatalogPage(
                    workspaceId: workspaceId,
                    query: query,
                    category: category,
                    cursor: nil,
                    limit: 50
                )
            )
            async let connectionRequest: [MarketplaceConnection] = api.request(.marketplaceConnections(workspaceId: workspaceId, appSlug: nil))
            async let installRequest: [MarketplaceInstall] = api.request(.marketplaceInstalls(workspaceId: workspaceId))
            async let toolRequest: [MarketplaceToolRequest] = api.request(.marketplaceToolRequests(workspaceId: workspaceId, status: "requested"))
            let (page, newConnections, newInstalls, newToolRequests) = try await (catalogRequest, connectionRequest, installRequest, toolRequest)
            guard generation == catalogRequestGeneration else { return }
            catalog = MarketplaceCatalog(
                releaseManifest: page.releaseManifest,
                categories: page.categories,
                apps: page.apps
            )
            catalogTotalCount = page.pageInfo.totalCount
            catalogNextCursor = page.pageInfo.nextCursor
            connections = newConnections
            installs = newInstalls
            toolRequests = newToolRequests
        } catch {
            self.error = message(for: error)
        }
        if generation == catalogRequestGeneration { isLoading = false }
    }

    func reloadCatalog(query: String, category: String?) async {
        catalogRequestGeneration += 1
        let generation = catalogRequestGeneration
        isLoading = true
        defer {
            if generation == catalogRequestGeneration { isLoading = false }
        }
        do {
            let page: MarketplaceCatalogPage = try await api.request(
                .marketplaceCatalogPage(
                    workspaceId: workspaceId,
                    query: query,
                    category: category,
                    cursor: nil,
                    limit: 50
                )
            )
            guard generation == catalogRequestGeneration else { return }
            catalog = MarketplaceCatalog(
                releaseManifest: page.releaseManifest,
                categories: page.categories,
                apps: page.apps
            )
            catalogTotalCount = page.pageInfo.totalCount
            catalogNextCursor = page.pageInfo.nextCursor
            error = nil
        } catch {
            self.error = message(for: error)
        }
    }

    func loadMoreCatalog(query: String, category: String?) async {
        guard !isLoadingMore, let cursor = catalogNextCursor else { return }
        let generation = catalogRequestGeneration
        isLoadingMore = true
        defer { isLoadingMore = false }
        do {
            let page: MarketplaceCatalogPage = try await api.request(
                .marketplaceCatalogPage(
                    workspaceId: workspaceId,
                    query: query,
                    category: category,
                    cursor: cursor,
                    limit: 50
                )
            )
            guard generation == catalogRequestGeneration else { return }
            var bySlug = Dictionary(
                uniqueKeysWithValues: (catalog?.apps ?? []).map { ($0.slug, $0) }
            )
            for app in page.apps { bySlug[app.slug] = app }
            catalog = MarketplaceCatalog(
                releaseManifest: page.releaseManifest,
                categories: page.categories,
                apps: bySlug.values.sorted {
                    $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending
                }
            )
            catalogTotalCount = page.pageInfo.totalCount
            catalogNextCursor = page.pageInfo.nextCursor
            error = nil
        } catch {
            self.error = message(for: error)
        }
    }

    func loadAppDetail(slug: String) async -> MarketplaceApp? {
        if let cached = appDetails[slug] { return cached }
        do {
            let detail: MarketplaceApp = try await api.request(
                .marketplaceApp(workspaceId: workspaceId, slug: slug)
            )
            appDetails[slug] = detail
            return detail
        } catch {
            self.error = message(for: error)
            return nil
        }
    }

    func connect(app: MarketplaceApp, displayName: String, authType: String, credentials: [String: String], capabilities: [String]) async -> MarketplaceConnection? {
        guard app.connectEligible else {
            error = app.unavailableReason ?? "This provider has not passed release acceptance."
            return nil
        }
        return await performAction {
            var params: [String: Any] = [
                "appSlug": app.slug,
                "displayName": displayName,
                "authType": authType,
                "environment": "production",
                "selectedCapabilities": capabilities,
            ]
            if !credentials.isEmpty { params["credentials"] = credentials }
            let connection: MarketplaceConnection = try await api.request(.createMarketplaceConnection(workspaceId: workspaceId, params: params))
            connections.removeAll { $0.id == connection.id }
            connections.insert(connection, at: 0)
            notice = "\(app.name) connection saved."
            return connection
        }
    }

    func update(
        app: MarketplaceApp,
        connection: MarketplaceConnection,
        displayName: String,
        credentials: [String: String]?,
        capabilities: [String]
    ) async -> MarketplaceConnection? {
        guard app.connectEligible else {
            error = app.unavailableReason ?? "This provider has not passed release acceptance."
            return nil
        }
        return await performAction {
            var params: [String: Any] = [
                "displayName": displayName,
                "selectedCapabilities": capabilities,
            ]
            if let credentials {
                params["credentials"] = credentials
            }
            let updated: MarketplaceConnection = try await api.request(
                .updateMarketplaceConnection(
                    workspaceId: workspaceId,
                    id: connection.id,
                    params: params
                )
            )
            connections.removeAll { $0.id == updated.id }
            connections.insert(updated, at: 0)
            notice = "\(app.name) connection updated."
            return updated
        }
    }

    func startOAuth(app: MarketplaceApp, capabilities: [String], credentials: [String: String] = [:]) async -> URL? {
        guard app.connectEligible else {
            error = app.unavailableReason ?? "This provider has not passed release acceptance."
            return nil
        }
        guard !actionInProgress else { return nil }
        actionInProgress = true
        error = nil
        defer { actionInProgress = false }
        do {
            guard let returnURL = MarketplaceOAuthCallback.returnURL(
                workspaceId: workspaceId,
                appSlug: app.slug
            ) else {
                throw APIError.invalidURL
            }
            var params: [String: Any] = [
                "selectedCapabilities": capabilities,
                "returnTo": returnURL.absoluteString,
            ]
            if app.connectionTypes.contains("oauth1_xauth") {
                params["username"] = credentials["INSTAPAPER_USERNAME"] ?? ""
                params["password"] = credentials["INSTAPAPER_PASSWORD"] ?? ""
                if let key = credentials["INSTAPARSER_API_KEY"], !key.isEmpty { params["instaparserApiKey"] = key }
            }
            let prefix = app.slug.uppercased()
            if let clientId = credentials["\(prefix)_CLIENT_ID"], !clientId.isEmpty { params["clientId"] = clientId }
            if let clientSecret = credentials["\(prefix)_CLIENT_SECRET"], !clientSecret.isEmpty { params["clientSecret"] = clientSecret }
            if app.slug == "bynder", let portal = credentials["BYNDER_PORTAL_DOMAIN"], !portal.isEmpty { params["providerDomain"] = portal }
            if app.slug == "canto", let account = credentials["CANTO_ACCOUNT_DOMAIN"], !account.isEmpty { params["providerDomain"] = account }
            if app.slug == "frontify", let account = credentials["FRONTIFY_DOMAIN"], !account.isEmpty { params["providerDomain"] = account }
            if app.slug == "asset-bank", let site = credentials["ASSET_BANK_BASE_URL"], !site.isEmpty { params["providerDomain"] = site }
            if app.slug == "shopify", let shop = credentials["SHOPIFY_SHOP_DOMAIN"], !shop.isEmpty { params["providerDomain"] = shop }
            let result: MarketplaceOAuthStart = try await api.request(
                .startMarketplaceOAuth(
                    workspaceId: workspaceId,
                    slug: app.slug,
                    params: params
                )
            )
            if let connection = result.connection {
                connections.removeAll { $0.id == connection.id }
                connections.insert(connection, at: 0)
                notice = "\(app.name) connected through the Relay credential vault."
                return nil
            }
            guard let raw = result.authorizationUrl, let url = URL(string: raw) else {
                throw APIError.invalidURL
            }
            notice = "Complete authorization in the secure provider window."
            return url
        } catch {
            self.error = message(for: error)
            return nil
        }
    }

    func completeOAuthReturn(_ url: URL, app: MarketplaceApp) async -> String? {
        do {
            let callback = try MarketplaceOAuthCallback.parse(
                url,
                expectedWorkspaceId: workspaceId,
                expectedAppSlug: app.slug
            )
            guard callback.status == .connected, let connectionId = callback.connectionId else {
                throw MarketplaceOAuthCallbackError.authorizationFailed
            }

            await load()
            guard connections.contains(where: { $0.id == connectionId && $0.appSlug == app.slug }) else {
                if error == nil {
                    error = "Authorization completed, but the new connection could not be verified in this workspace. Refresh before trying again."
                }
                return nil
            }
            notice = "\(app.name) account authorized."
            return connectionId
        } catch {
            self.error = message(for: error)
            return nil
        }
    }

    func disconnectOAuth(app: MarketplaceApp, connection: MarketplaceConnection) async -> MarketplaceConnection? {
        guard connection.appSlug == app.slug, !connection.requiresDeviceRuntime else {
            error = "This is not a Relay-hosted \(app.name) connection."
            return nil
        }
        return await performAction {
            let disconnected: MarketplaceConnection = try await api.request(
                .disconnectMarketplaceOAuth(
                    workspaceId: workspaceId,
                    slug: app.slug,
                    connectionId: connection.id
                )
            )
            connections.removeAll { $0.id == disconnected.id }
            connections.insert(disconnected, at: 0)
            notice = "\(app.name) disconnected. Relay no longer holds credentials for this connection."
            return disconnected
        }
    }

    func handleOAuthSessionError(_ error: any Error) {
        if MarketplaceOAuthWebSession.isUserCancellation(error) {
            notice = "Authorization cancelled."
        } else {
            self.error = message(for: error)
        }
    }

    func health(app: MarketplaceApp, connection: MarketplaceConnection) async -> MarketplaceConnectorHealth? {
        guard !connection.requiresDeviceRuntime else {
            notice = "This connection runs on your Mac. Keep the Mac and bridge online to use it remotely."
            return nil
        }
        return await performAction {
            let result: MarketplaceConnectorHealth = try await api.request(
                .marketplaceConnectorHealth(workspaceId: workspaceId, slug: app.slug, connectionId: connection.id)
            )
            notice = result.message ?? "Connection health: \(result.status.replacingOccurrences(of: "_", with: " "))."
            return result
        }
    }

    func install(app: MarketplaceApp, agent: Agent, connection: MarketplaceConnection?, capabilities: [String], approvalProfileId: String, runtimeFormat: String, role: String, acknowledgeDangerouslySkipPermissions: Bool = false) async -> Bool {
        guard app.connectEligible else {
            error = app.unavailableReason ?? "This provider has not passed release acceptance."
            return false
        }
        guard connection?.requiresDeviceRuntime != true else {
            error = "This device-held connection cannot run through the Relay control plane. Create or select a control-plane connection first."
            return false
        }
        return await performAction {
            var params: [String: Any] = [
                "appSlug": app.slug,
                "selectedCapabilities": capabilities,
                "approvalProfileId": approvalProfileId,
                "runtimeFormat": runtimeFormat,
                "agentIds": [agent.id],
                "role": role,
                "libraryTargetFolder": "marketplace/\(app.slug)",
                "targetMode": "existing_agents",
                "acknowledgeGeneratedDraftRisk": true,
            ]
            if approvalProfileId == MarketplaceDangerousPolicy.id {
                guard acknowledgeDangerouslySkipPermissions else {
                    throw APIError.serverError(
                        statusCode: 400,
                        message: "Acknowledge the advanced dangerous-policy warning before installing this app."
                    )
                }
                params["acknowledgeDangerouslySkipPermissions"] = true
            }
            if let connection { params["connectionId"] = connection.id }
            let result: MarketplaceInstallResult = try await api.request(.installMarketplaceApp(workspaceId: workspaceId, params: params))
            if let newInstalls = result.installs {
                for install in newInstalls {
                    installs.removeAll { $0.id == install.id }
                    installs.insert(install, at: 0)
                }
            }
            notice = "\(app.name) installed for \(agent.name)."
            return true
        } ?? false
    }

    func remove(_ install: MarketplaceInstall) async {
        let _: MarketplaceInstall? = await performAction {
            let removed: MarketplaceInstall = try await api.request(.removeMarketplaceInstall(workspaceId: workspaceId, id: install.id))
            installs.removeAll { $0.id == install.id }
            notice = "Install removed."
            return removed
        }
    }

    func resolve(_ request: MarketplaceToolRequest, status: String) async {
        let _: MarketplaceToolRequest? = await performAction {
            let updated: MarketplaceToolRequest = try await api.request(
                .updateMarketplaceToolRequest(workspaceId: workspaceId, id: request.id, status: status, notes: nil)
            )
            toolRequests.removeAll { $0.id == updated.id }
            notice = status == "dismissed" ? "Tool request dismissed." : "Tool request updated."
            return updated
        }
    }

    private func performAction<T: Sendable>(_ operation: () async throws -> T) async -> T? {
        guard !actionInProgress else { return nil }
        actionInProgress = true
        error = nil
        defer { actionInProgress = false }
        do {
            return try await operation()
        } catch {
            self.error = message(for: error)
            return nil
        }
    }

    private func message(for error: any Error) -> String {
        (error as? APIError)?.errorDescription ?? error.localizedDescription
    }
}
