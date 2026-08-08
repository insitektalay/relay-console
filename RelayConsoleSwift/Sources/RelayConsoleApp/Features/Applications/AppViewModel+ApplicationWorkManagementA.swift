import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func startLeverOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-lever-oauth", refresh: .applications) {
      guard app.slug == "lever" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_LEVER_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = RelayCloudLaunchContract.configuredRailwayOrigin,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Lever partner OAuth needs RELAY_LEVER_OAUTH_CLIENT_ID plus the secure CLAWCHAT_RAILWAY_ORIGIN callback/token broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Lever exchange, rotating refresh, revoke, exact-account selection, and disconnect broker is not deployed on Railway yet."
      )
    }
  }
  func selectLeverConnection(_ id: RelayId) {
    leverSelectedConnectionId = id
    scheduleApplicationsRefresh(selectedConnectionId: id)
  }
  func deleteLeverConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-lever-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "lever", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "lever" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.leverSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.leverConnectionStatus = "\(deleted.accountLabel ?? "Lever") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setLeverAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-lever-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "lever", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, leverConnectionIsReady(connection)
      else {
        throw RelayError(
          .invalidInput,
          "Complete and select a ready exact-scope Lever account connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeLeverInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeLeverInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Lever connection.")
        }
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-lever-agent-switch"),
              "accountId": connection.health.diagnostics["accountId"] ?? .null,
              "runtimeWriteDeferredReason": .string("lever-read-only-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.leverConnectionStatus = "\(name) connected to \(connection.accountLabel ?? "Lever")."
      } else if let install = self.activeLeverInstall(agentId: agentId, connectionId: connection.id)
      {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.leverConnectionStatus = "\(name) disconnected from Lever."
      }
      self.leverSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveSentryAuthToken(for app: MarketplaceCatalogApp) {
    runAction("save-sentry-auth-token", refresh: .applications) {
      guard app.slug == "sentry" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      self.sentryConnectionStatus = "Checking Sentry auth token before saving."
      await Task.yield()
      let connection = try await services.providerConnections.connectSentryAuthToken(
        context: self.chatContext(workspaceId: workspace.id),
        appIdOrSlug: app.id,
        authToken: self.sentryAuthTokenDraft,
        organizationSlug: self.sentryOrganizationSlugDraft,
        baseURL: self.sentryBaseURLDraft.nilIfEmpty,
        defaultProjectSlug: self.sentryDefaultProjectSlugDraft.nilIfEmpty,
        defaultEnvironment: self.sentryDefaultEnvironmentDraft.nilIfEmpty,
        displayName: self.sentryConnectionNameDraft.nilIfEmpty
      )
      self.sentryConnectionNameDraft = ""
      self.sentryAuthTokenDraft = ""
      self.sentryOrganizationSlugDraft = ""
      self.sentryBaseURLDraft = ""
      self.sentryDefaultProjectSlugDraft = ""
      self.sentryDefaultEnvironmentDraft = ""
      self.sentrySelectedConnectionId = connection.id
      self.sentryConnectionStatus =
        "\(connection.accountLabel ?? "Sentry organization") saved for \(connection.connectedHandle ?? "selected organization"). Issue updates remain approval-gated unless Direct writes is selected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startSentryOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-sentry-oauth", refresh: .applications) {
      guard app.slug == "sentry" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let organization = self.sentryOrganizationSlugDraft.nilIfEmpty else {
        throw RelayError(
          .invalidInput, "Enter the Sentry organization slug selected during consent.")
      }
      let clientId = try Self.sentryRelayOAuthClientId()
      let device = try Self.startSentryDeviceAuthorization(clientId: clientId)
      guard let verificationURL = URL(string: device.verificationURL),
        verificationURL.scheme == "https"
      else { throw RelayError(.invalidInput, "Sentry returned an invalid verification URL.") }
      self.sentryConnectionStatus =
        "Opening Sentry authorization. Confirm code \(device.userCode) and select one organization."
      NSWorkspace.shared.open(verificationURL)
      let token = try Self.pollSentryDeviceAuthorization(clientId: clientId, device: device)
      let connection = try await services.providerConnections.connectSentryRelayOwnedOAuth(
        context: self.chatContext(workspaceId: workspace.id), appIdOrSlug: app.id,
        accessToken: token.accessToken, refreshToken: token.refreshToken, clientId: clientId,
        organizationSlug: organization, baseURL: self.sentryBaseURLDraft.nilIfEmpty,
        defaultProjectSlug: self.sentryDefaultProjectSlugDraft.nilIfEmpty,
        defaultEnvironment: self.sentryDefaultEnvironmentDraft.nilIfEmpty,
        grantedScopes: token.scopes, expiresAt: token.expiresAt,
        displayName: self.sentryConnectionNameDraft.nilIfEmpty
      )
      self.sentryConnectionNameDraft = ""
      self.sentryOrganizationSlugDraft = ""
      self.sentryBaseURLDraft = ""
      self.sentryDefaultProjectSlugDraft = ""
      self.sentryDefaultEnvironmentDraft = ""
      self.sentrySelectedConnectionId = connection.id
      self.sentryConnectionStatus =
        "\(connection.accountLabel ?? "Sentry organization") connected through Relay-owned device OAuth."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  struct SentryDeviceAuthorization {
    var deviceCode: String
    var userCode: String
    var verificationURL: String
    var expiresIn: Int
    var interval: Int
  }
  struct SentryOAuthToken {
    var accessToken: String
    var refreshToken: String
    var scopes: [String]
    var expiresAt: String?
  }
  static func sentryRelayOAuthClientId(
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) throws -> String {
    guard let value = environment["RELAY_SENTRY_OAUTH_CLIENT_ID"]?.nilIfEmpty, value.count <= 500
    else {
      throw RelayError(
        .unsupported,
        "Sentry OAuth needs RELAY_SENTRY_OAUTH_CLIENT_ID from Relay's registered Sentry integration."
      )
    }
    return value
  }
  static func startSentryDeviceAuthorization(clientId: String) throws
    -> SentryDeviceAuthorization
  {
    let body =
      "client_id=\(formEncode(clientId))&scope=\(formEncode(ProviderConnectionService.sentryAuthTokenScopes.joined(separator: " ")))"
    let response = try URLSessionSentryProviderHTTPClient(timeoutSeconds: 20).send(
      SentryProviderHTTPRequest(
        method: "POST", url: URL(string: "https://sentry.io/oauth/device/code/")!,
        headers: [
          "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded",
        ], body: Data(body.utf8)))
    guard (200..<300).contains(response.statusCode),
      let object = try JSONSerialization.jsonObject(with: response.body) as? [String: Any],
      let device = object["device_code"] as? String, let user = object["user_code"] as? String,
      let uri = (object["verification_uri_complete"] as? String)
        ?? (object["verification_uri"] as? String)
    else { throw RelayError(.invalidInput, "Sentry could not start device authorization.") }
    return SentryDeviceAuthorization(
      deviceCode: device, userCode: user, verificationURL: uri,
      expiresIn: (object["expires_in"] as? NSNumber)?.intValue ?? 600,
      interval: (object["interval"] as? NSNumber)?.intValue ?? 5)
  }
  static func pollSentryDeviceAuthorization(
    clientId: String, device: SentryDeviceAuthorization
  ) throws -> SentryOAuthToken {
    let deadline = Date().addingTimeInterval(TimeInterval(min(device.expiresIn, 600)))
    var interval = max(5, device.interval)
    while Date() < deadline {
      Thread.sleep(forTimeInterval: TimeInterval(interval))
      let body =
        "client_id=\(formEncode(clientId))&device_code=\(formEncode(device.deviceCode))&grant_type=\(formEncode("urn:ietf:params:oauth:grant-type:device_code"))"
      let response = try URLSessionSentryProviderHTTPClient(timeoutSeconds: 20).send(
        SentryProviderHTTPRequest(
          method: "POST", url: URL(string: "https://sentry.io/oauth/token/")!,
          headers: [
            "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded",
          ], body: Data(body.utf8)))
      guard let object = try JSONSerialization.jsonObject(with: response.body) as? [String: Any]
      else { continue }
      if let access = object["access_token"] as? String,
        let refresh = object["refresh_token"] as? String
      {
        let scopes = ((object["scope"] as? String)?.split(separator: " ").map(String.init) ?? [])
          .sorted()
        guard scopes == ProviderConnectionService.sentryAuthTokenScopes.sorted() else {
          throw RelayError(.invalidInput, "Sentry returned a different scope set than Relay V1.")
        }
        return SentryOAuthToken(
          accessToken: access, refreshToken: refresh,
          scopes: ProviderConnectionService.sentryAuthTokenScopes,
          expiresAt: (object["expires_at"] as? String)?.nilIfEmpty)
      }
      switch object["error"] as? String {
      case "authorization_pending": continue
      case "slow_down": interval += 5
      case "access_denied": throw RelayError(.invalidInput, "Sentry authorization was denied.")
      case "expired_token": throw RelayError(.invalidInput, "Sentry authorization expired.")
      default: throw RelayError(.invalidInput, "Sentry device authorization failed.")
      }
    }
    throw RelayError(.invalidInput, "Sentry authorization timed out.")
  }

  func selectSentryConnection(_ connectionId: RelayId) {
    sentrySelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func testSentryConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-sentry-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "sentry" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      self.sentrySelectedConnectionId = connection.id
      self.sentryConnectionStatus = "Checking \(connection.accountLabel ?? "Sentry organization")."
      await Task.yield()
      let updated = try await services.providerConnections.validateSavedSentryConnection(
        context: self.chatContext(workspaceId: workspace.id),
        connectionId: connection.id
      )
      if updated.status == .connected && updated.health.state == .ready {
        self.sentrySelectedConnectionId = updated.id
      } else {
        self.sentrySelectedConnectionId =
          self.providerConnectionSnapshot?.connections.first {
            $0.id != updated.id && $0.status == .connected && $0.health.state == .ready
          }?.id ?? ""
      }
      self.sentryConnectionStatus =
        "\(updated.accountLabel ?? "Sentry organization"): \(updated.health.message)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteSentryConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-sentry-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "sentry" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "sentry" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/asana/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.sentrySelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.sentryConnectionStatus =
        "\(deleted.accountLabel ?? "Sentry organization") deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setSentryAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-sentry-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "sentry" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(
          .invalidInput, "Connect Sentry through Relay-owned OAuth before assigning agents.")
      }
      guard connection.status == .connected, connection.health.state == .ready else {
        throw RelayError(
          .invalidInput, "Check or replace this Sentry connection before assigning agents.")
      }
      let organizationSlug =
        connection.health.diagnostics["organizationSlug"]?.string?.nilIfEmpty
        ?? connection.connectedHandle?.nilIfEmpty
      guard let organizationSlug else {
        throw RelayError(.invalidInput, "Connect a Sentry organization before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeSentryInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeSentryInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another Sentry connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.sentryConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Sentry organization")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"),
            workspaceId: workspace.id,
            appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id,
            targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities,
            approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: [
              "source": .string("applications-sentry-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "organizationSlug": .string(organizationSlug),
              "baseURL": connection.health.diagnostics["baseURL"] ?? .string("https://sentry.io"),
              "defaultProjectSlug": connection.health.diagnostics["defaultProjectSlug"] ?? .null,
              "defaultEnvironment": connection.health.diagnostics["defaultEnvironment"] ?? .null,
              "runtimeWriteDeferredReason": .string("approval-gated-observability-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.sentryConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Sentry organization")."
      } else {
        guard let install = self.activeSentryInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.sentryConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Sentry organization")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.sentryConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Sentry organization")."
      }
      self.sentrySelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleSearchConsoleOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-search-console-oauth", refresh: .applications) {
      guard app.slug == "google-search-console" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = RelayCloudLaunchContract.configuredRailwayOrigin,
        let url = URL(string: origin),
        url.scheme == "https",
        url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Search Console must use the authenticated Railway broker with Relay-owned Google OAuth client configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Google Search Console authorization, offline refresh, revocation, and selected-property binding are not deployed on Railway yet. The desktop will not handle Relay's client secret, run a loopback callback, or exchange authorization codes."
      )
    }
  }

  func selectGoogleSearchConsoleConnection(_ connectionId: RelayId) {
    googleSearchConsoleSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func testGoogleSearchConsoleConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-google-search-console-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-search-console" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      self.googleSearchConsoleSelectedConnectionId = connection.id
      self.googleSearchConsoleConnectionStatus =
        "Checking \(connection.accountLabel ?? "Google Search Console OAuth account")."
      await Task.yield()
      let updated = try await services.providerConnections
        .validateSavedGoogleSearchConsoleConnection(
          context: self.chatContext(workspaceId: workspace.id),
          connectionId: connection.id
        )
      if updated.status == .connected && updated.health.state == .ready {
        self.googleSearchConsoleSelectedConnectionId = updated.id
      } else {
        self.googleSearchConsoleSelectedConnectionId =
          self.providerConnectionSnapshot?.connections.first {
            $0.id != updated.id && $0.status == .connected && $0.health.state == .ready
              && $0.health.diagnostics["selectedSiteUrl"]?.string?.nilIfEmpty != nil
          }?.id ?? ""
      }
      self.googleSearchConsoleConnectionStatus =
        "\(updated.accountLabel ?? "Google Search Console OAuth account"): \(updated.health.message)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteGoogleSearchConsoleOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction(
      "delete-google-search-console-oauth-connection-\(connection.id)", refresh: .applications
    ) {
      guard app.slug == "google-search-console" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-search-console" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleSearchConsoleSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.googleSearchConsoleConnectionStatus =
        "\(deleted.accountLabel ?? "Google Search Console OAuth account") deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setGoogleSearchConsoleAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-search-console-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-search-console" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(.invalidInput, "Connect Google Search Console before assigning agents.")
      }
      guard connection.status == .connected,
        connection.health.state == .ready,
        connection.appSlug == "google-search-console",
        connection.credentialOwnership == .relayOwned,
        connection.userOwnedCredentialsRequired == false,
        connection.grantedScopes
          == ProviderConnectionService.googleSearchConsoleRelayOwnedOAuthScopes,
        connection.health.diagnostics["readOnlyV1"]?.bool == true,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["serviceAccountEnabled"]?.bool == false,
        connection.health.diagnostics["domainDelegationEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready Relay-owned, exact-scope, read-only Search Console connection is required before assigning agents."
        )
      }
      let selectedSiteUrl = connection.health.diagnostics["selectedSiteUrl"]?.string?.nilIfEmpty
      guard let selectedSiteUrl,
        selectedSiteUrl.hasPrefix("sc-domain:") || URL(string: selectedSiteUrl)?.scheme == "https"
      else {
        throw RelayError(
          .invalidInput, "Choose a safe explicit Search Console property before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.googleSearchConsoleDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeGoogleSearchConsoleInstall(agentId: agentId, connectionId: connection.id)
          != nil
        {
          return self.selectedThreadId
        }
        if self.activeGoogleSearchConsoleInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput,
            "\(displayName) is already assigned to another Google Search Console connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.googleSearchConsoleConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Google Search Console OAuth account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"),
            workspaceId: workspace.id,
            appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id,
            targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities,
            approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: [
              "source": .string("applications-google-search-console-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "selectedSiteUrl": .string(selectedSiteUrl),
              "runtimeWriteDeferredReason": .string("read-only-search-console-v1"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.googleSearchConsoleConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Google Search Console OAuth account")."
      } else {
        guard
          let install = self.activeGoogleSearchConsoleInstall(
            agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.googleSearchConsoleConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Google Search Console OAuth account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.googleSearchConsoleConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Google Search Console OAuth account")."
      }
      self.googleSearchConsoleSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startNotionOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-notion-oauth", refresh: .applications) {
      guard app.slug == "notion", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "Notion workspace",
        "returnTo": "https://relayconsole.work/app?marketplace_app=notion",
        "selectedCapabilities": [
          "content_search", "page_read", "block_read", "content_draft",
          "page_write", "block_write",
        ],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "notion" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST", relativePath: "connectors/notion/oauth/start", body: body)
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "api.notion.com",
        authorizationURL.path == "/v1/oauth/authorize"
      else {
        throw RelayError(.internalError, "Railway returned an invalid Notion authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.notionConnectionStatus =
        "Notion authorization opened. Choose the workspace pages you want Relay Console to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startLinearOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-linear-oauth", refresh: .applications) {
      guard app.slug == "linear", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "Linear workspace",
        "returnTo": "https://relayconsole.work/app?marketplace_app=linear",
        "selectedCapabilities": [
          "team_read", "issue_read", "project_read", "issue_draft",
          "issue_write", "comment_write",
        ],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "linear" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST", relativePath: "connectors/linear/oauth/start", body: body)
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "linear.app",
        authorizationURL.path == "/oauth/authorize"
      else {
        throw RelayError(.internalError, "Railway returned an invalid Linear authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.linearConnectionStatus =
        "Linear authorization opened. Choose the workspace you want Relay Console to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveNotionAPIToken(for app: MarketplaceCatalogApp) {
    runAction("save-notion-api-token", refresh: .applications) {
      guard app.slug == "notion" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      self.notionConnectionStatus = "Testing Notion token before saving."
      await Task.yield()
      let connection = try await services.providerConnections.connectNotionAPIToken(
        context: self.chatContext(workspaceId: workspace.id),
        appIdOrSlug: app.id,
        credentialMode: self.notionCredentialModeDraft,
        apiToken: self.notionAPITokenDraft,
        workspaceLabel: self.notionWorkspaceLabelDraft.nilIfEmpty,
        displayName: self.notionConnectionNameDraft.nilIfEmpty
      )
      self.notionConnectionNameDraft = ""
      self.notionAPITokenDraft = ""
      self.notionWorkspaceLabelDraft = ""
      self.notionSelectedConnectionId = connection.id
      self.notionConnectionStatus =
        "\(connection.accountLabel ?? "Notion token") saved. No Relay-owned Notion app or callback is used."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectNotionConnection(_ connectionId: RelayId) {
    notionSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func testNotionConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-notion-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "notion" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      self.notionSelectedConnectionId = connection.id
      self.notionConnectionStatus = "Testing \(connection.accountLabel ?? "Notion token")."
      await Task.yield()
      let updated = try await services.providerConnections.validateSavedNotionConnection(
        context: self.chatContext(workspaceId: workspace.id),
        connectionId: connection.id
      )
      if updated.status == .connected && updated.health.state == .ready {
        self.notionSelectedConnectionId = updated.id
      } else {
        self.notionSelectedConnectionId =
          self.providerConnectionSnapshot?.connections.first {
            $0.id != updated.id && $0.status == .connected && $0.health.state == .ready
          }?.id ?? ""
      }
      self.notionConnectionStatus =
        "\(updated.accountLabel ?? "Notion token"): \(updated.health.message)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteNotionConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-notion-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "notion" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "notion" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.notionSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.notionConnectionStatus =
        "\(deleted.accountLabel ?? "Notion token") deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setNotionAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-notion-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "notion" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(.invalidInput, "Save a Notion API token before assigning agents.")
      }
      guard connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Save a connected Notion API token before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.notionDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeNotionInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeNotionInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another Notion connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.notionConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Notion token")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"),
            workspaceId: workspace.id,
            appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id,
            targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities,
            approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: [
              "source": .string("applications-notion-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-workspace-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.notionConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Notion token")."
      } else {
        guard let install = self.activeNotionInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.notionConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Notion token")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.notionConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Notion token")."
      }
      self.notionSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setSlackAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-slack-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "slack" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(.invalidInput, "Connect Slack before assigning agents.")
      }
      guard connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Slack workspace before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.slackDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeSlackInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeSlackInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another Slack connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.slackConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Slack workspace")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"),
            workspaceId: workspace.id,
            appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id,
            targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities,
            approvalProfileId: "slack_safe",
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: [
              "source": .string("applications-slack-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-slack-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.slackConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Slack workspace")."
      } else {
        guard let install = self.activeSlackInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.slackConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Slack workspace")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.slackConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Slack workspace")."
      }
      self.slackSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startSlackOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-slack-oauth", refresh: .applications) {
      guard app.slug == "slack", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "Slack workspace",
        "returnTo": "https://relayconsole.work/app?marketplace_app=slack",
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "slack" {
        let connectionId = connection.id
        body["connectionId"] = connectionId
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/slack/oauth/start",
        body: body)
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        ["slack.com", "www.slack.com"].contains(
          authorizationURL.host?.lowercased() ?? "")
      else {
        throw RelayError(
          .internalError, "Railway returned an invalid Slack authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.slackConnectionStatus =
        "Slack authorization opened. Railway will retain the confidential client and workspace token."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGitHubOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-github-oauth", refresh: .applications) {
      guard app.slug == "github", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "GitHub account",
        "returnTo": "https://relayconsole.work/app?marketplace_app=github",
        "selectedCapabilities": [
          "repository_search",
          "issue_read",
          "pull_request_read",
          "comment_draft",
          "issue_comment_write",
          "pull_request_comment_write",
        ],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "github" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/github/oauth/start",
        body: body)
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "github.com",
        authorizationURL.path.hasPrefix("/apps/"),
        authorizationURL.path.hasSuffix("/installations/new")
      else {
        throw RelayError(
          .internalError, "Railway returned an invalid GitHub authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.githubConnectionStatus =
        "GitHub authorization opened. Approve the repositories and permissions you want Relay Console to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGitLabOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-gitlab-oauth", refresh: .applications) {
      guard app.slug == "gitlab", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "GitLab account",
        "returnTo": "https://relayconsole.work/app?marketplace_app=gitlab",
        "selectedCapabilities": [
          "project_search",
          "issue_read",
          "merge_request_read",
          "comment_draft",
          "issue_comment_write",
          "merge_request_comment_write",
        ],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "gitlab" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/gitlab/oauth/start",
        body: body)
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "gitlab.com",
        authorizationURL.path == "/oauth/authorize"
      else {
        throw RelayError(.internalError, "Railway returned an invalid GitLab authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.gitLabConnectionStatus =
        "GitLab authorization opened. Approve the account permissions you want Relay Console to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startBitbucketOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-bitbucket-oauth", refresh: .applications) {
      guard app.slug == "bitbucket", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "Bitbucket account",
        "returnTo": "https://relayconsole.work/app?marketplace_app=bitbucket",
        "selectedCapabilities": [
          "repository_search",
          "issue_read",
          "pull_request_read",
          "comment_draft",
          "issue_comment_write",
          "pull_request_comment_write",
        ],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "bitbucket" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/bitbucket/oauth/start",
        body: body)
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "bitbucket.org",
        authorizationURL.path == "/site/oauth2/authorize"
      else {
        throw RelayError(
          .internalError, "Railway returned an invalid Bitbucket authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.bitbucketConnectionStatus =
        "Bitbucket authorization opened. Approve the account permissions you want Relay Console to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setGitHubAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-github-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "github" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(.invalidInput, "Connect GitHub before assigning agents.")
      }
      guard connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready GitHub account or organization before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.githubDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeGitHubInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeGitHubInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another GitHub connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.githubConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "GitHub account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"),
            workspaceId: workspace.id,
            appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id,
            targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities,
            approvalProfileId: "github_safe",
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: [
              "source": .string("applications-github-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-github-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.githubConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "GitHub account")."
      } else {
        guard let install = self.activeGitHubInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.githubConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "GitHub account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.githubConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "GitHub account")."
      }
      self.githubSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setGitLabAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-gitlab-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "gitlab" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(.invalidInput, "Connect GitLab before assigning agents.")
      }
      guard connection.status == .connected else {
        throw RelayError(
          .invalidInput,
          "Connect a ready GitLab account, group, or project before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.gitLabDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeGitLabInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeGitLabInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another GitLab connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.gitLabConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "GitLab account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"),
            workspaceId: workspace.id,
            appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id,
            targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities,
            approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: [
              "source": .string("applications-gitlab-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-gitlab-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.gitLabConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "GitLab account")."
      } else {
        guard let install = self.activeGitLabInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.gitLabConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "GitLab account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.gitLabConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "GitLab account")."
      }
      self.gitLabSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setBitbucketAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-bitbucket-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "bitbucket" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(.invalidInput, "Connect Bitbucket before assigning agents.")
      }
      guard connection.status == .connected else {
        throw RelayError(
          .invalidInput,
          "Connect a ready Bitbucket account, workspace, or repository before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.bitbucketDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeBitbucketInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeBitbucketInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another Bitbucket connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.bitbucketConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Bitbucket account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"),
            workspaceId: workspace.id,
            appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id,
            targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities,
            approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: [
              "source": .string("applications-bitbucket-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-bitbucket-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.bitbucketConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Bitbucket account")."
      } else {
        guard
          let install = self.activeBitbucketInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.bitbucketConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Bitbucket account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.bitbucketConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Bitbucket account")."
      }
      self.bitbucketSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setMarketplaceAgentPolicy(
    _ preset: MarketplaceActionPolicyPreset,
    install: MarketplaceInstallRecord,
    for app: MarketplaceCatalogApp,
    acknowledgeDangerousPolicy: Bool = false
  ) {
    runAction("set-marketplace-policy-\(install.id)", refresh: .applications) {
      guard self.marketplaceActionPolicyPresets(for: app).contains(preset) else {
        throw RelayError(.invalidInput, "\(app.name) does not support that authority preset.")
      }
      guard self.isActiveMarketplaceInstall(install) else {
        throw RelayError(.invalidInput, "Only active agent connections can have authority changed.")
      }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      if preset == .allowDirectWrites,
        install.metadata["providerActionFrameworkHydrated"]?.bool != true
      {
        _ = try services.marketplaceInstalls.updateInstall(
          context: context,
          installId: install.id,
          approvalProfileId: "dangerously_skip_permissions",
          acknowledgeDangerouslySkipPermissions: acknowledgeDangerousPolicy
        )
        return self.selectedThreadId
      }
      let permissionMap = try services.providerActionPolicies.compilePolicyMap(
        context: context,
        appIdOrSlug: app.id,
        preset: preset,
        acknowledgeDangerousPolicy: acknowledgeDangerousPolicy,
        connectionId: install.connectionId,
        installId: install.id,
        agentId: install.agentId
      )
      var updatedInstall = install
      updatedInstall.metadata["providerActionFrameworkHydrated"] = .bool(true)
      updatedInstall.metadata["providerActionPolicyMapId"] = .string(permissionMap.id)
      updatedInstall.metadata["providerActionPolicyPreset"] = .string(
        permissionMap.policyPreset.rawValue)
      updatedInstall.metadata["providerActionDefinitionCount"] = .number(
        Double(permissionMap.permissions.count))
      updatedInstall.metadata["providerActionFrameworkSource"] = .string(
        "applications-agent-authority-menu")
      updatedInstall.updatedAt = permissionMap.updatedAt
      _ = try services.data.saveMarketplaceInstall(updatedInstall)

      let displayName = self.agentDisplayName(for: install.agentId, fallback: install.agentName)
      let status =
        "\(displayName)'s \(app.name) authority is now \(Self.marketplacePolicyStatusLabel(permissionMap.policyPreset))."
      switch app.slug {
      case "x":
        self.xConnectionStatus = status
        self.xSelectedConnectionId = install.connectionId ?? self.xSelectedConnectionId
      case "facebook-pages":
        self.facebookPagesConnectionStatus = status
        self.facebookPagesSelectedConnectionId =
          install.connectionId ?? self.facebookPagesSelectedConnectionId
      case "linkedin":
        self.linkedinConnectionStatus = status
      case "gmail":
        self.gmailConnectionStatus = status
        self.gmailSelectedConnectionId = install.connectionId ?? self.gmailSelectedConnectionId
      case "google-docs":
        self.googleDocsConnectionStatus = status
        self.googleDocsSelectedConnectionId =
          install.connectionId ?? self.googleDocsSelectedConnectionId
      case "google-calendar":
        self.googleCalendarConnectionStatus = status
        self.googleCalendarSelectedConnectionId =
          install.connectionId ?? self.googleCalendarSelectedConnectionId
      case "google-drive":
        self.googleDriveConnectionStatus = status
        self.googleDriveSelectedConnectionId =
          install.connectionId ?? self.googleDriveSelectedConnectionId
      case "google-sheets":
        self.googleSheetsConnectionStatus = status
        self.googleSheetsSelectedConnectionId =
          install.connectionId ?? self.googleSheetsSelectedConnectionId
      case "google-slides":
        self.googleSlidesConnectionStatus = status
        self.googleSlidesSelectedConnectionId =
          install.connectionId ?? self.googleSlidesSelectedConnectionId
      case "google-forms":
        self.googleFormsConnectionStatus = status
        self.googleFormsSelectedConnectionId =
          install.connectionId ?? self.googleFormsSelectedConnectionId
      case "google-tasks":
        self.googleTasksConnectionStatus = status
        self.googleTasksSelectedConnectionId =
          install.connectionId ?? self.googleTasksSelectedConnectionId
      case "google-contacts":
        self.googleContactsConnectionStatus = status
        self.googleContactsSelectedConnectionId =
          install.connectionId ?? self.googleContactsSelectedConnectionId
      case "google-photos":
        self.googlePhotosConnectionStatus = status
        self.googlePhotosSelectedConnectionId =
          install.connectionId ?? self.googlePhotosSelectedConnectionId
      case "google-meet":
        self.googleMeetConnectionStatus = status
        self.googleMeetSelectedConnectionId =
          install.connectionId ?? self.googleMeetSelectedConnectionId
      case "google-chat":
        self.googleChatConnectionStatus = status
        self.googleChatSelectedConnectionId =
          install.connectionId ?? self.googleChatSelectedConnectionId
      case "google-ads":
        self.googleAdsConnectionStatus = status
        self.googleAdsSelectedConnectionId =
          install.connectionId ?? self.googleAdsSelectedConnectionId
      case "google-search-console":
        self.googleSearchConsoleConnectionStatus = status
        self.googleSearchConsoleSelectedConnectionId =
          install.connectionId ?? self.googleSearchConsoleSelectedConnectionId
      case "google-analytics":
        self.googleAnalyticsConnectionStatus = status
        self.googleAnalyticsSelectedConnectionId =
          install.connectionId ?? self.googleAnalyticsSelectedConnectionId
      case "posthog":
        self.postHogConnectionStatus = status
        self.postHogSelectedConnectionId = install.connectionId ?? self.postHogSelectedConnectionId
      case "sentry":
        self.sentryConnectionStatus = status
        self.sentrySelectedConnectionId = install.connectionId ?? self.sentrySelectedConnectionId
      case "datadog":
        self.datadogConnectionStatus = status
        self.datadogSelectedConnectionId = install.connectionId ?? self.datadogSelectedConnectionId
      case "pagerduty":
        self.pagerDutyConnectionStatus = status
        self.pagerDutySelectedConnectionId =
          install.connectionId ?? self.pagerDutySelectedConnectionId
      case "cloudflare":
        self.cloudflareConnectionStatus = status
        self.cloudflareSelectedConnectionId =
          install.connectionId ?? self.cloudflareSelectedConnectionId
      case "vercel":
        self.vercelConnectionStatus = status
        self.vercelSelectedConnectionId = install.connectionId ?? self.vercelSelectedConnectionId
      case "heroku":
        self.herokuConnectionStatus = status
        self.herokuSelectedConnectionId = install.connectionId ?? self.herokuSelectedConnectionId
      case "digitalocean":
        self.digitalOceanConnectionStatus = status
        self.digitalOceanSelectedConnectionId =
          install.connectionId ?? self.digitalOceanSelectedConnectionId
      case "firebase":
        self.firebaseConnectionStatus = status
        self.firebaseSelectedConnectionId =
          install.connectionId ?? self.firebaseSelectedConnectionId
      case "supabase":
        self.supabaseConnectionStatus = status
        self.supabaseSelectedConnectionId =
          install.connectionId ?? self.supabaseSelectedConnectionId
      case "okta":
        self.oktaConnectionStatus = status
        self.oktaSelectedConnectionId = install.connectionId ?? self.oktaSelectedConnectionId
      case "bamboohr":
        self.bambooHRConnectionStatus = status
        self.bambooHRSelectedConnectionId =
          install.connectionId ?? self.bambooHRSelectedConnectionId
      case "greenhouse":
        self.greenhouseConnectionStatus = status
        self.greenhouseSelectedConnectionId =
          install.connectionId ?? self.greenhouseSelectedConnectionId
      case "lever":
        self.leverConnectionStatus = status
        self.leverSelectedConnectionId = install.connectionId ?? self.leverSelectedConnectionId
      case "notion":
        self.notionConnectionStatus = status
        self.notionSelectedConnectionId = install.connectionId ?? self.notionSelectedConnectionId
      case "slack":
        self.slackConnectionStatus = status
        self.slackSelectedConnectionId = install.connectionId ?? self.slackSelectedConnectionId
      case "github":
        self.githubConnectionStatus = status
        self.githubSelectedConnectionId = install.connectionId ?? self.githubSelectedConnectionId
      case "gitlab":
        self.gitLabConnectionStatus = status
        self.gitLabSelectedConnectionId = install.connectionId ?? self.gitLabSelectedConnectionId
      case "bitbucket":
        self.bitbucketConnectionStatus = status
        self.bitbucketSelectedConnectionId =
          install.connectionId ?? self.bitbucketSelectedConnectionId
      case "linear":
        self.linearConnectionStatus = status
        self.linearSelectedConnectionId = install.connectionId ?? self.linearSelectedConnectionId
      case "asana":
        self.asanaConnectionStatus = status
        self.asanaSelectedConnectionId = install.connectionId ?? self.asanaSelectedConnectionId
      case "trello":
        self.trelloConnectionStatus = status
        self.trelloSelectedConnectionId = install.connectionId ?? self.trelloSelectedConnectionId
      case "clickup":
        self.clickUpConnectionStatus = status
        self.clickUpSelectedConnectionId = install.connectionId ?? self.clickUpSelectedConnectionId
      case "monday-com":
        self.mondayConnectionStatus = status
        self.mondaySelectedConnectionId = install.connectionId ?? self.mondaySelectedConnectionId
      case "airtable":
        self.airtableConnectionStatus = status
        self.airtableSelectedConnectionId =
          install.connectionId ?? self.airtableSelectedConnectionId
      case "dropbox":
        self.dropboxConnectionStatus = status
        self.dropboxSelectedConnectionId = install.connectionId ?? self.dropboxSelectedConnectionId
      case "box":
        self.boxConnectionStatus = status
        self.boxSelectedConnectionId = install.connectionId ?? self.boxSelectedConnectionId
      case "figma":
        self.figmaConnectionStatus = status
        self.figmaSelectedConnectionId = install.connectionId ?? self.figmaSelectedConnectionId
      case "miro":
        self.miroConnectionStatus = status
        self.miroSelectedConnectionId = install.connectionId ?? self.miroSelectedConnectionId
      case "canva":
        self.canvaConnectionStatus = status
        self.canvaSelectedConnectionId = install.connectionId ?? self.canvaSelectedConnectionId
      case "webflow":
        self.webflowConnectionStatus = status
        self.webflowSelectedConnectionId = install.connectionId ?? self.webflowSelectedConnectionId
      case "wordpress-com":
        self.wordpressComConnectionStatus = status
        self.wordpressComSelectedConnectionId =
          install.connectionId ?? self.wordpressComSelectedConnectionId
      case "contentful":
        self.contentfulConnectionStatus = status
        self.contentfulSelectedConnectionId =
          install.connectionId ?? self.contentfulSelectedConnectionId
      case "shopify":
        self.shopifyConnectionStatus = status
        self.shopifySelectedConnectionId = install.connectionId ?? self.shopifySelectedConnectionId
      case "woocommerce":
        self.wooCommerceConnectionStatus = status
        self.wooCommerceSelectedConnectionId =
          install.connectionId ?? self.wooCommerceSelectedConnectionId
      case "stripe":
        self.stripeConnectionStatus = status
        self.stripeSelectedConnectionId = install.connectionId ?? self.stripeSelectedConnectionId
      case "xero":
        self.xeroConnectionStatus = status
        self.xeroSelectedConnectionId = install.connectionId ?? self.xeroSelectedConnectionId
      case "quickbooks":
        self.quickBooksConnectionStatus = status
        self.quickBooksSelectedConnectionId =
          install.connectionId ?? self.quickBooksSelectedConnectionId
      case "freshbooks":
        self.freshBooksConnectionStatus = status
        self.freshBooksSelectedConnectionId =
          install.connectionId ?? self.freshBooksSelectedConnectionId
      case "wave":
        self.waveConnectionStatus = status
        self.waveSelectedConnectionId = install.connectionId ?? self.waveSelectedConnectionId
      case "freeagent":
        self.freeAgentConnectionStatus = status
        self.freeAgentSelectedConnectionId =
          install.connectionId ?? self.freeAgentSelectedConnectionId
      case "salesforce":
        self.salesforceConnectionStatus = status
        self.salesforceSelectedConnectionId =
          install.connectionId ?? self.salesforceSelectedConnectionId
      case "hubspot":
        self.hubSpotConnectionStatus = status
        self.hubSpotSelectedConnectionId = install.connectionId ?? self.hubSpotSelectedConnectionId
      case "pipedrive":
        self.pipedriveConnectionStatus = status
        self.pipedriveSelectedConnectionId =
          install.connectionId ?? self.pipedriveSelectedConnectionId
      case "copper":
        self.copperConnectionStatus = status
        self.copperSelectedConnectionId = install.connectionId ?? self.copperSelectedConnectionId
      case "close":
        self.closeConnectionStatus = status
        self.closeSelectedConnectionId = install.connectionId ?? self.closeSelectedConnectionId
      case "zendesk":
        self.zendeskConnectionStatus = status
        self.zendeskSelectedConnectionId = install.connectionId ?? self.zendeskSelectedConnectionId
      case "intercom":
        self.intercomConnectionStatus = status
        self.intercomSelectedConnectionId =
          install.connectionId ?? self.intercomSelectedConnectionId
      case "help-scout":
        self.helpScoutConnectionStatus = status
        self.helpScoutSelectedConnectionId =
          install.connectionId ?? self.helpScoutSelectedConnectionId
      case "front":
        self.frontConnectionStatus = status
        self.frontSelectedConnectionId = install.connectionId ?? self.frontSelectedConnectionId
      case "groove":
        self.grooveConnectionStatus = status
        self.grooveSelectedConnectionId = install.connectionId ?? self.grooveSelectedConnectionId
      case "teamwork":
        self.teamworkConnectionStatus = status
        self.teamworkSelectedConnectionId =
          install.connectionId ?? self.teamworkSelectedConnectionId
      case "basecamp":
        self.basecampConnectionStatus = status
        self.basecampSelectedConnectionId =
          install.connectionId ?? self.basecampSelectedConnectionId
      case "wrike":
        self.wrikeConnectionStatus = status
        self.wrikeSelectedConnectionId = install.connectionId ?? self.wrikeSelectedConnectionId
      case "smartsheet":
        self.smartsheetConnectionStatus = status
        self.smartsheetSelectedConnectionId =
          install.connectionId ?? self.smartsheetSelectedConnectionId
      case "todoist":
        self.todoistConnectionStatus = status
        self.todoistSelectedConnectionId = install.connectionId ?? self.todoistSelectedConnectionId
      case "harvest":
        self.harvestConnectionStatus = status
        self.harvestSelectedConnectionId = install.connectionId ?? self.harvestSelectedConnectionId
      case "calendly":
        self.calendlyConnectionStatus = status
        self.calendlySelectedConnectionId =
          install.connectionId ?? self.calendlySelectedConnectionId
      case "cal-com":
        self.calComConnectionStatus = status
        self.calComSelectedConnectionId = install.connectionId ?? self.calComSelectedConnectionId
      case "docusign":
        self.docusignConnectionStatus = status
        self.docusignSelectedConnectionId =
          install.connectionId ?? self.docusignSelectedConnectionId
      case "dropbox-sign":
        self.dropboxSignConnectionStatus = status
        self.dropboxSignSelectedConnectionId =
          install.connectionId ?? self.dropboxSignSelectedConnectionId
      case "pandadoc":
        self.pandaDocConnectionStatus = status
        self.pandaDocSelectedConnectionId =
          install.connectionId ?? self.pandaDocSelectedConnectionId
      case "typeform":
        self.typeformConnectionStatus = status
        self.typeformSelectedConnectionId =
          install.connectionId ?? self.typeformSelectedConnectionId
      case "surveymonkey":
        self.surveyMonkeyConnectionStatus = status
        self.surveyMonkeySelectedConnectionId =
          install.connectionId ?? self.surveyMonkeySelectedConnectionId
      case "fillout":
        self.filloutConnectionStatus = status
        self.filloutSelectedConnectionId = install.connectionId ?? self.filloutSelectedConnectionId
      case "mailchimp":
        self.mailchimpConnectionStatus = status
        self.mailchimpSelectedConnectionId =
          install.connectionId ?? self.mailchimpSelectedConnectionId
      case "klaviyo":
        self.klaviyoConnectionStatus = status
        self.klaviyoSelectedConnectionId = install.connectionId ?? self.klaviyoSelectedConnectionId
      case "convertkit":
        self.convertKitConnectionStatus = status
        self.convertKitSelectedConnectionId =
          install.connectionId ?? self.convertKitSelectedConnectionId
      case "campaign-monitor":
        self.campaignMonitorConnectionStatus = status
        self.campaignMonitorSelectedConnectionId =
          install.connectionId ?? self.campaignMonitorSelectedConnectionId
      case "constant-contact":
        self.constantContactConnectionStatus = status
        self.constantContactSelectedConnectionId =
          install.connectionId ?? self.constantContactSelectedConnectionId
      case "microsoft-clarity":
        self.microsoftClarityConnectionStatus = status
        self.microsoftClaritySelectedConnectionId =
          install.connectionId ?? self.microsoftClaritySelectedConnectionId
      case "telemetrydeck":
        self.telemetryDeckConnectionStatus = status
        self.telemetryDeckSelectedConnectionId =
          install.connectionId ?? self.telemetryDeckSelectedConnectionId
      case "exa-search":
        self.exaConnectionStatus = status
        self.exaSelectedConnectionId = install.connectionId ?? self.exaSelectedConnectionId
      default:
        break
      }
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func providerSetupNote(for app: MarketplaceCatalogApp, callbackURL: String) -> String {
    return
      "\(app.name) requires user-owned developer credentials before OAuth authorization can complete. Store secrets through Keychain-backed secret references."
  }

  func selectExaAPIConnection(_ connectionId: RelayId) {
    exaSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func saveExaRailwayConnection(
    for app: MarketplaceCatalogApp,
    apiKey: String,
    displayName: String? = nil
  ) async throws -> MarketplaceProviderConnection {
    guard app.slug == "exa-search", let services, let workspace else {
      throw RelayError(.workspaceMissing, "The Railway workspace is unavailable.")
    }
    let trimmedKey = try requireNonEmptyString(apiKey, field: "Exa API key", maxLength: 10000)
    let response = try await services.cloudSync.railwayMarketplaceRequest(
      localWorkspaceId: workspace.id,
      method: "POST",
      relativePath: "connections",
      body: [
        "appSlug": app.slug,
        "displayName": displayName?.nilIfEmpty ?? "Exa Search",
        "authType": "api_key",
        "credentials": ["EXA_API_KEY": trimmedKey],
        "selectedCapabilities": app.capabilityIds ?? app.capabilities,
      ])
    return try services.cloudSync.mirrorRailwayMarketplaceConnection(
      localWorkspaceId: workspace.id,
      app: app,
      connectionView: response)
  }

  func testExaAPIKey(for app: MarketplaceCatalogApp) {
    guard app.slug == "exa-search" else { return }
    exaConnectionStatus =
      "Railway verifies the Exa API key when you save the connection. The macOS app does not send the key to Exa."
  }

  func addExaAPIConnection(for app: MarketplaceCatalogApp) {
    runAction("add-exa-api-connection", refresh: .applications) {
      guard app.slug == "exa-search" else { return self.selectedThreadId }
      guard self.services != nil, self.workspace != nil else {
        return self.selectedThreadId
      }
      let connectionName = self.exaAPIConnectionNameDraft.nilIfEmpty
      let trimmedKey = self.exaAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard connectionName != nil else {
        throw RelayError(.invalidInput, "Name the Exa API connection before adding it.")
      }
      guard !trimmedKey.isEmpty else {
        throw RelayError(.invalidInput, "Enter an Exa API key before adding a connection.")
      }
      self.exaConnectionStatus = "Sending \(connectionName ?? "Exa key") to Railway for verification."
      await Task.yield()
      let connection = try await self.saveExaRailwayConnection(
        for: app,
        apiKey: trimmedKey,
        displayName: connectionName
      )
      self.exaAPIConnectionNameDraft = ""
      self.exaAPIKeyDraft = ""
      self.exaSelectedConnectionId = connection.id
      self.exaConnectionStatus = "\(connection.accountLabel ?? "Exa key") added and ready."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func testExaAPIConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-exa-api-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "exa-search" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard connection.resolvedExecutionAuthority == .railway else {
        throw RelayError(
          .invalidInput,
          "This old Exa connection used the local Swift authority. Enter the API key again to create a Railway connection.")
      }
      self.exaSelectedConnectionId = connection.id
      self.exaConnectionStatus = "Asking Railway to test \(connection.accountLabel ?? "Exa key")."
      await Task.yield()
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "GET",
        relativePath: "connectors/exa-search/connections/\(connection.id)/health"
      )
      if (response["status"] as? String) == "ready" {
        self.exaSelectedConnectionId = connection.id
      } else {
        self.exaSelectedConnectionId =
          self.providerConnectionSnapshot?.connections.first {
            $0.id != connection.id && $0.status == .connected && $0.health.state == .ready
          }?.id ?? ""
      }
      self.exaConnectionStatus =
        "\(connection.accountLabel ?? "Exa key"): \((response["message"] as? String) ?? "Railway health check complete.")"
      return self.selectedThreadId
    }
  }

  func deleteExaAPIConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-exa-api-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "exa-search" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard connection.resolvedExecutionAuthority == .railway else {
        throw RelayError(
          .invalidInput,
          "This old Exa connection is not active on Railway. Enter the API key again to replace it.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.connectionId == connection.id && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        let agent = try? services.data.getAgent(install.agentId)
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        if let agent {
          self.recordUserManagedRuntimeRestartRequired(
            services: services, agent: agent, reason: "Exa Search connection changed")
        }
      }
      let deleted = try await services.cloudSync.disconnectRailwayMarketplaceOAuthConnection(
        localWorkspaceId: workspace.id, app: app, connectionId: connection.id)
      self.exaSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.exaConnectionStatus = "\(deleted.accountLabel ?? "Exa key") deleted.\(disconnectedText)"
      return self.selectedThreadId
    }
  }

  func setExaAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-exa-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "exa-search" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(.invalidInput, "Select an Exa API connection before assigning agents.")
      }
      guard connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Test or replace this Exa API connection before assigning agents.")
      }
      let displayName = self.exaDisplayName(forAgentId: agentId)
      guard connection.resolvedExecutionAuthority == .railway else {
        throw RelayError(
          .invalidInput,
          "Reconnect Exa Search so Railway can store the credential before assigning agents."
        )
      }
      let agent = try services.data.getAgent(agentId)
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id,
        localConnectionId: connection.id
      )
      if enabled {
        if self.activeExaInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeExaInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another Exa API connection.")
        }
        self.exaConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Exa key")."
        await Task.yield()
        await self.refreshSetupBridgeStatus()
        guard self.marketplaceRuntimeIsOnline(agent.binding.runtimeType) else {
          throw RelayError(
            .unsupported,
            "\(exaRuntimeLabel(agent.binding.runtimeType)) Remote Access is not connected. Railway cannot assign Exa Search until this runtime is online."
          )
        }
        let prepared = try await self.prepareExaAgentForInstall(
          services: services, agentId: agentId)
        let remoteAgentId = try services.cloudSync.remoteMarketplaceAgentId(
          localWorkspaceId: workspace.id,
          localAgentId: prepared.id
        )
        let result = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "POST",
          relativePath: "install",
          body: [
            "appSlug": app.slug,
            "connectionId": remoteConnectionId,
            "selectedCapabilities": app.capabilityIds ?? app.capabilities,
            "runtimeFormat": prepared.binding.runtimeType.rawValue,
            "agentIds": [remoteAgentId],
            "role": app.roleManifest.primaryRole,
            "libraryTargetFolder": "marketplace/\(app.slug)",
            "targetMode": "existing_agents",
            "acknowledgeGeneratedDraftRisk": true,
          ]
        )
        guard (result["status"] as? String) == "installed" else {
          throw RelayError(
            .unsupported,
            (result["message"] as? String)
              ?? "Railway could not install Exa Search for \(displayName)."
          )
        }
        self.recordUserManagedRuntimeRestartRequired(
          services: services, agent: prepared, reason: "Exa Search connection changed")
        self.exaConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Exa key")."
      } else {
        guard let install = self.activeExaInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.exaConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Exa key")."
        await Task.yield()
        _ = try await services.cloudSync.railwayMarketplaceRequest(
          localWorkspaceId: workspace.id,
          method: "DELETE",
          relativePath: "installs/\(install.id)"
        )
        self.recordUserManagedRuntimeRestartRequired(
          services: services, agent: agent, reason: "Exa Search connection changed")
        self.exaConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Exa key")."
      }
      let remoteInstalls = try await services.cloudSync.railwayMarketplaceArrayRequest(
        localWorkspaceId: workspace.id,
        relativePath: "installs"
      )
      _ = try services.cloudSync.mirrorRailwayMarketplaceInstalls(
        localWorkspaceId: workspace.id,
        app: app,
        installViews: remoteInstalls
      )
      self.exaSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
}
