import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func selectGoogleMerchantCenterConnection(_ connectionId: RelayId) {
    googleMerchantCenterSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteGoogleMerchantCenterOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction(
      "delete-google-merchant-center-oauth-connection-\(connection.id)", refresh: .applications
    ) {
      guard app.slug == "google-merchant-center", let services = self.services,
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
      self.googleMerchantCenterSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.googleMerchantCenterConnectionStatus =
        "\(deleted.accountLabel ?? "Merchant Center account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setGoogleMerchantCenterAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-merchant-center-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-merchant-center", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        !connection.userOwnedCredentialsRequired,
        connection.grantedScopes
          == ProviderConnectionService.googleMerchantCenterRelayOwnedOAuthScopes,
        connection.health.diagnostics["apiOrigin"]?.string == "https://merchantapi.googleapis.com",
        connection.health.diagnostics["apiVersion"]?.string == "v1",
        connection.health.diagnostics["selectedAccountName"]?.string?.hasPrefix("accounts/")
          == true, connection.health.diagnostics["readOnlyV1"]?.bool == true,
        connection.health.diagnostics["providerScopeCanWrite"]?.bool == true,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["fixedReportsOnly"]?.bool == true,
        connection.health.diagnostics["maxRows"]?.number == 50,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["serviceAccountEnabled"]?.bool == false,
        connection.health.diagnostics["v1BetaEnabled"]?.bool == false,
        connection.health.diagnostics["contentAPIEnabled"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A verified exact-scope read-only stable-v1 Merchant Center connection bound to an explicit account is required."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(
            .invalidInput, "This agent already uses another Merchant Center connection.")
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
              "source": .string("applications-google-merchant-center-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "selectedAccountName": connection.health.diagnostics["selectedAccountName"] ?? .null,
              "runtimeWriteDeferredReason": .string("read-only-merchant-api-stable-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.googleMerchantCenterConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Merchant Center account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.googleMerchantCenterConnectionStatus =
          "Agent disconnected from Google Merchant Center."
      }
      self.googleMerchantCenterSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startYouTubeOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-youtube-oauth", refresh: .applications) {
      guard app.slug == "youtube" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "YouTube must use the authenticated Railway broker with Relay-owned Google OAuth client configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "YouTube authorization, offline refresh, token revocation, and connected-channel binding are not deployed on Railway yet. The desktop will not handle Relay's client secret, run a loopback callback, or exchange authorization codes."
      )
    }
  }
  func selectYouTubeConnection(_ connectionId: RelayId) {
    youTubeSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteYouTubeOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-youtube-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "youtube", let services = self.services, let workspace = self.workspace
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
      self.youTubeSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.youTubeConnectionStatus =
        "\(deleted.accountLabel ?? "YouTube channel") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setYouTubeAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-youtube-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "youtube", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == app.slug,
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned, !connection.userOwnedCredentialsRequired,
        connection.grantedScopes == ProviderConnectionService.youTubeRelayOwnedOAuthScopes,
        connection.health.diagnostics["apiOrigin"]?.string
          == "https://www.googleapis.com/youtube/v3",
        connection.health.diagnostics["channelId"]?.string?.nilIfEmpty != nil,
        connection.health.diagnostics["readOnlyV1"]?.bool == true,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["searchEnabled"]?.bool == false,
        connection.health.diagnostics["historyEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["analyticsEnabled"]?.bool == false,
        connection.health.diagnostics["partnerEnabled"]?.bool == false,
        connection.health.diagnostics["serviceAccountEnabled"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false,
        connection.health.diagnostics["maxResults"]?.number == 25
      else {
        throw RelayError(
          .invalidInput,
          "A verified exact-scope read-only YouTube connection bound to the connected channel is required."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(.invalidInput, "This agent already uses another YouTube connection.")
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
              "source": .string("applications-youtube-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "channelId": connection.health.diagnostics["channelId"] ?? .null,
              "runtimeWriteDeferredReason": .string("read-only-youtube-data-api-v3"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.youTubeConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "YouTube channel")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.youTubeConnectionStatus = "Agent disconnected from YouTube."
      }
      self.youTubeSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGoogleClassroomOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-google-classroom-oauth", refresh: .applications) {
      guard app.slug == "google-classroom" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Google Classroom must use the authenticated Railway broker with Relay-owned Google OAuth client configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Google Classroom authorization, offline refresh, revocation, and requesting-user account binding are not deployed on Railway yet. The desktop will not handle Relay's client secret, run a loopback callback, exchange authorization codes, or use domain-wide delegation."
      )
    }
  }
  func selectGoogleClassroomConnection(_ connectionId: RelayId) {
    googleClassroomSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteGoogleClassroomOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-google-classroom-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "google-classroom", let services = self.services,
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
      self.googleClassroomSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.googleClassroomConnectionStatus =
        "\(deleted.accountLabel ?? "Classroom account") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setGoogleClassroomAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-google-classroom-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "google-classroom", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        !connection.userOwnedCredentialsRequired,
        connection.grantedScopes == ProviderConnectionService.googleClassroomRelayOwnedOAuthScopes,
        connection.health.diagnostics["apiOrigin"]?.string == "https://classroom.googleapis.com/v1",
        connection.health.diagnostics["requestingUserOnly"]?.bool == true,
        connection.health.diagnostics["readOnlyV1"]?.bool == true,
        connection.health.diagnostics["rostersEnabled"]?.bool == false,
        connection.health.diagnostics["studentSubmissionsGradesEnabled"]?.bool == false,
        connection.health.diagnostics["guardiansInvitationsEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["domainDelegationEnabled"]?.bool == false,
        connection.health.diagnostics["adminImpersonationEnabled"]?.bool == false,
        connection.health.diagnostics["previewEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false,
        connection.health.diagnostics["maxResults"]?.number == 25
      else {
        throw RelayError(
          .invalidInput,
          "A verified exact-scope requesting-user read-only Google Classroom connection is required."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(.invalidInput, "This agent already uses another Classroom connection.")
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
              "source": .string("applications-google-classroom-agent-switch"),
              "selectedConnectionId": .string(connection.id), "requestingUserOnly": .bool(true),
              "runtimeWriteDeferredReason": .string("read-only-classroom-api-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.googleClassroomConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Classroom account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.googleClassroomConnectionStatus = "Agent disconnected from Google Classroom."
      }
      self.googleClassroomSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startOutlookOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-outlook-oauth", refresh: .applications) {
      guard app.slug == "outlook" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_MICROSOFT_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Outlook must use the authenticated Railway broker with Relay-owned Microsoft OAuth configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Outlook delegated OAuth, PKCE, offline refresh, revocation, and signed-in mailbox binding are not deployed on Railway yet. The desktop will not handle Relay's Entra app secret, loopback code exchange, application permissions, or shared mail."
      )
    }
  }
  func selectOutlookConnection(_ connectionId: RelayId) {
    outlookSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteOutlookOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-outlook-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "outlook", let services = self.services, let workspace = self.workspace
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
      self.outlookSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.outlookConnectionStatus =
        "\(deleted.accountLabel ?? "Outlook mailbox") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setOutlookAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-outlook-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "outlook", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == app.slug,
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned, !connection.userOwnedCredentialsRequired,
        connection.grantedScopes == ProviderConnectionService.outlookRelayOwnedOAuthScopes,
        connection.health.diagnostics["apiOrigin"]?.string == "https://graph.microsoft.com/v1.0",
        connection.health.diagnostics["delegatedOnly"]?.bool == true,
        connection.health.diagnostics["selfMailboxOnly"]?.bool == true,
        connection.health.diagnostics["sharedMailEnabled"]?.bool == false,
        connection.health.diagnostics["applicationPermissionsEnabled"]?.bool == false,
        connection.health.diagnostics["attachmentsEnabled"]?.bool == false,
        connection.health.diagnostics["searchEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["calendarContactsFilesDirectoryEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false,
        connection.health.diagnostics["pkceS256"]?.bool == true
      else {
        throw RelayError(
          .invalidInput,
          "A verified exact-scope delegated self-mailbox Outlook connection is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(.invalidInput, "This agent already uses another Outlook connection.")
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
              "source": .string("applications-outlook-agent-switch"),
              "selectedConnectionId": .string(connection.id), "selfMailboxOnly": .bool(true),
              "runtimeWriteDeferredReason": .string("read-only-microsoft-graph-mail"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.outlookConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Outlook mailbox")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.outlookConnectionStatus = "Agent disconnected from Outlook."
      }
      self.outlookSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startMicrosoftTeamsOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-microsoft-teams-oauth", refresh: .applications) {
      guard app.slug == "microsoft-teams" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_MICROSOFT_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Microsoft Teams must use the authenticated Railway broker with Relay-owned Microsoft OAuth configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Microsoft Teams delegated OAuth, PKCE, offline refresh, revocation, and work-account binding are not deployed on Railway yet. The desktop will not handle Relay's Entra app secret, loopback exchange, application permissions, admin-consent scopes, or metered APIs."
      )
    }
  }
  func selectMicrosoftTeamsConnection(_ connectionId: RelayId) {
    microsoftTeamsSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteMicrosoftTeamsOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-microsoft-teams-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "microsoft-teams", let services = self.services,
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
      self.microsoftTeamsSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.microsoftTeamsConnectionStatus =
        "\(deleted.accountLabel ?? "Teams work account") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setMicrosoftTeamsAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-microsoft-teams-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "microsoft-teams", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        !connection.userOwnedCredentialsRequired,
        connection.grantedScopes == ProviderConnectionService.microsoftTeamsRelayOwnedOAuthScopes,
        connection.health.diagnostics["apiOrigin"]?.string == "https://graph.microsoft.com/v1.0",
        connection.health.diagnostics["delegatedOnly"]?.bool == true,
        connection.health.diagnostics["workSchoolOnly"]?.bool == true,
        connection.health.diagnostics["messageContentEnabled"]?.bool == false,
        connection.health.diagnostics["adminConsentScopesEnabled"]?.bool == false,
        connection.health.diagnostics["meteredAPIsEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false,
        connection.health.diagnostics["pkceS256"]?.bool == true
      else {
        throw RelayError(
          .invalidInput,
          "A verified exact-scope delegated metadata-only Microsoft Teams connection is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(
            .invalidInput, "This agent already uses another Microsoft Teams connection.")
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
              "source": .string("applications-microsoft-teams-agent-switch"),
              "selectedConnectionId": .string(connection.id), "metadataOnly": .bool(true),
              "runtimeWriteDeferredReason": .string(
                "read-only-microsoft-graph-team-channel-metadata"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.microsoftTeamsConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Teams work account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.microsoftTeamsConnectionStatus = "Agent disconnected from Microsoft Teams."
      }
      self.microsoftTeamsSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startOneDriveOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-onedrive-oauth", refresh: .applications) {
      guard app.slug == "onedrive" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_MICROSOFT_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "OneDrive must use the authenticated Railway broker with Relay-owned Microsoft OAuth configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "OneDrive delegated OAuth, PKCE, offline refresh, revocation, and signed-in-drive binding are not deployed on Railway yet. The desktop will not handle Relay's Entra app secret, loopback exchange, file contents, shared items, application permissions, or writes."
      )
    }
  }
  func selectOneDriveConnection(_ connectionId: RelayId) {
    oneDriveSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteOneDriveOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-onedrive-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "onedrive", let services = self.services, let workspace = self.workspace
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
      self.oneDriveSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.oneDriveConnectionStatus =
        "\(deleted.accountLabel ?? "OneDrive account") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setOneDriveAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-onedrive-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "onedrive", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == app.slug,
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned, !connection.userOwnedCredentialsRequired,
        connection.grantedScopes == ProviderConnectionService.oneDriveRelayOwnedOAuthScopes,
        connection.health.diagnostics["apiOrigin"]?.string == "https://graph.microsoft.com/v1.0",
        connection.health.diagnostics["delegatedOnly"]?.bool == true,
        connection.health.diagnostics["selfDriveOnly"]?.bool == true,
        connection.health.diagnostics["metadataOnly"]?.bool == true,
        connection.health.diagnostics["contentDownloadEnabled"]?.bool == false,
        connection.health.diagnostics["sharedRemoteEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false,
        connection.health.diagnostics["pkceS256"]?.bool == true
      else {
        throw RelayError(
          .invalidInput,
          "A verified exact-scope delegated metadata-only OneDrive connection is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        if existing?.connectionId == connection.id { return self.selectedThreadId }
        guard existing == nil else {
          throw RelayError(.invalidInput, "This agent already uses another OneDrive connection.")
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
              "source": .string("applications-onedrive-agent-switch"),
              "selectedConnectionId": .string(connection.id), "metadataOnly": .bool(true),
              "runtimeWriteDeferredReason": .string("read-only-microsoft-graph-onedrive-metadata"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.oneDriveConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "OneDrive account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.oneDriveConnectionStatus = "Agent disconnected from OneDrive."
      }
      self.oneDriveSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startSharePointOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-sharepoint-oauth", refresh: .applications) {
      guard app.slug == "sharepoint" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_MICROSOFT_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "SharePoint must use the authenticated Railway broker with Relay-owned Microsoft OAuth configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "SharePoint delegated Sites.Selected OAuth and administrator-granted site selection are not deployed on Railway yet. The desktop will not handle Relay's Entra secret, loopback exchange, tenant search, content, broad scopes, or grant administration."
      )
    }
  }
  func selectSharePointConnection(_ connectionId: RelayId) {
    sharePointSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteSharePointOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-sharepoint-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "sharepoint", let services = self.services, let workspace = self.workspace
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
      self.sharePointSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.sharePointConnectionStatus =
        "\(deleted.accountLabel ?? "SharePoint site") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setSharePointAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-sharepoint-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "sharepoint", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == app.slug,
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned,
        connection.grantedScopes == ProviderConnectionService.sharePointRelayOwnedOAuthScopes,
        connection.health.diagnostics["selectedSiteOnly"]?.bool == true,
        connection.health.diagnostics["siteGrantVerified"]?.bool == true,
        connection.health.diagnostics["metadataOnly"]?.bool == true,
        connection.health.diagnostics["tenantSearchEnabled"]?.bool == false,
        connection.health.diagnostics["contentEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A verified exact-scope administrator-granted selected-site SharePoint connection is required."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(.invalidInput, "This agent already uses another SharePoint connection.")
        }
        if existing == nil {
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
                "source": .string("applications-sharepoint-agent-switch"),
                "selectedSiteOnly": .bool(true),
              ], requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
        self.sharePointConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "SharePoint site")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.sharePointConnectionStatus = "Agent disconnected from SharePoint."
      }
      self.sharePointSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startMicrosoftPlannerOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-microsoft-planner-oauth", refresh: .applications) {
      guard app.slug == "microsoft-planner" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_MICROSOFT_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Planner must use the authenticated Railway broker with Relay-owned Microsoft OAuth configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Planner delegated Tasks.Read OAuth is not deployed on Railway yet. The desktop will not handle Relay's Entra secret, loopback exchange, broad Graph scopes, or writes."
      )
    }
  }
  func selectMicrosoftPlannerConnection(_ connectionId: RelayId) {
    microsoftPlannerSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteMicrosoftPlannerOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-microsoft-planner-oauth-connection-\(connection.id)", refresh: .applications)
    {
      guard app.slug == "microsoft-planner", let services = self.services,
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
      self.microsoftPlannerSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.microsoftPlannerConnectionStatus =
        "\(deleted.accountLabel ?? "Planner account") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setMicrosoftPlannerAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-microsoft-planner-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "microsoft-planner", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        connection.grantedScopes == ProviderConnectionService.microsoftPlannerRelayOwnedOAuthScopes,
        connection.health.diagnostics["delegatedOnly"]?.bool == true,
        connection.health.diagnostics["workSchoolOnly"]?.bool == true,
        connection.health.diagnostics["assignmentIdentitiesEnabled"]?.bool == false,
        connection.health.diagnostics["detailsEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput, "A ready exact-scope delegated Planner Tasks.Read connection is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(.invalidInput, "This agent already uses another Planner connection.")
        }
        if existing == nil {
          let agent = try services.data.getAgent(agentId)
          _ = try services.marketplaceInstalls.createInstall(
            context: context,
            request: MarketplaceInstallRequest(
              id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
              appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
              roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
              approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
              targetMode: .existingAgent, riskAcknowledged: true,
              metadata: ["source": .string("applications-microsoft-planner-agent-switch")],
              requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
        self.microsoftPlannerConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Planner account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.microsoftPlannerConnectionStatus = "Agent disconnected from Planner."
      }
      self.microsoftPlannerSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startMicrosoftToDoOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-microsoft-to-do-oauth", refresh: .applications) {
      guard app.slug == "microsoft-to-do" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_MICROSOFT_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Microsoft To Do must use the authenticated Railway broker with Relay-owned Microsoft OAuth configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Microsoft To Do delegated Tasks.Read OAuth is not deployed on Railway yet. The desktop will not handle Relay's Entra secret, loopback exchange, broad Graph scopes, shared-task expansion, or writes."
      )
    }
  }
  func selectMicrosoftToDoConnection(_ connectionId: RelayId) {
    microsoftToDoSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteMicrosoftToDoOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-microsoft-to-do-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "microsoft-to-do", let services = self.services,
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
      self.microsoftToDoSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.microsoftToDoConnectionStatus =
        "\(deleted.accountLabel ?? "Microsoft To Do account") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setMicrosoftToDoAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-microsoft-to-do-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "microsoft-to-do", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        connection.grantedScopes == ProviderConnectionService.microsoftToDoRelayOwnedOAuthScopes,
        connection.health.diagnostics["delegatedSelfOnly"]?.bool == true,
        connection.health.diagnostics["sharedTasksEnabled"]?.bool == false,
        connection.health.diagnostics["taskBodyEnabled"]?.bool == false,
        connection.health.diagnostics["relatedContentEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready exact-scope delegated Microsoft To Do Tasks.Read connection is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(
            .invalidInput, "This agent already uses another Microsoft To Do connection.")
        }
        if existing == nil {
          let agent = try services.data.getAgent(agentId)
          _ = try services.marketplaceInstalls.createInstall(
            context: context,
            request: MarketplaceInstallRequest(
              id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
              appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
              roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
              approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
              targetMode: .existingAgent, riskAcknowledged: true,
              metadata: ["source": .string("applications-microsoft-to-do-agent-switch")],
              requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
        self.microsoftToDoConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Microsoft To Do account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.microsoftToDoConnectionStatus = "Agent disconnected from Microsoft To Do."
      }
      self.microsoftToDoSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startMicrosoftListsOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-microsoft-lists-oauth", refresh: .applications) {
      guard app.slug == "microsoft-lists" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_MICROSOFT_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Microsoft Lists must use the authenticated Railway broker with Relay-owned Microsoft OAuth configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Microsoft Lists delegated selected-list OAuth, administrator grant, and approved-field selection are not deployed on Railway yet. Desktop will not handle Relay's Entra secret, broad discovery, grant administration, or raw fields."
      )
    }
  }
  func selectMicrosoftListsConnection(_ connectionId: RelayId) {
    microsoftListsSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteMicrosoftListsOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-microsoft-lists-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "microsoft-lists", let services = self.services,
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
      self.microsoftListsSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.microsoftListsConnectionStatus =
        "\(deleted.accountLabel ?? "Microsoft List") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setMicrosoftListsAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-microsoft-lists-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "microsoft-lists", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        connection.grantedScopes == ProviderConnectionService.microsoftListsRelayOwnedOAuthScopes,
        connection.health.diagnostics["selectedListOnly"]?.bool == true,
        connection.health.diagnostics["listGrantVerified"]?.bool == true,
        !MicrosoftListsProviderActionSupport.stringSet(
          connection.health.diagnostics["allowedFieldNames"]
        ).isEmpty, connection.health.diagnostics["unapprovedFieldsEnabled"]?.bool == false,
        connection.health.diagnostics["attachmentsDriveEnabled"]?.bool == false,
        connection.health.diagnostics["identitiesPermissionsEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A verified exact-scope selected-list connection with approved fields is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(
            .invalidInput, "This agent already uses another Microsoft Lists connection.")
        }
        if existing == nil {
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
                "source": .string("applications-microsoft-lists-agent-switch"),
                "selectedListOnly": .bool(true),
              ], requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
        self.microsoftListsConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Microsoft List")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.microsoftListsConnectionStatus = "Agent disconnected from Microsoft Lists."
      }
      self.microsoftListsSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startOneNoteOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-onenote-oauth", refresh: .applications) {
      guard app.slug == "onenote" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_MICROSOFT_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "OneNote must use the authenticated Railway broker with Relay-owned Microsoft OAuth configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "OneNote delegated Notes.Read OAuth is not deployed on Railway yet. Desktop will not handle Relay's Entra secret, loopback exchange, page content, shared/group/site notebooks, broad scopes, or writes."
      )
    }
  }
  func selectOneNoteConnection(_ connectionId: RelayId) {
    oneNoteSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteOneNoteOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-onenote-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "onenote", let services = self.services, let workspace = self.workspace
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
      self.oneNoteSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.oneNoteConnectionStatus =
        "\(deleted.accountLabel ?? "OneNote account") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setOneNoteAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-onenote-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "onenote", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == app.slug,
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned,
        connection.grantedScopes == ProviderConnectionService.oneNoteRelayOwnedOAuthScopes,
        connection.health.diagnostics["delegatedSelfOnly"]?.bool == true,
        connection.health.diagnostics["metadataOnly"]?.bool == true,
        connection.health.diagnostics["pageContentEnabled"]?.bool == false,
        connection.health.diagnostics["resourcesMediaOCREnabled"]?.bool == false,
        connection.health.diagnostics["sharedGroupSiteEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput, "A ready exact-scope delegated OneNote metadata connection is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(.invalidInput, "This agent already uses another OneNote connection.")
        }
        if existing == nil {
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
                "source": .string("applications-onenote-agent-switch"), "metadataOnly": .bool(true),
              ], requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
        self.oneNoteConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "OneNote account")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.oneNoteConnectionStatus = "Agent disconnected from OneNote."
      }
      self.oneNoteSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func startMicrosoftBookingsOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-microsoft-bookings-oauth", refresh: .applications) {
      guard app.slug == "microsoft-bookings" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_MICROSOFT_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Microsoft Bookings must use the authenticated Railway broker with Relay-owned Microsoft OAuth configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Microsoft Bookings delegated Bookings.Read.All OAuth and selected-business picker are not deployed on Railway yet. Desktop will not handle Relay's Entra secret, loopback exchange, customer/staff PII, broad scopes, or writes."
      )
    }
  }
  func selectMicrosoftBookingsConnection(_ connectionId: RelayId) {
    microsoftBookingsSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteMicrosoftBookingsOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-microsoft-bookings-oauth-connection-\(connection.id)", refresh: .applications)
    {
      guard app.slug == "microsoft-bookings", let services = self.services,
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
      self.microsoftBookingsSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.microsoftBookingsConnectionStatus =
        "\(deleted.accountLabel ?? "Microsoft Bookings account") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setMicrosoftBookingsAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-microsoft-bookings-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "microsoft-bookings", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        connection.grantedScopes
          == ProviderConnectionService.microsoftBookingsRelayOwnedOAuthScopes,
        connection.health.diagnostics["workSchoolOnly"]?.bool == true,
        connection.health.diagnostics["selectedBusinessVerified"]?.bool == true,
        connection.health.diagnostics["privacyScrubbed"]?.bool == true,
        connection.health.diagnostics["customerPIIEnabled"]?.bool == false,
        connection.health.diagnostics["staffIdentityEnabled"]?.bool == false,
        connection.health.diagnostics["notesJoinURLsEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready exact-scope selected-business Microsoft Bookings connection is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(
            .invalidInput, "This agent already uses another Microsoft Bookings connection.")
        }
        if existing == nil {
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
                "source": .string("applications-microsoft-bookings-agent-switch"),
                "selectedBusinessOnly": .bool(true), "privacyScrubbed": .bool(true),
              ], requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
        self.microsoftBookingsConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Microsoft Bookings business")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.microsoftBookingsConnectionStatus = "Agent disconnected from Microsoft Bookings."
      }
      self.microsoftBookingsSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func startMicrosoftPowerBIOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-microsoft-power-bi-oauth", refresh: .applications) {
      guard app.slug == "microsoft-power-bi" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_MICROSOFT_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Microsoft Power BI must use the authenticated Railway broker with Relay-owned Microsoft OAuth configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Power BI delegated read OAuth and selected-workspace picker are not deployed on Railway yet. Desktop will not handle Relay's Entra secret, loopback exchange, analytics content, broad scopes, or writes."
      )
    }
  }
  func selectMicrosoftPowerBIConnection(_ connectionId: RelayId) {
    microsoftPowerBISelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteMicrosoftPowerBIOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-microsoft-power-bi-oauth-connection-\(connection.id)", refresh: .applications)
    {
      guard app.slug == "microsoft-power-bi", let services = self.services,
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
      self.microsoftPowerBISelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.microsoftPowerBIConnectionStatus =
        "\(deleted.accountLabel ?? "Power BI workspace") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setMicrosoftPowerBIAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-microsoft-power-bi-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "microsoft-power-bi", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        connection.grantedScopes == ProviderConnectionService.microsoftPowerBIRelayOwnedOAuthScopes,
        connection.health.diagnostics["workSchoolOnly"]?.bool == true,
        connection.health.diagnostics["selectedWorkspaceVerified"]?.bool == true,
        connection.health.diagnostics["metadataOnly"]?.bool == true,
        connection.health.diagnostics["reportContentEnabled"]?.bool == false,
        connection.health.diagnostics["embedURLsTokensEnabled"]?.bool == false,
        connection.health.diagnostics["datasetQueriesEnabled"]?.bool == false,
        connection.health.diagnostics["identitiesEnabled"]?.bool == false,
        connection.health.diagnostics["refreshGatewayAdminEnabled"]?.bool == false,
        connection.health.diagnostics["exportsDownloadsEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready exact-scope selected-workspace Power BI metadata connection is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(.invalidInput, "This agent already uses another Power BI connection.")
        }
        if existing == nil {
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
                "source": .string("applications-microsoft-power-bi-agent-switch"),
                "selectedWorkspaceOnly": .bool(true), "metadataOnly": .bool(true),
              ], requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
        self.microsoftPowerBIConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Power BI workspace")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.microsoftPowerBIConnectionStatus = "Agent disconnected from Microsoft Power BI."
      }
      self.microsoftPowerBISelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func startMicrosoftDynamics365OAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-microsoft-dynamics-365-oauth", refresh: .applications) {
      guard app.slug == "microsoft-dynamics-365" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_MICROSOFT_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Dynamics 365 must use the authenticated Railway broker with Relay-owned Microsoft OAuth configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Dynamics 365 environment-scoped OAuth and verified environment picker are not deployed on Railway yet. Desktop will not handle Relay's Entra secret, loopback exchange, custom tables, contacts, broad queries, or writes."
      )
    }
  }
  func selectMicrosoftDynamics365Connection(_ connectionId: RelayId) {
    microsoftDynamics365SelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteMicrosoftDynamics365OAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction(
      "delete-microsoft-dynamics-365-oauth-connection-\(connection.id)", refresh: .applications
    ) {
      guard app.slug == "microsoft-dynamics-365", let services = self.services,
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
      self.microsoftDynamics365SelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.microsoftDynamics365ConnectionStatus =
        "\(deleted.accountLabel ?? "Dynamics 365 environment") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setMicrosoftDynamics365AgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-microsoft-dynamics-365-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "microsoft-dynamics-365", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        let origin = connection.health.diagnostics["environmentOrigin"]?.string,
        connection.grantedScopes
          == (try ProviderConnectionService.microsoftDynamics365RelayOwnedOAuthScopes(
            environmentOrigin: origin)),
        connection.health.diagnostics["selectedEnvironmentVerified"]?.bool == true,
        connection.health.diagnostics["standardSalesTablesVerified"]?.bool == true,
        connection.health.diagnostics["getOnly"]?.bool == true,
        connection.health.diagnostics["fixedSelectOnly"]?.bool == true,
        connection.health.diagnostics["customTablesEnabled"]?.bool == false,
        connection.health.diagnostics["identitiesContactsEnabled"]?.bool == false,
        connection.health.diagnostics["searchExpandFetchXMLEnabled"]?.bool == false,
        connection.health.diagnostics["schemaActionsBatchEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready exact-scope selected-environment Dynamics 365 fixed-GET connection is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(
            .invalidInput, "This agent already uses another Dynamics 365 connection.")
        }
        if existing == nil {
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
                "source": .string("applications-microsoft-dynamics-365-agent-switch"),
                "selectedEnvironmentOnly": .bool(true), "getOnly": .bool(true),
              ], requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
        self.microsoftDynamics365ConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Dynamics 365 environment")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.microsoftDynamics365ConnectionStatus = "Agent disconnected from Dynamics 365."
      }
      self.microsoftDynamics365SelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func startMicrosoftVivaEngageOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-microsoft-viva-engage-oauth", refresh: .applications) {
      guard app.slug == "microsoft-viva-engage" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_MICROSOFT_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Viva Engage must use the authenticated Railway broker with Relay-owned Microsoft OAuth configuration."
        )
      }
      throw RelayError(
        .unsupported,
        "Viva Engage Entra access_as_user OAuth and verified community picker are not deployed on Railway yet. Desktop will not handle Relay's Entra secret, loopback exchange, private feeds, broad APIs, or writes."
      )
    }
  }
  func selectMicrosoftVivaEngageConnection(_ connectionId: RelayId) {
    microsoftVivaEngageSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteMicrosoftVivaEngageOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction(
      "delete-microsoft-viva-engage-oauth-connection-\(connection.id)", refresh: .applications
    ) {
      guard app.slug == "microsoft-viva-engage", let services = self.services,
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
      self.microsoftVivaEngageSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.microsoftVivaEngageConnectionStatus =
        "\(deleted.accountLabel ?? "Viva Engage community") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setMicrosoftVivaEngageAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-microsoft-viva-engage-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "microsoft-viva-engage", let services = self.services,
        let workspace = self.workspace, let connection = self.selectedProviderConnection,
        connection.appSlug == app.slug, connection.status == .connected,
        connection.health.state == .ready, connection.credentialOwnership == .relayOwned,
        connection.grantedScopes
          == ProviderConnectionService.microsoftVivaEngageRelayOwnedOAuthScopes,
        connection.health.diagnostics["selectedCommunityVerified"]?.bool == true,
        connection.health.diagnostics["getOnly"]?.bool == true,
        connection.health.diagnostics["privateMessagesEnabled"]?.bool == false,
        connection.health.diagnostics["identitiesMembersEnabled"]?.bool == false,
        connection.health.diagnostics["attachmentsEnabled"]?.bool == false,
        connection.health.diagnostics["searchExportEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready exact-scope selected-community Viva Engage GET-only connection is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(.invalidInput, "This agent already uses another Viva Engage connection.")
        }
        if existing == nil {
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
                "source": .string("applications-microsoft-viva-engage-agent-switch"),
                "selectedCommunityOnly": .bool(true), "getOnly": .bool(true),
              ], requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
        self.microsoftVivaEngageConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Viva Engage community")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.microsoftVivaEngageConnectionStatus = "Agent disconnected from Viva Engage."
      }
      self.microsoftVivaEngageSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func startZoomOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-zoom-oauth", refresh: .applications) {
      guard app.slug == "zoom" else { return self.selectedThreadId }
      guard let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(.unsupported, "Zoom must use the authenticated Railway OAuth broker.")
      }
      throw RelayError(
        .unsupported,
        "Zoom user-managed OAuth, production credentials, and callback/revocation lifecycle are not deployed on Railway yet. Desktop will not handle client secrets, loopback exchange, meeting credentials, participant content, or writes."
      )
    }
  }
  func selectZoomConnection(_ connectionId: RelayId) {
    zoomSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteZoomOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-zoom-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "zoom", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
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
      self.zoomSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.zoomConnectionStatus = "\(deleted.accountLabel ?? "Zoom user") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setZoomAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-zoom-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "zoom", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == app.slug,
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned,
        connection.grantedScopes == ProviderConnectionService.zoomRelayOwnedOAuthScopes,
        connection.health.diagnostics["userVerified"]?.bool == true,
        connection.health.diagnostics["selfUserOnly"]?.bool == true,
        connection.health.diagnostics["metadataOnly"]?.bool == true,
        connection.health.diagnostics["joinStartCredentialsEnabled"]?.bool == false,
        connection.health.diagnostics["peopleContentEnabled"]?.bool == false,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput, "A ready exact-scope self-user Zoom metadata-only connection is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(.invalidInput, "This agent already uses another Zoom connection.")
        }
        if existing == nil {
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
                "source": .string("applications-zoom-agent-switch"), "selfUserOnly": .bool(true),
                "metadataOnly": .bool(true),
              ], requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
        self.zoomConnectionStatus = "Agent connected to \(connection.accountLabel ?? "Zoom user")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.zoomConnectionStatus = "Agent disconnected from Zoom."
      }
      self.zoomSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func startDiscordBotConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-discord-bot", refresh: .applications) {
      guard app.slug == "discord" else { return self.selectedThreadId }
      guard let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported, "Discord must use the authenticated Railway bot-install broker.")
      }
      throw RelayError(
        .unsupported,
        "Discord bot installation, guild/channel selection, Message Content approval verification, and revocation lifecycle are not deployed on Railway yet. Desktop will not handle the bot token or automate a user account."
      )
    }
  }
  func selectDiscordConnection(_ connectionId: RelayId) {
    discordSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteDiscordConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-discord-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "discord", let services = self.services, let workspace = self.workspace
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
      self.discordSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first {
          $0.id != deleted.id && $0.appSlug == app.slug
        }?.id ?? ""
      self.discordConnectionStatus =
        "\(deleted.accountLabel ?? "Discord channel") revoked and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setDiscordAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-discord-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "discord", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == app.slug,
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned,
        connection.grantedScopes == ProviderConnectionService.discordRelayOwnedOAuthScopes,
        connection.health.diagnostics["botInstallOnly"]?.bool == true,
        connection.health.diagnostics["selectedGuildVerified"]?.bool == true,
        connection.health.diagnostics["selectedChannelVerified"]?.bool == true,
        connection.health.diagnostics["selectedChannelIsNSFW"]?.bool == false,
        connection.health.diagnostics["messageContentEnabled"]?.bool == true,
        connection.health.diagnostics["requestedPermissions"]?.string == "66560",
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready exact-permission selected-guild/channel Discord bot connection is required.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == app.slug && self.isActiveMarketplaceInstall($0)
      }
      if enabled {
        guard existing == nil || existing?.connectionId == connection.id else {
          throw RelayError(.invalidInput, "This agent already uses another Discord connection.")
        }
        if existing == nil {
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
                "source": .string("applications-discord-agent-switch"),
                "selectedGuildChannelOnly": .bool(true), "botInstallOnly": .bool(true),
              ], requestedByActorId: context.actorId, requestedAt: nowIso(),
              redactionStatus: "private-state-excluded"))
        }
        self.discordConnectionStatus =
          "Agent connected to \(connection.accountLabel ?? "Discord channel")."
      } else if let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.discordConnectionStatus = "Agent disconnected from Discord."
      }
      self.discordSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
}
