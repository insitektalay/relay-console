import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func selectGmailConnection(_ connectionId: RelayId) {
    gmailSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func deleteGmailOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-gmail-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "gmail" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "gmail" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.gmailSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.gmailConnectionStatus =
        "\(deleted.accountLabel ?? "Gmail OAuth account") deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setGmailAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-gmail-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "gmail" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(
          .invalidInput, "Complete verified Gmail authorization before assigning agents.")
      }
      guard connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Select a verified connected Gmail OAuth account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.gmailDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeGmailInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeGmailInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another Gmail connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.gmailConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Gmail OAuth account")."
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
              "source": .string("applications-gmail-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-email-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.gmailConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Gmail OAuth account")."
      } else {
        guard let install = self.activeGmailInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.gmailConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Gmail OAuth account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.gmailConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Gmail OAuth account")."
      }
      self.gmailSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveGoogleDocsOAuthCredentials(for app: MarketplaceCatalogApp) {
    runAction("save-google-docs-oauth-credentials", refresh: .applications) {
      guard app.slug == "google-docs" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let connection = try services.providerConnections.saveGoogleDocsOAuthCredentials(
        context: self.chatContext(workspaceId: workspace.id),
        appIdOrSlug: app.id,
        clientId: self.googleDocsClientIdDraft,
        clientSecret: self.googleDocsClientSecretDraft,
        refreshToken: self.googleDocsRefreshTokenDraft,
        accessToken: self.googleDocsAccessTokenDraft.nilIfEmpty,
        accountEmail: self.googleDocsAccountEmailDraft.nilIfEmpty,
        projectId: self.googleDocsProjectIdDraft.nilIfEmpty,
        displayName: self.googleDocsConnectionNameDraft.nilIfEmpty
      )
      self.googleDocsConnectionNameDraft = ""
      self.googleDocsClientIdDraft = ""
      self.googleDocsClientSecretDraft = ""
      self.googleDocsRefreshTokenDraft = ""
      self.googleDocsAccessTokenDraft = ""
      self.googleDocsAccountEmailDraft = ""
      self.googleDocsProjectIdDraft = ""
      self.googleDocsSelectedConnectionId = connection.id
      self.googleDocsConnectionStatus =
        "\(connection.accountLabel ?? "Google Docs OAuth account") saved. No Relay-owned Google app or web callback is used."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleDocsOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-docs-oauth", refresh: .applications) {
      guard app.slug == "google-docs" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil else {
        throw RelayError(
          .unsupported,
          "Google Docs is not enabled because the Relay-owned Google OAuth client is not configured."
        )
      }
      guard let railwayOrigin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        railwayOrigin.lowercased().hasPrefix("https://")
      else {
        throw RelayError(.unsupported, "Google Docs must use the authenticated Railway broker.")
      }
      throw RelayError(
        .unsupported,
        "Google Docs authorization, offline refresh, revocation, account discovery, and document-target binding are not deployed on Railway yet."
      )
    }
  }

  static func formEncode(_ value: String) -> String {
    var allowed = CharacterSet.urlQueryAllowed
    allowed.remove(charactersIn: "&+=?")
    return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
  }

  func selectGoogleDocsConnection(_ connectionId: RelayId) {
    googleDocsSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func testGoogleDocsConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-google-docs-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-docs" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      self.googleDocsSelectedConnectionId = connection.id
      self.googleDocsConnectionStatus =
        "Testing \(connection.accountLabel ?? "Google Docs OAuth account")."
      await Task.yield()
      let updated = try await services.providerConnections.validateSavedGoogleDocsConnection(
        context: self.chatContext(workspaceId: workspace.id),
        connectionId: connection.id
      )
      if updated.status == .connected && updated.health.state == .ready {
        self.googleDocsSelectedConnectionId = updated.id
      } else {
        self.googleDocsSelectedConnectionId =
          self.providerConnectionSnapshot?.connections.first {
            $0.id != updated.id && $0.status == .connected && $0.health.state == .ready
          }?.id ?? ""
      }
      self.googleDocsConnectionStatus =
        "\(updated.accountLabel ?? "Google Docs OAuth account"): \(updated.health.message)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteGoogleDocsOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-docs-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-docs" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-docs" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleDocsSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.googleDocsConnectionStatus =
        "\(deleted.accountLabel ?? "Google Docs OAuth account") deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setGoogleDocsAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-docs-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-docs" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(
          .invalidInput, "Save Google Docs OAuth credentials before assigning agents.")
      }
      guard connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Save a connected Google Docs OAuth account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.googleDocsDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeGoogleDocsInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeGoogleDocsInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another Google Docs connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.googleDocsConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Google Docs OAuth account")."
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
              "source": .string("applications-google-docs-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-document-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.googleDocsConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Google Docs OAuth account")."
      } else {
        guard
          let install = self.activeGoogleDocsInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.googleDocsConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Google Docs OAuth account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.googleDocsConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Google Docs OAuth account")."
      }
      self.googleDocsSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveGoogleCalendarOAuthCredentials(for app: MarketplaceCatalogApp) {
    runAction("save-google-calendar-oauth-credentials", refresh: .applications) {
      guard app.slug == "google-calendar" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let connection = try services.providerConnections.saveGoogleCalendarOAuthCredentials(
        context: self.chatContext(workspaceId: workspace.id),
        appIdOrSlug: app.id,
        clientId: self.googleCalendarClientIdDraft,
        clientSecret: self.googleCalendarClientSecretDraft,
        refreshToken: self.googleCalendarRefreshTokenDraft,
        accessToken: self.googleCalendarAccessTokenDraft.nilIfEmpty,
        accountEmail: self.googleCalendarAccountEmailDraft.nilIfEmpty,
        defaultCalendarId: self.googleCalendarDefaultCalendarIdDraft.nilIfEmpty,
        displayName: self.googleCalendarConnectionNameDraft.nilIfEmpty
      )
      self.googleCalendarConnectionNameDraft = ""
      self.googleCalendarClientIdDraft = ""
      self.googleCalendarClientSecretDraft = ""
      self.googleCalendarRefreshTokenDraft = ""
      self.googleCalendarAccessTokenDraft = ""
      self.googleCalendarAccountEmailDraft = ""
      self.googleCalendarDefaultCalendarIdDraft = "primary"
      self.googleCalendarSelectedConnectionId = connection.id
      self.googleCalendarConnectionStatus =
        "\(connection.accountLabel ?? "Google Calendar OAuth account") saved. No Relay-owned Google app or web callback is used."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleCalendarOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-calendar-oauth", refresh: .applications) {
      guard app.slug == "google-calendar" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil else {
        throw RelayError(
          .unsupported,
          "Google Calendar is not enabled because the Relay-owned Google OAuth client is not configured."
        )
      }
      guard let railwayOrigin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        railwayOrigin.lowercased().hasPrefix("https://")
      else {
        throw RelayError(
          .unsupported, "Google Calendar must use the authenticated Railway broker.")
      }
      throw RelayError(
        .unsupported,
        "Google Calendar authorization, offline refresh, revocation, account discovery, and default Calendar selection are not deployed on Railway yet."
      )
    }
  }

  func selectGoogleCalendarConnection(_ connectionId: RelayId) {
    googleCalendarSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func testGoogleCalendarConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-google-calendar-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-calendar" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      self.googleCalendarSelectedConnectionId = connection.id
      self.googleCalendarConnectionStatus =
        "Testing \(connection.accountLabel ?? "Google Calendar OAuth account")."
      await Task.yield()
      let updated = try await services.providerConnections.validateSavedGoogleCalendarConnection(
        context: self.chatContext(workspaceId: workspace.id),
        connectionId: connection.id
      )
      if updated.status == .connected && updated.health.state == .ready {
        self.googleCalendarSelectedConnectionId = updated.id
      } else {
        self.googleCalendarSelectedConnectionId =
          self.providerConnectionSnapshot?.connections.first {
            $0.id != updated.id && $0.status == .connected && $0.health.state == .ready
          }?.id ?? ""
      }
      self.googleCalendarConnectionStatus =
        "\(updated.accountLabel ?? "Google Calendar OAuth account"): \(updated.health.message)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteGoogleCalendarOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-calendar-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-calendar" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-calendar" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleCalendarSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.googleCalendarConnectionStatus =
        "\(deleted.accountLabel ?? "Google Calendar OAuth account") deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setGoogleCalendarAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-calendar-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-calendar" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(
          .invalidInput, "Save Google Calendar OAuth credentials before assigning agents.")
      }
      guard connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Save a connected Google Calendar OAuth account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.googleCalendarDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeGoogleCalendarInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeGoogleCalendarInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput,
            "\(displayName) is already assigned to another Google Calendar connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.googleCalendarConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Google Calendar OAuth account")."
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
              "source": .string("applications-google-calendar-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-calendar-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.googleCalendarConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Google Calendar OAuth account")."
      } else {
        guard
          let install = self.activeGoogleCalendarInstall(
            agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.googleCalendarConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Google Calendar OAuth account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.googleCalendarConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Google Calendar OAuth account")."
      }
      self.googleCalendarSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveGoogleDriveOAuthCredentials(for app: MarketplaceCatalogApp) {
    runAction("save-google-drive-oauth-credentials", refresh: .applications) {
      guard app.slug == "google-drive" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let connection = try services.providerConnections.saveGoogleDriveOAuthCredentials(
        context: self.chatContext(workspaceId: workspace.id),
        appIdOrSlug: app.id,
        clientId: self.googleDriveClientIdDraft,
        clientSecret: self.googleDriveClientSecretDraft,
        refreshToken: self.googleDriveRefreshTokenDraft,
        accessToken: self.googleDriveAccessTokenDraft.nilIfEmpty,
        accountEmail: self.googleDriveAccountEmailDraft.nilIfEmpty,
        displayName: self.googleDriveConnectionNameDraft.nilIfEmpty
      )
      self.googleDriveConnectionNameDraft = ""
      self.googleDriveClientIdDraft = ""
      self.googleDriveClientSecretDraft = ""
      self.googleDriveRefreshTokenDraft = ""
      self.googleDriveAccessTokenDraft = ""
      self.googleDriveAccountEmailDraft = ""
      self.googleDriveSelectedConnectionId = connection.id
      self.googleDriveConnectionStatus =
        "\(connection.accountLabel ?? "Google Drive OAuth account") saved. No Relay-owned Google app or web callback is used."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleDriveOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-drive-oauth", refresh: .applications) {
      guard app.slug == "google-drive" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil else {
        throw RelayError(
          .unsupported,
          "Google Drive is not enabled because the Relay-owned Google OAuth client is not configured."
        )
      }
      guard let railwayOrigin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        railwayOrigin.lowercased().hasPrefix("https://")
      else {
        throw RelayError(.unsupported, "Google Drive must use the authenticated Railway broker.")
      }
      throw RelayError(
        .unsupported,
        "Google Drive authorization, offline refresh, revocation, account discovery, and app-visible file selection are not deployed on Railway yet."
      )
    }
  }

  func selectGoogleDriveConnection(_ connectionId: RelayId) {
    googleDriveSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func deleteGoogleDriveOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-drive-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-drive" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-drive" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleDriveSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.googleDriveConnectionStatus =
        "\(deleted.accountLabel ?? "Google Drive OAuth account") deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setGoogleDriveAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-drive-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-drive" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(
          .invalidInput, "Save Google Drive OAuth credentials before assigning agents.")
      }
      guard connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Save a connected Google Drive OAuth account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.googleDriveDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeGoogleDriveInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeGoogleDriveInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another Google Drive connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.googleDriveConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Google Drive OAuth account")."
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
              "source": .string("applications-google-drive-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-drive-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.googleDriveConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Google Drive OAuth account")."
      } else {
        guard
          let install = self.activeGoogleDriveInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.googleDriveConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Google Drive OAuth account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.googleDriveConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Google Drive OAuth account")."
      }
      self.googleDriveSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleSheetsOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-sheets-oauth", refresh: .applications) {
      guard app.slug == "google-sheets" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Sheets needs the Relay-owned Google OAuth client and authenticated Railway broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Google Sheets authorization, offline refresh, revocation, account binding, and app-visible spreadsheet selection are not deployed on Railway yet. The desktop will not handle Relay's client secret or exchange authorization codes."
      )
    }
  }

  func selectGoogleSheetsConnection(_ connectionId: RelayId) {
    googleSheetsSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func deleteGoogleSheetsOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-sheets-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-sheets" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-sheets" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleSheetsSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.googleSheetsConnectionStatus =
        "\(deleted.accountLabel ?? "Google Sheets OAuth account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setGoogleSheetsAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-sheets-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-sheets" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection,
        connection.appSlug == "google-sheets", connection.status == .connected,
        connection.grantedScopes == ProviderConnectionService.googleSheetsRelayOwnedOAuthScopes,
        connection.health.diagnostics["appVisibleSpreadsheetCorpusEnforced"]?.bool == true
      else {
        throw RelayError(
          .invalidInput,
          "Save a verified exact-scope Google Sheets OAuth connection before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "google-sheets"
          && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(
            .invalidInput, "This agent already uses another Google Sheets connection.")
        }
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: [
              "source": .string("applications-google-sheets-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-spreadsheet-provider"),
            ],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.googleSheetsConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Google Sheets OAuth account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.googleSheetsConnectionStatus = "Agent disconnected from Google Sheets."
      }
      self.googleSheetsSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleSlidesOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-slides-oauth", refresh: .applications) {
      guard app.slug == "google-slides" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Slides needs the Relay-owned Google OAuth client and authenticated Railway broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Google Slides authorization, offline refresh, revocation, account binding, and app-visible presentation selection are not deployed on Railway yet. The desktop will not handle Relay's client secret or exchange authorization codes."
      )
    }
  }
  func selectGoogleSlidesConnection(_ connectionId: RelayId) {
    googleSlidesSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteGoogleSlidesOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-slides-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-slides", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-slides" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleSlidesSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.googleSlidesConnectionStatus =
        "\(deleted.accountLabel ?? "Google Slides OAuth account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setGoogleSlidesAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-slides-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-slides", let services = self.services,
        let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == "google-slides",
        connection.status == .connected,
        connection.grantedScopes == ProviderConnectionService.googleSlidesRelayOwnedOAuthScopes,
        connection.health.diagnostics["appVisiblePresentationCorpusEnforced"]?.bool == true
      else {
        throw RelayError(
          .invalidInput,
          "Save a verified exact-scope Google Slides OAuth connection before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "google-slides"
          && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(
            .invalidInput, "This agent already uses another Google Slides connection.")
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
              "source": .string("applications-google-slides-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-presentation-provider"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.googleSlidesConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Google Slides OAuth account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.googleSlidesConnectionStatus = "Agent disconnected from Google Slides."
      }
      self.googleSlidesSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleFormsOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-forms-oauth", refresh: .applications) {
      guard app.slug == "google-forms" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Forms needs the Relay-owned Google OAuth client and authenticated Railway broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Google Forms authorization, offline refresh, revocation, account binding, and app-visible Form selection are not deployed on Railway yet. The desktop will not handle Relay's client secret or exchange authorization codes."
      )
    }
  }
  func selectGoogleFormsConnection(_ connectionId: RelayId) {
    googleFormsSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteGoogleFormsOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-forms-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-forms", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-forms" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleFormsSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.googleFormsConnectionStatus =
        "\(deleted.accountLabel ?? "Google Forms OAuth account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setGoogleFormsAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-forms-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-forms", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == "google-forms", connection.status == .connected,
        connection.grantedScopes == ProviderConnectionService.googleFormsRelayOwnedOAuthScopes,
        connection.health.diagnostics["appVisibleFormCorpusEnforced"]?.bool == true,
        connection.health.diagnostics["responsesAccessEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "Save a verified exact-scope response-disabled Google Forms OAuth connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "google-forms" && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(
            .invalidInput, "This agent already uses another Google Forms connection.")
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
              "source": .string("applications-google-forms-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string(
                "approval-gated-form-provider-responses-blocked"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.googleFormsConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Google Forms OAuth account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.googleFormsConnectionStatus = "Agent disconnected from Google Forms."
      }
      self.googleFormsSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleTasksOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-tasks-oauth", refresh: .applications) {
      guard app.slug == "google-tasks" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Tasks needs the Relay-owned Google OAuth client and authenticated Railway broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Google Tasks authorization, offline refresh, revocation, and account binding are not deployed on Railway yet. The desktop will not handle Relay's client secret or exchange authorization codes."
      )
    }
  }
  func selectGoogleTasksConnection(_ connectionId: RelayId) {
    googleTasksSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteGoogleTasksOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-tasks-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-tasks", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-tasks" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleTasksSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.googleTasksConnectionStatus =
        "\(deleted.accountLabel ?? "Google Tasks OAuth account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setGoogleTasksAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-tasks-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-tasks", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == "google-tasks", connection.status == .connected,
        connection.grantedScopes == ProviderConnectionService.googleTasksRelayOwnedOAuthScopes,
        connection.health.diagnostics["assignedTaskMutationEnabled"]?.bool == false,
        connection.health.diagnostics["destructiveActionsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "Save a verified exact-scope non-destructive Google Tasks OAuth connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "google-tasks" && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(
            .invalidInput, "This agent already uses another Google Tasks connection.")
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
              "source": .string("applications-google-tasks-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-non-destructive-task-provider"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.googleTasksConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Google Tasks OAuth account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.googleTasksConnectionStatus = "Agent disconnected from Google Tasks."
      }
      self.googleTasksSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleContactsOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-contacts-oauth", refresh: .applications) {
      guard app.slug == "google-contacts" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Contacts needs the Relay-owned Google OAuth client and authenticated Railway broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Google Contacts authorization, offline refresh, revocation, and account binding are not deployed on Railway yet. The desktop will not handle Relay's client secret or exchange authorization codes."
      )
    }
  }
  func selectGoogleContactsConnection(_ connectionId: RelayId) {
    googleContactsSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteGoogleContactsOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-contacts-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-contacts", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-contacts" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleContactsSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.googleContactsConnectionStatus =
        "\(deleted.accountLabel ?? "Google Contacts OAuth account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setGoogleContactsAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-contacts-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-contacts", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == "google-contacts", connection.status == .connected,
        connection.grantedScopes == ProviderConnectionService.googleContactsRelayOwnedOAuthScopes,
        connection.health.diagnostics["contactSourceOnly"]?.bool == true,
        connection.health.diagnostics["directoryAccessEnabled"]?.bool == false,
        connection.health.diagnostics["otherContactsAccessEnabled"]?.bool == false,
        connection.health.diagnostics["broadPersonalFieldsEnabled"]?.bool == false,
        connection.health.diagnostics["destructiveActionsEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "Save a verified exact-scope privacy-bounded Google Contacts OAuth connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "google-contacts"
          && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(
            .invalidInput, "This agent already uses another Google Contacts connection.")
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
              "source": .string("applications-google-contacts-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string(
                "approval-gated-privacy-bounded-contact-provider"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.googleContactsConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Google Contacts OAuth account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.googleContactsConnectionStatus = "Agent disconnected from Google Contacts."
      }
      self.googleContactsSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGooglePhotosOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-photos-oauth", refresh: .applications) {
      guard app.slug == "google-photos" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Photos needs the Relay-owned Google OAuth client and authenticated Railway broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Google Photos Picker authorization, offline refresh, revocation, account binding, and in-context consent disclosure are not deployed on Railway yet. The desktop will not handle Relay's client secret or exchange authorization codes."
      )
    }
  }
  func selectGooglePhotosConnection(_ connectionId: RelayId) {
    googlePhotosSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteGooglePhotosOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-photos-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-photos", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-photos" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googlePhotosSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.googlePhotosConnectionStatus =
        "\(deleted.accountLabel ?? "Google Photos OAuth account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setGooglePhotosAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-photos-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-photos", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == "google-photos", connection.status == .connected,
        connection.grantedScopes == ProviderConnectionService.googlePhotosRelayOwnedOAuthScopes,
        connection.health.diagnostics["pickerOnly"]?.bool == true,
        connection.health.diagnostics["userSelectionRequired"]?.bool == true,
        connection.health.diagnostics["libraryAPIEnabled"]?.bool == false,
        connection.health.diagnostics["removedLibraryScopesEnabled"]?.bool == false,
        connection.health.diagnostics["rawMediaBytesEnabled"]?.bool == false,
        connection.health.diagnostics["baseURLReturnedToAgents"]?.bool == false,
        connection.health.diagnostics["automaticPolling"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "Save a verified exact-scope Picker-only Google Photos OAuth connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "google-photos"
          && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(
            .invalidInput, "This agent already uses another Google Photos connection.")
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
              "source": .string("applications-google-photos-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string(
                "approval-gated-user-controlled-picker-sessions"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.googlePhotosConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Google Photos OAuth account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.googlePhotosConnectionStatus = "Agent disconnected from Google Photos."
      }
      self.googlePhotosSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleMeetOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-meet-oauth", refresh: .applications) {
      guard app.slug == "google-meet" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Meet needs the Relay-owned Google OAuth client and authenticated Railway broker.")
      }
      throw RelayError(
        .unsupported,
        "Google Meet authorization, offline refresh, revocation, and app-created Space account binding are not deployed on Railway yet. The desktop will not handle Relay's client secret or exchange authorization codes."
      )
    }
  }
  func selectGoogleMeetConnection(_ connectionId: RelayId) {
    googleMeetSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteGoogleMeetOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-meet-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-meet", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-meet" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleMeetSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.googleMeetConnectionStatus =
        "\(deleted.accountLabel ?? "Google Meet OAuth account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setGoogleMeetAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-meet-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-meet", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == "google-meet",
        connection.status == .connected,
        connection.grantedScopes == ProviderConnectionService.googleMeetRelayOwnedOAuthScopes,
        connection.health.diagnostics["appCreatedSpacesOnly"]?.bool == true,
        connection.health.diagnostics["broadSpaceAccessEnabled"]?.bool == false,
        connection.health.diagnostics["participantsAccessEnabled"]?.bool == false,
        connection.health.diagnostics["conferenceRecordsAccessEnabled"]?.bool == false,
        connection.health.diagnostics["recordingsTranscriptsSmartNotesEnabled"]?.bool == false,
        connection.health.diagnostics["driveArtifactsEnabled"]?.bool == false,
        connection.health.diagnostics["dialInSipReturned"]?.bool == false,
        connection.health.diagnostics["endConferenceEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["domainDelegationEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "Save a verified exact-scope app-created-Space Google Meet OAuth connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "google-meet" && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(.invalidInput, "This agent already uses another Google Meet connection.")
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
              "source": .string("applications-google-meet-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string(
                "approval-gated-safe-app-created-space-provider"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.googleMeetConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Google Meet OAuth account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.googleMeetConnectionStatus = "Agent disconnected from Google Meet."
      }
      self.googleMeetSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleChatOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-chat-oauth", refresh: .applications) {
      guard app.slug == "google-chat" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Chat needs the Relay-owned Google OAuth client and authenticated Railway broker.")
      }
      throw RelayError(
        .unsupported,
        "Google Chat authorization, offline refresh, revocation, and user-account binding are not deployed on Railway yet. The desktop will not handle Relay's client secret or exchange authorization codes."
      )
    }
  }
  func selectGoogleChatConnection(_ connectionId: RelayId) {
    googleChatSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteGoogleChatOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-chat-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-chat", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-chat" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleChatSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == "google-chat"
        }?.id ?? ""
      self.googleChatConnectionStatus =
        "\(deleted.accountLabel ?? "Google Chat OAuth account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setGoogleChatAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-chat-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-chat", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == "google-chat",
        connection.status == .connected,
        connection.grantedScopes == ProviderConnectionService.googleChatRelayOwnedOAuthScopes,
        connection.health.diagnostics["userAuthOnly"]?.bool == true,
        connection.health.diagnostics["explicitSpacesOnly"]?.bool == true,
        connection.health.diagnostics["spaceDiscoveryEnabled"]?.bool == false,
        connection.health.diagnostics["membershipsEnabled"]?.bool == false,
        connection.health.diagnostics["adminAccessEnabled"]?.bool == false,
        connection.health.diagnostics["appBotAuthEnabled"]?.bool == false,
        connection.health.diagnostics["importModeEnabled"]?.bool == false,
        connection.health.diagnostics["privateMessagesEnabled"]?.bool == false,
        connection.health.diagnostics["attachmentsMediaEnabled"]?.bool == false,
        connection.health.diagnostics["reactionsEnabled"]?.bool == false,
        connection.health.diagnostics["messageMutationExceptCreateEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["domainDelegationEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "Save a verified exact-scope user-auth Google Chat connection before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "google-chat" && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(.invalidInput, "This agent already uses another Google Chat connection.")
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
              "source": .string("applications-google-chat-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string(
                "approval-gated-explicit-space-plain-text-messaging"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.googleChatConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Google Chat OAuth account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.googleChatConnectionStatus = "Agent disconnected from Google Chat."
      }
      self.googleChatSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleAdsOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-ads-oauth", refresh: .applications) {
      guard app.slug == "google-ads" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        environment["RELAY_GOOGLE_ADS_DEVELOPER_TOKEN"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Ads needs Relay-owned Google OAuth, an approved reporting developer token, and the authenticated Railway broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Google Ads authorization, offline refresh, developer-token binding, customer selection, revocation, and reporting-permissible-use verification are not deployed on Railway yet. The desktop will not handle Relay secrets or exchange authorization codes."
      )
    }
  }
  func selectGoogleAdsConnection(_ connectionId: RelayId) {
    googleAdsSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteGoogleAdsOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-ads-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-ads", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-ads" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleAdsSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == "google-ads"
        }?.id ?? ""
      self.googleAdsConnectionStatus =
        "\(deleted.accountLabel ?? "Google Ads reporting connection") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setGoogleAdsAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-ads-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-ads", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == "google-ads",
        connection.status == .connected,
        connection.grantedScopes == ProviderConnectionService.googleAdsRelayOwnedOAuthScopes,
        connection.health.diagnostics["permissibleUse"]?.string == "reporting",
        connection.health.diagnostics["explicitCustomerOnly"]?.bool == true,
        connection.health.diagnostics["arbitraryGAQLEnabled"]?.bool == false,
        connection.health.diagnostics["searchStreamEnabled"]?.bool == false,
        connection.health.diagnostics["accountDiscoveryEnabled"]?.bool == false,
        connection.health.diagnostics["mutationsEnabled"]?.bool == false,
        connection.health.diagnostics["planningRecommendationsEnabled"]?.bool == false,
        connection.health.diagnostics["audiencesCustomerMatchEnabled"]?.bool == false,
        connection.health.diagnostics["searchTermsClickDataEnabled"]?.bool == false,
        connection.health.diagnostics["offlineConversionsEnabled"]?.bool == false,
        connection.health.diagnostics["billingAccessEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["serviceAccountEnabled"]?.bool == false,
        connection.health.diagnostics["domainDelegationEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "Save a verified reporting-only Google Ads connection for an explicit customer before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "google-ads" && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(.invalidInput, "This agent already uses another Google Ads connection.")
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
              "source": .string("applications-google-ads-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("reporting-only-no-provider-mutations"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.googleAdsConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Google Ads reporting connection")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.googleAdsConnectionStatus = "Agent disconnected from Google Ads."
      }
      self.googleAdsSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleAnalyticsOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-analytics-oauth", refresh: .applications) {
      guard app.slug == "google-analytics" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Analytics must use the authenticated Railway broker with Relay-owned Google OAuth client configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Google Analytics authorization, offline refresh, revocation, and explicit GA4 property binding are not deployed on Railway yet. The desktop will not handle Relay's client secret, run a loopback callback, or exchange authorization codes."
      )
    }
  }
  func selectGoogleAnalyticsConnection(_ connectionId: RelayId) {
    googleAnalyticsSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteGoogleAnalyticsOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-analytics-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-analytics" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "google-analytics" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.googleAnalyticsSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.googleAnalyticsConnectionStatus =
        "\(deleted.accountLabel ?? "Google Analytics OAuth account") deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setGoogleAnalyticsAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-analytics-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-analytics" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(
          .invalidInput,
          "Connect Google Analytics and select a GA4 property before assigning agents.")
      }
      guard connection.status == .connected, connection.health.state == .ready else {
        throw RelayError(
          .invalidInput, "Connect a healthy Google Analytics OAuth account before assigning agents."
        )
      }
      guard connection.appSlug == "google-analytics",
        connection.grantedScopes == ProviderConnectionService.googleAnalyticsRelayOwnedOAuthScopes,
        connection.health.diagnostics["explicitPropertyOnly"]?.bool == true,
        connection.health.diagnostics["propertyDiscoveryEnabled"]?.bool == false,
        connection.health.diagnostics["arbitraryReportsEnabled"]?.bool == false,
        connection.health.diagnostics["realtimeBatchPivotFunnelAccessEnabled"]?.bool == false,
        connection.health.diagnostics["audienceExportsEnabled"]?.bool == false,
        connection.health.diagnostics["userDemographicPageSearchGeoCustomDetailEnabled"]?.bool
          == false, connection.health.diagnostics["mutationsEnabled"]?.bool == false,
        connection.health.diagnostics["measurementProtocolEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["serviceAccountEnabled"]?.bool == false,
        connection.health.diagnostics["domainDelegationEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "Save a verified exact-scope explicit-property Google Analytics connection before assigning agents."
        )
      }
      guard let propertyId = connection.health.diagnostics["selectedPropertyId"]?.string?.nilIfEmpty
      else {
        throw RelayError(
          .invalidInput, "Select a GA4 property before assigning agents to Google Analytics.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.googleAnalyticsDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeGoogleAnalyticsInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeGoogleAnalyticsInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput,
            "\(displayName) is already assigned to another Google Analytics connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.googleAnalyticsConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Google Analytics OAuth account")."
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
              "source": .string("applications-google-analytics-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "selectedPropertyId": .string(propertyId),
              "selectedPropertyName": connection.health.diagnostics["selectedPropertyName"]
                ?? .string("properties/\(propertyId)"),
              "runtimeWriteDeferredReason": .string("read-only-analytics-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.googleAnalyticsConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Google Analytics OAuth account")."
      } else {
        guard
          let install = self.activeGoogleAnalyticsInstall(
            agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.googleAnalyticsConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Google Analytics OAuth account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.googleAnalyticsConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Google Analytics OAuth account")."
      }
      self.googleAnalyticsSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleMerchantCenterOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-merchant-center-oauth", refresh: .applications) {
      guard app.slug == "google-merchant-center" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Merchant Center must use the authenticated Railway broker with Relay-owned Google OAuth client configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Merchant Center authorization, offline refresh, revocation, developer registration, and explicit account binding are not deployed on Railway yet. The desktop will not handle Relay's client secret, run a loopback callback, exchange authorization codes, or accept service-account keys."
      )
    }
  }
}
