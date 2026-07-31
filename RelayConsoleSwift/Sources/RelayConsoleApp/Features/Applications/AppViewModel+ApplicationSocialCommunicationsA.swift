import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func connectCantoOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-canto-oauth", refresh: .applications) {
      guard app.slug == "canto", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let account = self.cantoAccountDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let clientId = self.cantoClientIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let clientSecret = self.cantoClientSecretDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !account.isEmpty, !clientId.isEmpty, !clientSecret.isEmpty else {
        throw RelayError(.invalidInput, "Enter the Canto account hostname, App ID, and App Secret.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/canto/oauth/start",
        body: [
          "displayName": "Canto account",
          "returnTo": "https://relayconsole.work/app?marketplace_app=canto",
          "selectedCapabilities": ["dam_read", "dam_manage"], "providerDomain": account,
          "clientId": clientId, "clientSecret": clientSecret,
        ])
      guard let urlString = response["authorizationUrl"] as? String,
        let url = URL(string: urlString), url.scheme == "https",
        ["oauth.canto.com", "oauth.canto.global", "oauth.canto.de", "oauth.ca.canto.com"].contains(
          url.host?.lowercased() ?? "")
      else {
        throw RelayError(.internalError, "Railway returned an invalid Canto authorization URL.")
      }
      self.cantoClientSecretDraft = ""
      NSWorkspace.shared.open(url)
      self.cantoConnectionStatus =
        "Canto authorization opened. After approval, your account will be ready for the agents selected above."
      return self.selectedThreadId
    }
  }

  func connectFrontifyOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-frontify-oauth", refresh: .applications) {
      guard app.slug == "frontify", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let account = self.frontifyAccountDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let clientId = self.frontifyClientIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let clientSecret = self.frontifyClientSecretDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      guard !account.isEmpty, !clientId.isEmpty, !clientSecret.isEmpty else {
        throw RelayError(
          .invalidInput, "Enter the Frontify hostname, Client ID, and Client Secret.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/frontify/oauth/start",
        body: [
          "displayName": "Frontify account",
          "returnTo": "https://relayconsole.work/app?marketplace_app=frontify",
          "selectedCapabilities": ["brand_read", "brand_manage"], "providerDomain": account,
          "clientId": clientId, "clientSecret": clientSecret,
        ])
      guard let urlString = response["authorizationUrl"] as? String,
        let url = URL(string: urlString), url.scheme == "https",
        url.host?.lowercased().hasSuffix(".frontify.com") == true,
        url.path == "/api/oauth/authorize"
      else {
        throw RelayError(.internalError, "Railway returned an invalid Frontify authorization URL.")
      }
      self.frontifyClientSecretDraft = ""
      NSWorkspace.shared.open(url)
      self.frontifyConnectionStatus =
        "Frontify authorization opened. After approval, this account will be ready for the agents selected above."
      return self.selectedThreadId
    }
  }

  func connectAssetBankOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-asset-bank-oauth", refresh: .applications) {
      guard app.slug == "asset-bank", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let site = self.assetBankSiteDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let clientId = self.assetBankClientIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let clientSecret = self.assetBankClientSecretDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      guard !site.isEmpty, !clientId.isEmpty, !clientSecret.isEmpty else {
        throw RelayError(
          .invalidInput, "Enter the Asset Bank site URL, Client ID, and Client Secret.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/asset-bank/oauth/start",
        body: [
          "displayName": "Asset Bank account",
          "returnTo": "https://relayconsole.work/app?marketplace_app=asset-bank",
          "selectedCapabilities": ["dam_read", "dam_manage"], "providerDomain": site,
          "clientId": clientId, "clientSecret": clientSecret,
        ])
      guard let urlString = response["authorizationUrl"] as? String,
        let url = URL(string: urlString), url.scheme == "https", let host = url.host?.lowercased(),
        host.hasSuffix(".assetbank.app") || host.hasSuffix(".assetbank-server.com"),
        url.path.hasSuffix("/oauth/authorize")
      else {
        throw RelayError(
          .internalError, "Relay Console returned an invalid Asset Bank authorization URL.")
      }
      self.assetBankClientSecretDraft = ""
      NSWorkspace.shared.open(url)
      self.assetBankConnectionStatus =
        "Asset Bank authorization opened. After approval, this site will be ready for the agents selected above."
      return self.selectedThreadId
    }
  }

  func saveBrandfolderRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-brandfolder-api-key", refresh: .applications) {
      guard app.slug == "brandfolder", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.brandfolderAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty else {
        throw RelayError(.invalidInput, "Brandfolder API key is required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "brandfolder", "displayName": "Brandfolder account", "authType": "api_key",
          "credentials": ["BRANDFOLDER_API_KEY": apiKey],
          "selectedCapabilities": ["dam_read", "dam_manage"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(
          .internalError, "Relay Console did not return the Brandfolder connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/brandfolder/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Brandfolder rejected the API key.")
      }
      self.brandfolderAPIKeyDraft = ""
      self.brandfolderConnectionStatus =
        "Brandfolder connected. Access follows the permissions of the user who created this key."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveWidenCollectiveRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-widen-collective-access-token", refresh: .applications) {
      guard app.slug == "widen-collective", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let subdomain = self.widenCollectiveSubdomainDraft.trimmingCharacters(
        in: .whitespacesAndNewlines
      ).lowercased()
      let accessToken = self.widenCollectiveAccessTokenDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      guard !subdomain.isEmpty, !accessToken.isEmpty else {
        throw RelayError(.invalidInput, "Collective subdomain and access token are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "widen-collective", "displayName": "Acquia DAM collective",
          "authType": "api_key",
          "credentials": [
            "WIDEN_COLLECTIVE_SUBDOMAIN": subdomain, "WIDEN_COLLECTIVE_ACCESS_TOKEN": accessToken,
          ], "selectedCapabilities": ["dam_read", "dam_manage"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(
          .internalError, "Relay Console did not return the Acquia DAM connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/widen-collective/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Acquia DAM rejected the connection details.")
      }
      self.widenCollectiveAccessTokenDraft = ""
      self.widenCollectiveConnectionStatus =
        "Acquia DAM connected. Access follows this account's roles and permissions."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveKontainerRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-kontainer-api-token", refresh: .applications) {
      guard app.slug == "kontainer", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let tenant = self.kontainerTenantDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      let accessToken = self.kontainerAccessTokenDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      guard !tenant.isEmpty, !accessToken.isEmpty else {
        throw RelayError(.invalidInput, "Kontainer subdomain and API token are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "kontainer", "displayName": "Kontainer tenant", "authType": "api_key",
          "credentials": ["KONTAINER_TENANT": tenant, "KONTAINER_ACCESS_TOKEN": accessToken],
          "selectedCapabilities": ["dam_read", "dam_manage"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(
          .internalError, "Relay Console did not return the Kontainer connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/kontainer/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Kontainer rejected the connection details.")
      }
      self.kontainerAccessTokenDraft = ""
      self.kontainerConnectionStatus =
        "Kontainer connected. Access follows this account's permissions."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveJiraAlignRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-jira-align-api-token", refresh: .applications) {
      guard app.slug == "jira-align", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let siteURL = self.jiraAlignSiteURLDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let email = self.jiraAlignEmailDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let apiToken = self.jiraAlignAPITokenDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !siteURL.isEmpty, !email.isEmpty, !apiToken.isEmpty else {
        throw RelayError(
          .invalidInput,
          "Jira Align site URL, Atlassian account email, and scoped API token are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "jira-align", "displayName": "Jira Align tenant", "authType": "api_key",
          "credentials": [
            "JIRA_ALIGN_SITE_URL": siteURL, "JIRA_ALIGN_EMAIL": email,
            "JIRA_ALIGN_API_TOKEN": apiToken,
          ], "selectedCapabilities": ["enterprise_planning_read", "enterprise_planning_manage"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(
          .internalError, "Relay Console did not return the Jira Align connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/jira-align/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Jira Align rejected the connection details.")
      }
      self.jiraAlignAPITokenDraft = ""
      self.jiraAlignConnectionStatus =
        "Jira Align connected. Access follows the token scopes and account role."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveDaminionRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-daminion-server-account", refresh: .applications) {
      guard app.slug == "daminion", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let tenant = self.daminionTenantDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
      let username = self.daminionUsernameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let password = self.daminionPasswordDraft
      guard !tenant.isEmpty, !username.isEmpty, !password.isEmpty else {
        throw RelayError(.invalidInput, "Daminion subdomain, username, and password are required.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "daminion", "displayName": "Daminion tenant", "authType": "api_key",
          "credentials": [
            "DAMINION_TENANT": tenant, "DAMINION_USERNAME": username, "DAMINION_PASSWORD": password,
          ], "selectedCapabilities": ["dam_read", "dam_manage"],
        ])
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay Console did not return the Daminion connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/daminion/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Daminion rejected the connection details.")
      }
      self.daminionPasswordDraft = ""
      self.daminionConnectionStatus = "Daminion connected. Access follows this user's role."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func connectMsProjectOAuth(for app: MarketplaceCatalogApp) {
    runAction("connect-ms-project-oauth", refresh: .applications) {
      guard app.slug == "ms-project", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let environment = self.msProjectEnvironmentDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      guard let environmentURL = URL(string: environment), environmentURL.scheme == "https",
        environmentURL.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .invalidInput,
          "Enter the HTTPS address of the Microsoft environment that contains your project schedules."
        )
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/ms-project/oauth/start",
        body: [
          "displayName": "Microsoft Project account",
          "returnTo": "https://relayconsole.work/app?marketplace_app=ms-project",
          "selectedCapabilities": ["project_read", "project_manage"], "providerDomain": environment,
          "microsoftAuthorityMode": "multi_tenant_org",
        ])
      guard let authorizationURL = response["authorizationUrl"] as? String,
        let url = URL(string: authorizationURL), url.scheme == "https",
        url.host == "login.microsoftonline.com",
        url.path == "/organizations/oauth2/v2.0/authorize"
      else {
        throw RelayError(
          .internalError, "Relay Console did not return a valid Microsoft sign-in link.")
      }
      self.msProjectConnectionStatus = "Continue in Microsoft to connect this project environment."
      self.applicationsSelectedAppId = app.id
      NSWorkspace.shared.open(url)
      return self.selectedThreadId
    }
  }

  func startXOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-x-oauth", refresh: .applications) {
      guard app.slug == "x" else { return self.selectedThreadId }
      guard let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(.unsupported, "X must use the authenticated Railway OAuth broker.")
      }
      throw RelayError(
        .unsupported,
        "X Relay-owned OAuth 2.0 PKCE, production App approval, funded credits/spending limit, exact HTTPS callback, token refresh/revocation, and account binding are not deployed on Railway yet. Desktop will not handle client credentials, manual tokens, code exchange, or loopback callbacks."
      )
    }
  }

  func startFacebookPagesOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-facebook-pages-oauth", refresh: .applications) {
      guard app.slug == "facebook-pages" else { return self.selectedThreadId }
      guard let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported, "Facebook Pages must use the authenticated Railway OAuth broker.")
      }
      throw RelayError(
        .unsupported,
        "Facebook Pages Relay-owned Meta OAuth, exact HTTPS callback, App Review, Page selection/token lifecycle, revocation, and live acceptance are not deployed on Railway yet. Desktop will not handle the app secret, tokens, code exchange, or loopback callbacks."
      )
    }
  }

  func selectFacebookPagesConnection(_ connectionId: RelayId) {
    facebookPagesSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func deleteFacebookPagesOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-facebook-pages-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "facebook-pages", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == app.slug && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.facebookPagesSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.facebookPagesConnectionStatus =
        "\(deleted.accountLabel ?? "Facebook Page") disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setFacebookPagesAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-facebook-pages-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "facebook-pages", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned,
        connection.grantedScopes == ProviderConnectionService.facebookPagesRelayOwnedOAuthScopes,
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["selectedPageVerified"]?.bool == true,
        connection.health.diagnostics["pageAuthoredPostsOnly"]?.bool == true,
        connection.health.diagnostics["visitorFeedEnabled"]?.bool == false,
        connection.health.diagnostics["commentsMessagesEnabled"]?.bool == false,
        connection.health.diagnostics["adsInsightsEnabled"]?.bool == false,
        connection.health.diagnostics["mediaEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready exact-permission selected-Page Meta OAuth connection is required before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(
            .invalidInput, "This agent already uses another Facebook Page connection.")
        }
        if existing == nil {
          let agent = try services.data.getAgent(agentId)
          _ = try services.marketplaceInstalls.createInstall(
            context: context,
            request: MarketplaceInstallRequest(
              id: createRelayId("minreq"), workspaceId: workspace.id,
              appId: app.id, appSlug: app.slug, connectionId: connection.id,
              targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
              selectedCapabilities: app.capabilities, approvalProfileId: nil,
              runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
              riskAcknowledged: true,
              metadata: [
                "source": .string("applications-facebook-pages-agent-switch"),
                "selectedPageOnly": .bool(true),
                "pageAuthoredPostsOnly": .bool(true),
              ], requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
        self.facebookPagesConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Facebook Page")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.facebookPagesConnectionStatus = "Agent disconnected from Facebook Pages."
      }
      self.facebookPagesSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectXTokenConnection(_ connectionId: RelayId) {
    xSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func startInstagramBusinessOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-instagram-business-oauth", refresh: .applications) {
      guard app.slug == "instagram-business" else { return self.selectedThreadId }
      guard let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported, "Instagram Business must use the authenticated Railway OAuth broker.")
      }
      throw RelayError(
        .unsupported,
        "Instagram Business Login, exact HTTPS callback, App Review, token exchange/refresh/revocation, and live acceptance are not deployed on Railway yet. Desktop will not handle the app secret, tokens, code exchange, or loopback callbacks."
      )
    }
  }

  func selectInstagramBusinessConnection(_ connectionId: RelayId) {
    instagramBusinessSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setInstagramBusinessAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-instagram-business-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "instagram-business", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned
      else {
        throw RelayError(
          .invalidInput,
          "A ready Relay-owned Instagram professional-account connection is required before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id,
            appId: app.id, appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: ["source": .string("applications-instagram-business-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.instagramBusinessConnectionStatus =
          "Agent connected to the Instagram professional account."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.instagramBusinessConnectionStatus = "Agent disconnected from Instagram Business."
      }
      self.instagramBusinessSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteInstagramBusinessConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-instagram-business-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "instagram-business", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == app.slug && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(
          context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.instagramBusinessSelectedConnectionId = ""
      self.instagramBusinessConnectionStatus =
        "\(deleted.accountLabel ?? "Instagram professional account") disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startThreadsOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-threads-oauth", refresh: .applications) {
      guard app.slug == "threads" else { return self.selectedThreadId }
      guard let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(.unsupported, "Threads must use the authenticated Railway OAuth broker.")
      }
      throw RelayError(
        .unsupported,
        "Production Threads OAuth, exact HTTPS callback, permission review, token exchange/refresh/revocation, and live acceptance are not deployed on Railway yet. Desktop will not handle the app secret, tokens, code exchange, or loopback callbacks."
      )
    }
  }

  func selectThreadsConnection(_ connectionId: RelayId) {
    threadsSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setThreadsAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-threads-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "threads", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned
      else {
        throw RelayError(
          .invalidInput,
          "A ready Relay-owned Threads profile connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id,
            appId: app.id, appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: ["source": .string("applications-threads-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.threadsConnectionStatus = "Agent connected to the Threads profile."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.threadsConnectionStatus = "Agent disconnected from Threads."
      }
      self.threadsSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteThreadsConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-threads-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "threads", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == app.slug && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(
          context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.threadsSelectedConnectionId = ""
      self.threadsConnectionStatus =
        "\(deleted.accountLabel ?? "Threads profile") disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startPinterestOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-pinterest-oauth", refresh: .applications) {
      guard app.slug == "pinterest" else { return self.selectedThreadId }
      guard let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(.unsupported, "Pinterest must use the authenticated Railway OAuth broker.")
      }
      throw RelayError(
        .unsupported,
        "Production Pinterest OAuth, exact HTTPS callback, Standard access review, token exchange/continuous refresh/revocation, and live acceptance are not deployed on Railway yet. Desktop will not handle the app secret, tokens, code exchange, or loopback callbacks."
      )
    }
  }

  func selectPinterestConnection(_ connectionId: RelayId) {
    pinterestSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setPinterestAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-pinterest-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "pinterest", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned
      else {
        throw RelayError(
          .invalidInput,
          "A ready Relay-owned Pinterest account connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id,
            appId: app.id, appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: ["source": .string("applications-pinterest-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.pinterestConnectionStatus = "Agent connected to the Pinterest account."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.pinterestConnectionStatus = "Agent disconnected from Pinterest."
      }
      self.pinterestSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deletePinterestConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-pinterest-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "pinterest", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == app.slug && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.pinterestSelectedConnectionId = ""
      self.pinterestConnectionStatus =
        "\(deleted.accountLabel ?? "Pinterest account") disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startTumblrOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-tumblr-oauth", refresh: .applications) {
      guard app.slug == "tumblr" else { return self.selectedThreadId }
      guard let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https",
        url.host?.nilIfEmpty != nil
      else {
        throw RelayError(.unsupported, "Tumblr must use the authenticated Railway OAuth broker.")
      }
      throw RelayError(
        .unsupported,
        "Production Tumblr OAuth 2, exact HTTPS callback, app registration, code exchange, rotating refresh, disconnect, and live acceptance are not deployed on Railway yet. Desktop will not handle the consumer secret, tokens, exchange, or loopback callbacks."
      )
    }
  }

  func selectTumblrConnection(_ connectionId: RelayId) {
    tumblrSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setTumblrAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-tumblr-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "tumblr", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned
      else {
        throw RelayError(
          .invalidInput,
          "A ready Relay-owned Tumblr account and selected owned blog are required before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id,
            appId: app.id, appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: ["source": .string("applications-tumblr-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-content-not-stored"))
        self.tumblrConnectionStatus = "Agent connected to the selected Tumblr blog."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.tumblrConnectionStatus = "Agent disconnected from Tumblr."
      }
      self.tumblrSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteTumblrConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-tumblr-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "tumblr", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == app.slug && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(
          context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.tumblrSelectedConnectionId = ""
      self.tumblrConnectionStatus =
        "\(deleted.accountLabel ?? "Tumblr account") disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startMastodonOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-mastodon-oauth", refresh: .applications) {
      guard app.slug == "mastodon" else { return self.selectedThreadId }
      let rawOrigin = self.mastodonInstanceOriginDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      guard let instance = URL(string: rawOrigin), instance.scheme == "https",
        instance.host?.nilIfEmpty != nil, instance.user == nil, instance.password == nil,
        instance.port == nil || instance.port == 443,
        instance.path.isEmpty || instance.path == "/",
        instance.query == nil, instance.fragment == nil
      else {
        throw RelayError(
          .invalidInput,
          "Enter one public HTTPS Mastodon server origin without a path, query, credentials, or custom port."
        )
      }
      guard let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https",
        url.host?.nilIfEmpty != nil
      else {
        throw RelayError(.unsupported, "Mastodon must use the authenticated Railway OAuth broker.")
      }
      throw RelayError(
        .unsupported,
        "Production Mastodon instance verification, dynamic client registration, state/PKCE code exchange, token revocation, and live acceptance are not deployed on Railway yet. Desktop will not contact unverified servers or handle client secrets, access tokens, or callbacks."
      )
    }
  }

  func selectMastodonConnection(_ connectionId: RelayId) {
    mastodonSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setMastodonAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-mastodon-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "mastodon", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned
      else {
        throw RelayError(
          .invalidInput,
          "A ready verified Mastodon instance and bound local account are required before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id,
            appId: app.id, appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: ["source": .string("applications-mastodon-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-content-not-stored"))
        self.mastodonConnectionStatus = "Agent connected to the bound Mastodon account."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.mastodonConnectionStatus = "Agent disconnected from Mastodon."
      }
      self.mastodonSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteMastodonConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-mastodon-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "mastodon", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == app.slug && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.mastodonSelectedConnectionId = ""
      self.mastodonConnectionStatus =
        "\(deleted.accountLabel ?? "Mastodon account") disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startBlueskyOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-bluesky-oauth", refresh: .applications) {
      guard app.slug == "bluesky", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let handle = self.blueskyHandleDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !handle.isEmpty, handle.count <= 253, !handle.contains("/") else {
        throw RelayError(.invalidInput, "Enter the Bluesky or AT Protocol handle to authorize.")
      }
      guard let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(.unsupported, "Bluesky must use the authenticated Railway OAuth broker.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/bluesky/oauth/start",
        body: [
          "handle": handle,
          "displayName": "Bluesky @\(handle.replacingOccurrences(of: "@", with: ""))",
          "returnTo": "https://relayconsole.work/app?marketplace_app=bluesky",
        ])
      guard let rawAuthorizationURL = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: rawAuthorizationURL),
        authorizationURL.scheme == "https"
      else {
        throw RelayError(.internalError, "Railway returned an invalid Bluesky authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.blueskyConnectionStatus =
        "Bluesky authorization opened in your browser. Railway will retain OAuth and DPoP secrets."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectBlueskyConnection(_ connectionId: RelayId) {
    blueskySelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setBlueskyAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-bluesky-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "bluesky", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        connection.grantedScopes == ProviderConnectionService.blueskyRelayOwnedOAuthScopes,
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["didVerified"]?.bool == true,
        connection.health.diagnostics["pdsVerified"]?.bool == true,
        connection.health.diagnostics["issuerVerified"]?.bool == true,
        connection.health.diagnostics["dpopBound"]?.bool == true,
        connection.health.diagnostics["ownOriginalPostsOnly"]?.bool == true,
        connection.health.diagnostics["textOnlyCreate"]?.bool == true,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput, "A ready OAuth-bound Bluesky account is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id,
            appId: app.id, appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: ["source": .string("applications-bluesky-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-content-not-stored"))
        self.blueskyConnectionStatus = "Agent connected to the OAuth-bound Bluesky account."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.blueskyConnectionStatus = "Agent disconnected from Bluesky."
      }
      self.blueskySelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteBlueskyConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-bluesky-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "bluesky", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == app.slug && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id,
        localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/bluesky/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.blueskySelectedConnectionId = ""
      self.blueskyConnectionStatus =
        "\(deleted.accountLabel ?? "Bluesky account") disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func testBlueskyConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-bluesky-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "bluesky", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id,
        localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "GET",
        relativePath: "connectors/bluesky/connections/\(remoteConnectionId)/health")
      self.blueskyConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Bluesky Railway OAuth and bound-DID health checks passed."
          : "Bluesky Railway health check requires reconnection.")
      self.blueskySelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startNextdoorOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-nextdoor-oauth", refresh: .applications) {
      guard app.slug == "nextdoor", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let expected = self.nextdoorExpectedProfileDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      guard expected.count <= 120 else {
        throw RelayError(
          .invalidInput, "The optional Nextdoor profile label must be 120 characters or fewer.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/nextdoor/oauth/start",
        body: [
          "expectedProfileLabel": expected,
          "returnTo": "https://relayconsole.work/app?marketplace_app=nextdoor",
        ])
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        ["nextdoor.com", "www.nextdoor.com"].contains(authorizationURL.host?.lowercased() ?? "")
      else {
        throw RelayError(.internalError, "Railway returned an invalid Nextdoor authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.nextdoorConnectionStatus =
        "Nextdoor authorization opened. Railway will retain the confidential client and OAuth tokens."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectNextdoorConnection(_ connectionId: RelayId) {
    nextdoorSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setNextdoorAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-nextdoor-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "nextdoor", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        Set(connection.grantedScopes)
          == Set(["openid", "profile:read", "post:read", "post:write"]),
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["stateVerified"]?.bool == true,
        connection.health.diagnostics["profileVerified"]?.bool == true,
        connection.health.diagnostics["selectedProfileIdBound"]?.bool == true,
        ["neighbor", "business"].contains(
          connection.health.diagnostics["selectedProfileType"]?.string ?? ""),
        connection.health.diagnostics["ownPostsOnly"]?.bool == true,
        connection.health.diagnostics["textOnlyCreate"]?.bool == true,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready selected-profile Nextdoor Publish API connection is required before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id,
            appId: app.id, appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: ["source": .string("applications-nextdoor-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-content-not-stored"))
        self.nextdoorConnectionStatus = "Agent connected to the selected Nextdoor profile."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.nextdoorConnectionStatus = "Agent disconnected from Nextdoor."
      }
      self.nextdoorSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteNextdoorConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-nextdoor-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "nextdoor", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == app.slug && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/nextdoor/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.nextdoorSelectedConnectionId = ""
      self.nextdoorConnectionStatus =
        "\(deleted.accountLabel ?? "Nextdoor profile") disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func testNextdoorConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-nextdoor-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "nextdoor", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/nextdoor/connections/\(remoteConnectionId)/health")
      self.nextdoorConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Nextdoor selected-profile OAuth health checks passed."
          : "Nextdoor requires reconnection or profile selection.")
      self.nextdoorSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startMeetupOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-meetup-oauth", refresh: .applications) {
      guard app.slug == "meetup", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/meetup/oauth/start",
        body: ["returnTo": "https://relayconsole.work/app?marketplace_app=meetup"])
      guard let raw = response["authorizationUrl"] as? String,
        let url = URL(string: raw), url.scheme == "https",
        url.host?.lowercased() == "secure.meetup.com"
      else {
        throw RelayError(.internalError, "Railway returned an invalid Meetup authorization URL.")
      }
      NSWorkspace.shared.open(url)
      self.meetupConnectionStatus =
        "Meetup authorization opened. Railway retains the confidential client and rotating OAuth tokens."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectMeetupConnection(_ connectionId: RelayId) {
    meetupSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setMeetupAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-meetup-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "meetup", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == "meetup", connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        connection.grantedScopes.isEmpty,
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["stateVerified"]?.bool == true,
        connection.health.diagnostics["memberVerified"]?.bool == true,
        connection.health.diagnostics["fixedQueriesOnly"]?.bool == true,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready identity-bound Meetup GraphQL connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "meetup" && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id,
            appId: app.id, appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: ["source": .string("applications-meetup-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-content-not-stored"))
        self.meetupConnectionStatus = "Agent connected with read-only Meetup authority."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.meetupConnectionStatus = "Agent disconnected from Meetup."
      }
      self.meetupSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteMeetupConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-meetup-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "meetup", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "meetup" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/meetup/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.meetupSelectedConnectionId = ""
      self.meetupConnectionStatus =
        "\(deleted.accountLabel ?? "Meetup member") disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func testMeetupConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-meetup-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "meetup", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/meetup/connections/\(remoteId)/health")
      self.meetupConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Meetup connected-member GraphQL health check passed."
          : "Meetup requires reconnection.")
      self.meetupSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startEventbriteOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-eventbrite-oauth", refresh: .applications) {
      guard app.slug == "eventbrite", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/eventbrite/oauth/start",
        body: ["returnTo": "https://relayconsole.work/app?marketplace_app=eventbrite"])
      guard let raw = response["authorizationUrl"] as? String,
        let url = URL(string: raw), url.scheme == "https",
        url.host?.lowercased() == "www.eventbrite.com"
      else {
        throw RelayError(
          .internalError, "Railway returned an invalid Eventbrite authorization URL.")
      }
      NSWorkspace.shared.open(url)
      self.eventbriteConnectionStatus =
        "Eventbrite authorization opened. Railway retains the confidential app credentials and user token."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectEventbriteConnection(_ connectionId: RelayId) {
    eventbriteSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setEventbriteAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-eventbrite-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "eventbrite", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == "eventbrite", connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        connection.grantedScopes.isEmpty,
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["stateVerified"]?.bool == true,
        connection.health.diagnostics["userVerified"]?.bool == true,
        connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true,
        connection.health.diagnostics["organizationMembershipRequired"]?.bool == true,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready user-bound Eventbrite connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "eventbrite" && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id,
            appId: app.id, appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: ["source": .string("applications-eventbrite-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-content-not-stored"))
        self.eventbriteConnectionStatus = "Agent connected with read-only Eventbrite authority."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.eventbriteConnectionStatus = "Agent disconnected from Eventbrite."
      }
      self.eventbriteSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteEventbriteConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-eventbrite-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "eventbrite", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "eventbrite" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/eventbrite/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.eventbriteSelectedConnectionId = ""
      self.eventbriteConnectionStatus =
        "\(deleted.accountLabel ?? "Eventbrite user") disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func testEventbriteConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-eventbrite-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "eventbrite", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/eventbrite/connections/\(remoteId)/health")
      self.eventbriteConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Eventbrite connected-user health check passed."
          : "Eventbrite requires reauthorization.")
      self.eventbriteSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startWebexOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-webex-oauth", refresh: .applications) {
      guard app.slug == "webex", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/webex/oauth/start",
        body: ["returnTo": "https://relayconsole.work/app?marketplace_app=webex"])
      guard let raw = response["authorizationUrl"] as? String,
        let url = URL(string: raw), url.scheme == "https",
        url.host?.lowercased() == "webexapis.com"
      else {
        throw RelayError(.internalError, "Railway returned an invalid Webex authorization URL.")
      }
      NSWorkspace.shared.open(url)
      self.webexConnectionStatus =
        "Webex authorization opened. Railway retains the confidential client and rotating OAuth tokens."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectWebexConnection(_ connectionId: RelayId) {
    webexSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setWebexAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-webex-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "webex", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == "webex", connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        Set(connection.grantedScopes) == Set(["spark:people_read", "meeting:schedules_read"]),
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["stateVerified"]?.bool == true,
        connection.health.diagnostics["pkceS256"]?.bool == true,
        connection.health.diagnostics["personVerified"]?.bool == true,
        connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready person-bound Webex Meetings connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "webex" && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id,
            appId: app.id, appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: ["source": .string("applications-webex-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-content-not-stored"))
        self.webexConnectionStatus = "Agent connected with read-only Webex authority."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.webexConnectionStatus = "Agent disconnected from Webex."
      }
      self.webexSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteWebexConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-webex-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "webex", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "webex" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/webex/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.webexSelectedConnectionId = ""
      self.webexConnectionStatus =
        "\(deleted.accountLabel ?? "Webex user") disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func testWebexConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-webex-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "webex", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/webex/connections/\(remoteId)/health")
      self.webexConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Webex connected-person health check passed."
          : "Webex requires reauthorization.")
      self.webexSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoToMeetingOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-goto-meeting-oauth", refresh: .applications) {
      guard app.slug == "goto-meeting", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/goto-meeting/oauth/start",
        body: ["returnTo": "https://relayconsole.work/app?marketplace_app=goto-meeting"])
      guard let raw = response["authorizationUrl"] as? String,
        let url = URL(string: raw), url.scheme == "https",
        url.host?.lowercased() == "authentication.logmeininc.com"
      else {
        throw RelayError(.internalError, "Railway returned an invalid GoTo authorization URL.")
      }
      NSWorkspace.shared.open(url)
      self.goToMeetingConnectionStatus =
        "GoTo authorization opened. Railway retains the confidential client and rotating OAuth tokens."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectGoToMeetingConnection(_ connectionId: RelayId) {
    goToMeetingSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setGoToMeetingAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-goto-meeting-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "goto-meeting", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == "goto-meeting", connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        connection.grantedScopes.isEmpty,
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["stateVerified"]?.bool == true,
        connection.health.diagnostics["identityVerified"]?.bool == true,
        connection.health.diagnostics["organizerBound"]?.bool == true,
        connection.health.diagnostics["gotoMeetingClientOnly"]?.bool == true,
        connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready organizer-bound GoTo Meeting connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "goto-meeting" && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id,
            appId: app.id, appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: ["source": .string("applications-goto-meeting-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-content-not-stored"))
        self.goToMeetingConnectionStatus = "Agent connected with read-only GoTo Meeting authority."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.goToMeetingConnectionStatus = "Agent disconnected from GoTo Meeting."
      }
      self.goToMeetingSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteGoToMeetingConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-goto-meeting-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "goto-meeting", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "goto-meeting" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/goto-meeting/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.goToMeetingSelectedConnectionId = ""
      self.goToMeetingConnectionStatus =
        "\(deleted.accountLabel ?? "GoTo organizer") disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func testGoToMeetingConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-goto-meeting-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "goto-meeting", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/goto-meeting/connections/\(remoteId)/health")
      self.goToMeetingConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "GoTo organizer identity health check passed."
          : "GoTo Meeting requires reauthorization.")
      self.goToMeetingSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startRingCentralOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-ringcentral-oauth", refresh: .applications) {
      guard app.slug == "ringcentral", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/ringcentral/oauth/start",
        body: ["returnTo": "https://relayconsole.work/app?marketplace_app=ringcentral"])
      guard let raw = response["authorizationUrl"] as? String,
        let url = URL(string: raw), url.scheme == "https",
        url.host?.lowercased() == "platform.ringcentral.com"
      else {
        throw RelayError(
          .internalError, "Railway returned an invalid RingCentral authorization URL.")
      }
      NSWorkspace.shared.open(url)
      self.ringCentralConnectionStatus =
        "RingCentral authorization opened. Railway retains PKCE state and rotating OAuth tokens."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectRingCentralConnection(_ connectionId: RelayId) {
    ringCentralSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func setRingCentralAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-ringcentral-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "ringcentral", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == "ringcentral", connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        Set(connection.grantedScopes) == Set(["ReadAccounts", "ReadCallLog"]),
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["stateVerified"]?.bool == true,
        connection.health.diagnostics["pkceS256"]?.bool == true,
        connection.health.diagnostics["extensionVerified"]?.bool == true,
        connection.health.diagnostics["selfExtensionOnly"]?.bool == true,
        connection.health.diagnostics["canonicalPlatformOnly"]?.bool == true,
        connection.health.diagnostics["privacyMasked"]?.bool == true,
        connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready self-extension-bound RingCentral connection is required before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "ringcentral" && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id,
            appId: app.id, appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: ["source": .string("applications-ringcentral-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-content-not-stored"))
        self.ringCentralConnectionStatus =
          "Agent connected with read-only privacy-masked RingCentral authority."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.ringCentralConnectionStatus = "Agent disconnected from RingCentral."
      }
      self.ringCentralSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
}
