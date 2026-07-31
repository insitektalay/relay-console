import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func deleteRingCentralConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-ringcentral-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "ringcentral", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "ringcentral" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/ringcentral/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.ringCentralSelectedConnectionId = ""
      self.ringCentralConnectionStatus =
        "\(deleted.accountLabel ?? "RingCentral extension") revoked, disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func testRingCentralConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-ringcentral-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "ringcentral", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/ringcentral/connections/\(remoteId)/health")
      self.ringCentralConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "RingCentral self-extension health check passed."
          : "RingCentral requires reauthorization.")
      self.ringCentralSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startDialpadOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-dialpad-oauth", refresh: .applications) {
      guard app.slug == "dialpad", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/dialpad/oauth/start",
        body: ["returnTo": "https://relayconsole.work/app?marketplace_app=dialpad"])
      guard let raw = response["authorizationUrl"] as? String, let url = URL(string: raw),
        url.scheme == "https", url.host?.lowercased() == "dialpad.com"
      else {
        throw RelayError(.internalError, "Railway returned an invalid Dialpad authorization URL.")
      }
      NSWorkspace.shared.open(url)
      self.dialpadConnectionStatus =
        "Dialpad authorization opened. Railway retains PKCE state and rotating OAuth tokens."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectDialpadConnection(_ connectionId: RelayId) {
    dialpadSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func setDialpadAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-dialpad-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "dialpad", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == "dialpad",
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned,
        Set(connection.grantedScopes) == Set(["offline_access"]),
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["stateVerified"]?.bool == true,
        connection.health.diagnostics["pkceS256"]?.bool == true,
        connection.health.diagnostics["userVerified"]?.bool == true,
        connection.health.diagnostics["selfUserOnly"]?.bool == true,
        connection.health.diagnostics["canonicalDialpadOnly"]?.bool == true,
        connection.health.diagnostics["privacyMasked"]?.bool == true,
        connection.health.diagnostics["forwardingNumbers"]?.string == "blocked",
        connection.health.diagnostics["maxResponseBytes"]?.number == 524_288,
        connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready own-user-bound Dialpad connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "dialpad" && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: ["source": .string("applications-dialpad-agent-switch")],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(), redactionStatus: "provider-content-not-stored"))
        self.dialpadConnectionStatus =
          "Agent connected with read-only privacy-masked Dialpad authority."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.dialpadConnectionStatus = "Agent disconnected from Dialpad."
      }
      self.dialpadSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteDialpadConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-dialpad-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "dialpad", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "dialpad" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/dialpad/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.dialpadSelectedConnectionId = ""
      self.dialpadConnectionStatus =
        "\(deleted.accountLabel ?? "Dialpad user") deauthorized, disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func testDialpadConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-dialpad-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "dialpad", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/dialpad/connections/\(remoteId)/health")
      self.dialpadConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Dialpad own-user health check passed." : "Dialpad requires reauthorization.")
      self.dialpadSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startAircallOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-aircall-oauth", refresh: .applications) {
      guard app.slug == "aircall", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/aircall/oauth/start",
        body: ["returnTo": "https://relayconsole.work/app?marketplace_app=aircall"])
      guard let raw = response["authorizationUrl"] as? String, let url = URL(string: raw),
        url.scheme == "https", url.host?.lowercased() == "dashboard.aircall.io"
      else {
        throw RelayError(.internalError, "Railway returned an invalid Aircall authorization URL.")
      }
      NSWorkspace.shared.open(url)
      self.aircallConnectionStatus =
        "Aircall administrator authorization opened. Railway retains state, secret and the non-expiring access token."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectAircallConnection(_ connectionId: RelayId) {
    aircallSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func setAircallAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-aircall-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "aircall", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == "aircall",
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned,
        Set(connection.grantedScopes) == Set(["public_api"]),
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["stateVerified"]?.bool == true,
        connection.health.diagnostics["pkceS256"]?.bool == false,
        connection.health.diagnostics["companyBindingVerified"]?.bool == true,
        connection.health.diagnostics["integrationActive"]?.bool == true,
        connection.health.diagnostics["canonicalAircallOnly"]?.bool == true,
        connection.health.diagnostics["privacyMasked"]?.bool == true,
        connection.health.diagnostics["maxResponseBytes"]?.number == 524_288,
        connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready company-bound Aircall connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "aircall" && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: ["source": .string("applications-aircall-agent-switch")],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(), redactionStatus: "provider-content-not-stored"))
        self.aircallConnectionStatus =
          "Agent connected with read-only privacy-masked Aircall authority."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.aircallConnectionStatus = "Agent disconnected from Aircall."
      }
      self.aircallSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteAircallConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-aircall-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "aircall", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "aircall" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/aircall/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.aircallSelectedConnectionId = ""
      self.aircallConnectionStatus =
        "\(deleted.accountLabel ?? "Aircall company") disabled upstream, disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func testAircallConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-aircall-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "aircall", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/aircall/connections/\(remoteId)/health")
      self.aircallConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Aircall company-binding health check passed." : "Aircall requires reauthorization.")
      self.aircallSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveOpenPhoneRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-openphone-api-key", refresh: .applications) {
      guard app.slug == "openphone", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.openPhoneAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !apiKey.isEmpty, apiKey.count <= 16_000,
        !apiKey.contains("\r"), !apiKey.contains("\n")
      else {
        throw RelayError(
          .invalidInput, "Enter one valid Quo workspace API key without line breaks.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "openphone",
          "displayName": "Quo workspace",
          "authType": "api_key",
          "credentials": ["OPENPHONE_API_KEY": apiKey],
          "selectedCapabilities": ["phone_number_read"],
        ]
      )
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Quo connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "GET",
        relativePath: "connectors/openphone/connections/\(connectionId)/health"
      )
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "Quo rejected this workspace API key.")
      }
      self.openPhoneAPIKeyDraft = ""
      self.openPhoneConnectionStatus =
        "Quo workspace connected with one bounded privacy-masked read."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectOpenPhoneConnection(_ connectionId: RelayId) {
    openPhoneSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func setOpenPhoneAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-openphone-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "openphone", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == "openphone",
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .userOwned,
        connection.grantedScopes.isEmpty,
        connection.health.diagnostics["keyValidated"]?.bool == true,
        connection.health.diagnostics["fullAccessWorkspaceKeyReadSurfaceOnly"]?.bool == true,
        connection.health.diagnostics["rawAuthorizationHeader"]?.bool == true,
        connection.health.diagnostics["privacyMasked"]?.bool == true,
        connection.health.diagnostics["maxPhoneNumbers"]?.number == 10,
        connection.health.diagnostics["maxResponseBytes"]?.number == 524_288,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready encrypted Quo workspace-key connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "openphone" && self.isActiveMarketplaceInstall($0)
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
            metadata: ["source": .string("applications-openphone-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-content-not-stored"
          )
        )
        self.openPhoneConnectionStatus =
          "Agent connected to the one privacy-masked Quo phone-number read."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.openPhoneConnectionStatus = "Agent disconnected from Quo."
      }
      self.openPhoneSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteOpenPhoneConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-openphone-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "openphone", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "openphone" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id,
        localConnectionId: connection.id
      )
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connectors/openphone/connections/\(remoteId)/disconnect"
      )
      let deleted = try services.providerConnections.deleteConnection(
        context: context,
        connectionId: connection.id
      )
      self.openPhoneSelectedConnectionId = ""
      self.openPhoneConnectionStatus =
        "\(deleted.accountLabel ?? "Quo workspace") disconnected and Relay's encrypted key copy deleted. Delete the API key in Quo Workspace Settings to revoke it at the provider."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func testOpenPhoneConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-openphone-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "openphone", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id,
        localConnectionId: connection.id
      )
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "GET",
        relativePath: "connectors/openphone/connections/\(remoteId)/health"
      )
      self.openPhoneConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Quo workspace-key health check passed." : "Quo requires a replacement API key.")
      self.openPhoneSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveTwilioRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-twilio-restricted-api-key", refresh: .applications) {
      guard app.slug == "twilio", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let accountSID = self.twilioAccountSIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let apiKeySID = self.twilioAPIKeySIDDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let apiKeySecret = self.twilioAPIKeySecretDraft.trimmingCharacters(
        in: .whitespacesAndNewlines)
      guard accountSID.range(of: #"^AC[0-9a-fA-F]{32}$"#, options: .regularExpression) != nil,
        apiKeySID.range(of: #"^SK[0-9a-fA-F]{32}$"#, options: .regularExpression) != nil,
        !apiKeySecret.isEmpty, apiKeySecret.count <= 16_000,
        !apiKeySecret.contains("\r"), !apiKeySecret.contains("\n")
      else {
        throw RelayError(
          .invalidInput,
          "Enter one valid AC-prefixed Account SID, SK-prefixed Restricted API Key SID, and key secret."
        )
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST",
        relativePath: "connections",
        body: [
          "appSlug": "twilio", "displayName": "Twilio account \(accountSID.suffix(4))",
          "authType": "api_key",
          "credentials": [
            "TWILIO_ACCOUNT_SID": accountSID, "TWILIO_API_KEY_SID": apiKeySID,
            "TWILIO_API_KEY_SECRET": apiKeySecret,
          ],
          "selectedCapabilities": ["message_status_read"],
        ]
      )
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Twilio connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/twilio/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Twilio rejected this Restricted API key.")
      }
      self.twilioAccountSIDDraft = ""
      self.twilioAPIKeySIDDraft = ""
      self.twilioAPIKeySecretDraft = ""
      self.twilioConnectionStatus = "Twilio connected with one bounded privacy-masked status read."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectTwilioConnection(_ connectionId: RelayId) {
    twilioSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func setTwilioAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-twilio-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "twilio", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == "twilio",
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .userOwned, connection.grantedScopes.isEmpty,
        connection.health.diagnostics["keyValidated"]?.bool == true,
        connection.health.diagnostics["restrictedMessageReadOnly"]?.bool == true,
        connection.health.diagnostics["basicAPIKeyAuthentication"]?.bool == true,
        connection.health.diagnostics["canonicalTwilioOnly"]?.bool == true,
        connection.health.diagnostics["privacyMasked"]?.bool == true,
        connection.health.diagnostics["maxMessageStatuses"]?.number == 10,
        connection.health.diagnostics["maxResponseBytes"]?.number == 524_288,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready encrypted Twilio Restricted-key connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "twilio" && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: ["source": .string("applications-twilio-agent-switch")],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(), redactionStatus: "provider-content-not-stored"))
        self.twilioConnectionStatus =
          "Agent connected to the one masked Twilio message-status read."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.twilioConnectionStatus = "Agent disconnected from Twilio."
      }
      self.twilioSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteTwilioConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-twilio-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "twilio", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "twilio" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/twilio/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.twilioSelectedConnectionId = ""
      self.twilioConnectionStatus =
        "\(deleted.accountLabel ?? "Twilio account") disconnected and Relay's encrypted credential copy deleted. Delete the Restricted API key in Twilio Console to revoke provider access."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func testTwilioConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-twilio-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "twilio", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/twilio/connections/\(remoteId)/health")
      self.twilioConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Twilio Restricted-key health check passed."
          : "Twilio requires replacement credentials or narrower Messages GET authority.")
      self.twilioSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveVonageRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-vonage-api-secret", refresh: .applications) {
      guard app.slug == "vonage", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let apiKey = self.vonageAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let apiSecret = self.vonageAPISecretDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard apiKey.range(of: #"^[A-Za-z0-9]{4,32}$"#, options: .regularExpression) != nil,
        apiSecret.count >= 8, apiSecret.count <= 25,
        apiSecret.range(of: "[a-z]", options: .regularExpression) != nil,
        apiSecret.range(of: "[A-Z]", options: .regularExpression) != nil,
        apiSecret.range(of: "[0-9]", options: .regularExpression) != nil,
        !apiSecret.contains("\r"), !apiSecret.contains("\n")
      else {
        throw RelayError(
          .invalidInput,
          "Enter one valid Vonage API key and an 8–25 character dedicated secondary secret containing upper case, lower case, and a digit."
        )
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "vonage", "displayName": "Vonage API account \(apiKey.suffix(4))",
          "authType": "api_key",
          "credentials": ["VONAGE_API_KEY": apiKey, "VONAGE_API_SECRET": apiSecret],
          "selectedCapabilities": ["account_balance_read"],
        ]
      )
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Vonage connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/vonage/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String) ?? "Vonage rejected this API key and secondary secret.")
      }
      self.vonageAPIKeyDraft = ""
      self.vonageAPISecretDraft = ""
      self.vonageConnectionStatus = "Vonage connected with one fixed EUR balance read."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectVonageConnection(_ connectionId: RelayId) {
    vonageSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func setVonageAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-vonage-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "vonage", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == "vonage",
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .userOwned, connection.grantedScopes.isEmpty,
        connection.health.diagnostics["keyValidated"]?.bool == true,
        connection.health.diagnostics["dedicatedSecondarySecretRequired"]?.bool == true,
        connection.health.diagnostics["fullAccountSecretReadSurfaceOnly"]?.bool == true,
        connection.health.diagnostics["basicAuthentication"]?.bool == true,
        connection.health.diagnostics["canonicalNexmoOnly"]?.bool == true,
        connection.health.diagnostics["financialReadOnly"]?.bool == true,
        connection.health.diagnostics["balanceCurrency"]?.string == "EUR",
        connection.health.diagnostics["maxResponseBytes"]?.number == 65_536,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready encrypted Vonage dedicated-secret connection is required before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "vonage" && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: ["source": .string("applications-vonage-agent-switch")],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(), redactionStatus: "provider-content-not-stored"))
        self.vonageConnectionStatus = "Agent connected to the one fixed Vonage balance read."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.vonageConnectionStatus = "Agent disconnected from Vonage."
      }
      self.vonageSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteVonageConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-vonage-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "vonage", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "vonage" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/vonage/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.vonageSelectedConnectionId = ""
      self.vonageConnectionStatus =
        "\(deleted.accountLabel ?? "Vonage API account") disconnected and Relay's encrypted credential copy deleted. Revoke the dedicated secondary secret in Vonage Dashboard API Settings."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func testVonageConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-vonage-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "vonage", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/vonage/connections/\(remoteId)/health")
      self.vonageConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Vonage API key/secondary-secret health check passed."
          : "Vonage requires replacement credentials.")
      self.vonageSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveMessageBirdRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-messagebird-access-key", refresh: .applications) {
      guard app.slug == "messagebird", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let organizationId = self.messageBirdOrganizationIDDraft.trimmingCharacters(
        in: .whitespacesAndNewlines
      ).lowercased()
      let workspaceId = self.messageBirdWorkspaceIDDraft.trimmingCharacters(
        in: .whitespacesAndNewlines
      ).lowercased()
      let accessKey = self.messageBirdAccessKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let uuidPattern =
        #"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"#
      guard organizationId.range(of: uuidPattern, options: .regularExpression) != nil,
        workspaceId.range(of: uuidPattern, options: .regularExpression) != nil,
        accessKey.count >= 16, accessKey.count <= 512,
        accessKey.rangeOfCharacter(from: .whitespacesAndNewlines) == nil
      else {
        throw RelayError(
          .invalidInput,
          "Enter valid Bird organization/workspace UUIDs and one dedicated AccessKey without whitespace."
        )
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "messagebird", "displayName": "Bird workspace \(workspaceId.suffix(4))",
          "authType": "api_key",
          "credentials": [
            "MESSAGEBIRD_ORGANIZATION_ID": organizationId, "MESSAGEBIRD_WORKSPACE_ID": workspaceId,
            "MESSAGEBIRD_ACCESS_KEY": accessKey,
          ], "selectedCapabilities": ["workspace_status_read"],
        ]
      )
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the Bird connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/messagebird/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput,
          (health["message"] as? String)
            ?? "Bird rejected this organization, workspace, or AccessKey binding.")
      }
      self.messageBirdOrganizationIDDraft = ""
      self.messageBirdWorkspaceIDDraft = ""
      self.messageBirdAccessKeyDraft = ""
      self.messageBirdConnectionStatus = "Bird connected with one fixed workspace-status read."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectMessageBirdConnection(_ connectionId: RelayId) {
    messageBirdSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func setMessageBirdAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-messagebird-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "messagebird", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == "messagebird",
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .userOwned, connection.grantedScopes.isEmpty,
        connection.health.diagnostics["accessKeyValidated"]?.bool == true,
        connection.health.diagnostics["dedicatedRoleBoundKeyRequired"]?.bool == true,
        connection.health.diagnostics["selectedWorkspaceMetadataOnly"]?.bool == true,
        connection.health.diagnostics["accessKeyAuthentication"]?.bool == true,
        connection.health.diagnostics["canonicalBirdOnly"]?.bool == true,
        connection.health.diagnostics["customerContentBlocked"]?.bool == true,
        connection.health.diagnostics["maxResponseBytes"]?.number == 65_536,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready encrypted Bird least-privilege AccessKey connection is required before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "messagebird" && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: ["source": .string("applications-messagebird-agent-switch")],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(), redactionStatus: "provider-content-not-stored"))
        self.messageBirdConnectionStatus =
          "Agent connected to the one fixed Bird workspace-status read."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.messageBirdConnectionStatus = "Agent disconnected from Bird."
      }
      self.messageBirdSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteMessageBirdConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-messagebird-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "messagebird", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "messagebird" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/messagebird/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.messageBirdSelectedConnectionId = ""
      self.messageBirdConnectionStatus =
        "\(deleted.accountLabel ?? "Bird workspace") disconnected and Relay's encrypted credential copy deleted. Delete the dedicated AccessKey in Bird Security settings."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func testMessageBirdConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-messagebird-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "messagebird", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/messagebird/connections/\(remoteId)/health")
      self.messageBirdConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Bird AccessKey workspace health check passed."
          : "Bird requires replacement credentials or a narrower View-only role.")
      self.messageBirdSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveFREDRailwayConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-fred-api-key", refresh: .applications) {
      guard app.slug == "fred", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let apiKey = self.fredAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      guard apiKey.range(of: "^[a-z0-9]{32}$", options: .regularExpression) != nil else {
        throw RelayError(.invalidInput, "Enter your 32-character lowercase FRED API key.")
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connections",
        body: [
          "appSlug": "fred", "displayName": "FRED API key \(apiKey.suffix(4))",
          "authType": "api_key", "credentials": ["FRED_API_KEY": apiKey],
          "selectedCapabilities": ["series_search", "series_observations_read"],
        ]
      )
      guard let connectionId = response["id"] as? String else {
        throw RelayError(.internalError, "Relay did not return the FRED connection ID.")
      }
      let health = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/fred/connections/\(connectionId)/health")
      guard (health["status"] as? String) == "ready" else {
        throw RelayError(
          .invalidInput, (health["message"] as? String) ?? "FRED rejected this API key.")
      }
      self.fredAPIKeyDraft = ""
      self.fredConnectionStatus = "FRED connected with two fixed bounded reads."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectFREDConnection(_ connectionId: RelayId) {
    fredSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func setFREDAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-fred-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "fred", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == "fred",
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .userOwned, connection.grantedScopes.isEmpty,
        connection.health.diagnostics["apiKeyValidated"]?.bool == true,
        connection.health.diagnostics["publicEconomicDataReadOnly"]?.bool == true,
        connection.health.diagnostics["fixedSeriesRoutesOnly"]?.bool == true,
        connection.health.diagnostics["queryParameterAuthentication"]?.bool == true,
        connection.health.diagnostics["maxSeriesResults"]?.number == 10,
        connection.health.diagnostics["maxObservationResults"]?.number == 25,
        connection.health.diagnostics["maxResponseBytes"]?.number == 262_144,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready encrypted FRED API-key connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "fred" && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: ["source": .string("applications-fred-agent-switch")],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(), redactionStatus: "provider-content-not-stored"))
        self.fredConnectionStatus = "Agent connected to the two fixed FRED reads."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.fredConnectionStatus = "Agent disconnected from FRED."
      }
      self.fredSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteFREDConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-fred-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "fred", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "fred" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/fred/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.fredSelectedConnectionId = ""
      self.fredConnectionStatus =
        "\(deleted.accountLabel ?? "FRED API key") disconnected and Relay's encrypted copy deleted. Replace or revoke the key from your FRED account."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func testFREDConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-fred-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "fred", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/fred/connections/\(remoteId)/health")
      self.fredConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "FRED API-key health check passed." : "FRED requires a replacement API key.")
      self.fredSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startLINEOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-line-oauth", refresh: .applications) {
      guard app.slug == "line", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST", relativePath: "connectors/line/oauth/start",
        body: ["returnTo": "https://relayconsole.work/app?marketplace_app=line"])
      guard let raw = response["authorizationUrl"] as? String, let url = URL(string: raw),
        url.scheme == "https", url.host?.lowercased() == "access.line.me"
      else {
        throw RelayError(.internalError, "Railway returned an invalid LINE authorization URL.")
      }
      NSWorkspace.shared.open(url)
      self.lineConnectionStatus =
        "LINE authorization opened. Railway retains state, nonce, S256 PKCE and rotating OAuth tokens."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectLINEConnection(_ connectionId: RelayId) {
    lineSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setLINEAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-line-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "line", let services = self.services, let workspace = self.workspace,
        let connection = self.selectedProviderConnection, connection.appSlug == "line",
        connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned,
        Set(connection.grantedScopes) == Set(["profile", "openid"]),
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["stateVerified"]?.bool == true,
        connection.health.diagnostics["nonceVerified"]?.bool == true,
        connection.health.diagnostics["pkceS256"]?.bool == true,
        connection.health.diagnostics["idTokenVerified"]?.bool == true,
        connection.health.diagnostics["subjectBound"]?.bool == true,
        connection.health.diagnostics["lineLoginOnly"]?.bool == true,
        connection.health.diagnostics["messagingAuthority"]?.bool == false,
        connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready OIDC-bound LINE Login profile connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "line" && self.isActiveMarketplaceInstall($0)
      }
      if enabled && existing == nil {
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: ["source": .string("applications-line-agent-switch")],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(), redactionStatus: "provider-content-not-stored"))
        self.lineConnectionStatus = "Agent connected with read-only LINE profile authority."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.lineConnectionStatus = "Agent disconnected from LINE."
      }
      self.lineSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteLINEConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-line-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "line", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "line" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/line/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.lineSelectedConnectionId = ""
      self.lineConnectionStatus =
        "\(deleted.accountLabel ?? "LINE user") revoked, disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func testLINEConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-line-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "line", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/line/connections/\(remoteId)/health")
      self.lineConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "LINE Login profile health check passed." : "LINE requires reauthorization.")
      self.lineSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startTwistOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-twist-oauth", refresh: .applications) {
      guard app.slug == "twist", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/twist/oauth/start",
        body: ["returnTo": "https://relayconsole.work/app?marketplace_app=twist"])
      guard let raw = response["authorizationUrl"] as? String,
        let url = URL(string: raw), url.scheme == "https",
        url.host?.lowercased() == "twist.com"
      else {
        throw RelayError(.internalError, "Railway returned an invalid Twist authorization URL.")
      }
      NSWorkspace.shared.open(url)
      self.twistConnectionStatus =
        "Twist authorization opened. Railway retains the confidential client credentials, OAuth state, and user token."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectTwistConnection(_ connectionId: RelayId) {
    twistSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setTwistAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-twist-agent-\(agentId)", refresh: .applications) {
      let requiredScopes = Set([
        "user:read", "workspaces:read", "channels:read", "threads:read", "comments:read",
      ])
      guard app.slug == "twist", let services = self.services,
        let workspace = self.workspace,
        let connection = self.selectedProviderConnection,
        connection.appSlug == "twist", connection.status == .connected,
        connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned,
        Set(connection.grantedScopes) == requiredScopes,
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["stateVerified"]?.bool == true,
        connection.health.diagnostics["userVerified"]?.bool == true,
        connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true,
        connection.health.diagnostics["readOnlyScopes"]?.bool == true,
        connection.health.diagnostics["automaticRetry"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready read-only Twist user connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "twist" && self.isActiveMarketplaceInstall($0)
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
            metadata: ["source": .string("applications-twist-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-content-not-stored"))
        self.twistConnectionStatus =
          "Agent connected with bounded read-only Twist thread authority."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.twistConnectionStatus = "Agent disconnected from Twist."
      }
      self.twistSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteTwistConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-twist-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "twist", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "twist" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/twist/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.twistSelectedConnectionId = ""
      self.twistConnectionStatus =
        "\(deleted.accountLabel ?? "Twist user") disconnected and deleted. Remove the integration in Twist to revoke upstream access."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func testTwistConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-twist-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "twist", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/twist/connections/\(remoteId)/health")
      self.twistConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Twist connected-user health check passed."
          : "Twist requires reauthorization.")
      self.twistSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startZohoMailOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-zoho-mail-oauth", refresh: .applications) {
      guard app.slug == "zoho-mail", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/zoho-mail/oauth/start",
        body: ["returnTo": "https://relayconsole.work/app?marketplace_app=zoho-mail"])
      let allowedHosts = Set([
        "accounts.zoho.com", "accounts.zoho.eu", "accounts.zoho.in",
        "accounts.zoho.com.au", "accounts.zoho.jp", "accounts.zohocloud.ca",
        "accounts.zoho.com.cn", "accounts.zoho.ae", "accounts.zoho.sa",
      ])
      guard let raw = response["authorizationUrl"] as? String,
        let url = URL(string: raw), url.scheme == "https",
        let host = url.host?.lowercased(), allowedHosts.contains(host)
      else {
        throw RelayError(
          .internalError, "Railway returned an invalid regional Zoho authorization URL.")
      }
      NSWorkspace.shared.open(url)
      self.zohoMailConnectionStatus =
        "Zoho authorization opened. Railway retains OAuth state, the regional authority, client secret, refresh token, and access token."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectZohoMailConnection(_ connectionId: RelayId) {
    zohoMailSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func setZohoMailAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-zoho-mail-agent-\(agentId)", refresh: .applications) {
      let requiredScopes = Set([
        "ZohoMail.accounts.READ", "ZohoMail.folders.READ", "ZohoMail.messages.READ",
      ])
      guard app.slug == "zoho-mail", let services = self.services,
        let workspace = self.workspace,
        let connection = self.selectedProviderConnection,
        connection.appSlug == "zoho-mail", connection.status == .connected,
        connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned,
        Set(connection.grantedScopes) == requiredScopes,
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["stateVerified"]?.bool == true,
        connection.health.diagnostics["accountVerified"]?.bool == true,
        connection.health.diagnostics["regionalAuthorityBound"]?.bool == true,
        connection.health.diagnostics["fixedEndpointsOnly"]?.bool == true,
        connection.health.diagnostics["readOnlyScopes"]?.bool == true,
        connection.health.diagnostics["writesEnabled"]?.bool == false,
        connection.health.diagnostics["attachmentDownloadsEnabled"]?.bool == false,
        connection.health.diagnostics["automaticPagination"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready regional, exact-scope, read-only Zoho Mail connection is required before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let existing = (self.exaInstallSnapshot?.installs ?? []).first {
        $0.agentId == agentId && $0.appSlug == "zoho-mail" && self.isActiveMarketplaceInstall($0)
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
            metadata: ["source": .string("applications-zoho-mail-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-content-not-stored"))
        self.zohoMailConnectionStatus =
          "Agent connected with four bounded read-only Zoho Mail wrappers."
      } else if !enabled, let existing {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: existing.id)
        self.zohoMailConnectionStatus = "Agent disconnected from Zoho Mail."
      }
      self.zohoMailSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteZohoMailConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-zoho-mail-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "zoho-mail", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "zoho-mail" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/zoho-mail/connections/\(remoteId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.zohoMailSelectedConnectionId = ""
      self.zohoMailConnectionStatus =
        "\(deleted.accountLabel ?? "Zoho Mail account") revoked, disconnected and deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func testZohoMailConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-zoho-mail-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "zoho-mail", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let remoteId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      let checked = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "GET",
        relativePath: "connectors/zoho-mail/connections/\(remoteId)/health")
      self.zohoMailConnectionStatus =
        (checked["message"] as? String)
        ?? ((checked["status"] as? String) == "ready"
          ? "Zoho Mail regional account health check passed."
          : "Zoho Mail requires reauthorization.")
      self.zohoMailSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteXTokenConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-x-token-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "x" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.connectionId == connection.id && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.xSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.xConnectionStatus =
        "\(deleted.accountLabel ?? "X token connection") deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setXAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-x-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "x" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(.invalidInput, "Select an X OAuth connection before assigning agents.")
      }
      guard connection.status == .connected, connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned,
        connection.grantedScopes == ProviderConnectionService.xRelayOwnedOAuthScopes,
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["userBound"]?.bool == true,
        connection.health.diagnostics["billingReady"]?.bool == true,
        connection.health.diagnostics["replyAutomationEnabled"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "A ready exact-scope Relay-owned X OAuth connection is required before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.xDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeXInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeXInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another X token connection.")
        }
        self.xConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "X token connection")."
        await Task.yield()
        let prepared = try await self.prepareXAgentForInstall(services: services, agentId: agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"),
            workspaceId: workspace.id,
            appId: app.id,
            appSlug: app.slug,
            connectionId: connection.id,
            targetAgentId: prepared.id,
            roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities,
            approvalProfileId: nil,
            runtimeFormat: prepared.binding.runtimeType,
            targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: [
              "source": .string("applications-x-agent-switch"),
              "requestedAgentId": .string(prepared.id),
              "selectedConnectionId": .string(connection.id),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.recordUserManagedRuntimeRestartRequired(
          services: services, agent: prepared, reason: "X connection changed")
        self.xConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "X token connection")."
      } else {
        guard let install = self.activeXInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.xConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "X token connection")."
        await Task.yield()
        let agent = try? services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        if let agent {
          self.recordUserManagedRuntimeRestartRequired(
            services: services, agent: agent, reason: "X connection changed")
        }
        self.xConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "X token connection")."
      }
      self.xSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startLinkedInOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-linkedin-oauth", refresh: .applications) {
      guard app.slug == "linkedin" else { return self.selectedThreadId }
      guard let origin = ProcessInfo.processInfo.environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(.unsupported, "LinkedIn must use the authenticated Railway OAuth broker.")
      }
      throw RelayError(
        .unsupported,
        "LinkedIn Relay-owned OAuth products, production credentials, exact HTTPS callback, token exchange/revocation, and reauthorization lifecycle are not deployed on Railway yet. Desktop will not handle the client secret, code exchange, manual tokens, or loopback callbacks."
      )
    }
  }
  func selectLinkedInConnection(_ connectionId: RelayId) {
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func saveLinkedInManualAccessToken(for app: MarketplaceCatalogApp) {
    runAction("save-linkedin-manual-token", refresh: .applications) {
      guard app.slug == "linkedin" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let connectionName = self.linkedinTokenConnectionNameDraft.nilIfEmpty
      let connection = try await services.providerConnections.connectLinkedInManualAccessToken(
        context: self.chatContext(workspaceId: workspace.id),
        appIdOrSlug: app.id,
        clientId: self.linkedinClientIdDraft,
        clientSecret: self.linkedinClientSecretDraft,
        accessToken: self.linkedinAccessTokenDraft,
        refreshToken: self.linkedinRefreshTokenDraft.nilIfEmpty,
        expiresAt: self.linkedinTokenExpiresAtDraft.nilIfEmpty,
        displayName: connectionName
      )
      self.linkedinAccessTokenDraft = ""
      self.linkedinClientIdDraft = ""
      self.linkedinClientSecretDraft = ""
      self.linkedinRefreshTokenDraft = ""
      self.linkedinTokenExpiresAtDraft = ""
      self.linkedinTokenConnectionNameDraft = ""
      self.linkedinConnectionStatus =
        "\(connection.accountLabel ?? "Manual LinkedIn token") saved. LinkedIn verified the token and required posting scope."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteLinkedInOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-linkedin-token-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "linkedin" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "linkedin" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.linkedinConnectionStatus =
        "\(deleted.accountLabel ?? "LinkedIn member") revoked and deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setLinkedInAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-linkedin-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "linkedin" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection,
        connection.appSlug == "linkedin", connection.status == .connected,
        connection.health.state == .ready,
        connection.credentialOwnership == .relayOwned,
        connection.grantedScopes == ProviderConnectionService.linkedInRelayOwnedOAuthScopes,
        connection.health.diagnostics["memberVerified"]?.bool == true,
        connection.health.diagnostics["railwayCallbackOnly"]?.bool == true,
        connection.health.diagnostics["emailScopeEnabled"]?.bool == false,
        connection.health.diagnostics["memberSocialReadEnabled"]?.bool == false,
        connection.health.diagnostics["commentsLikesEnabled"]?.bool == false,
        connection.health.diagnostics["mediaOrganizationEnabled"]?.bool == false,
        connection.health.diagnostics["searchScrapingEnabled"]?.bool == false,
        connection.health.diagnostics["rawToolsEnabled"]?.bool == false
      else {
        throw RelayError(
          .invalidInput,
          "Connect an exact-scope ready LinkedIn member through Railway before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.linkedinDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeLinkedInInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeLinkedInInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput,
            "\(displayName) is already assigned to another LinkedIn member connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.linkedinConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "LinkedIn token")."
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
              "source": .string("applications-linkedin-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-social-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.linkedinConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "LinkedIn token")."
      } else {
        guard
          let install = self.activeLinkedInInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.linkedinConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "LinkedIn token")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.linkedinConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "LinkedIn token")."
      }
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveGmailOAuthCredentials(for app: MarketplaceCatalogApp) {
    runAction("save-gmail-oauth-credentials", refresh: .applications) {
      guard app.slug == "gmail" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let connection = try services.providerConnections.saveGmailOAuthCredentials(
        context: self.chatContext(workspaceId: workspace.id),
        appIdOrSlug: app.id,
        clientId: self.gmailClientIdDraft,
        clientSecret: self.gmailClientSecretDraft,
        refreshToken: self.gmailRefreshTokenDraft,
        accessToken: self.gmailAccessTokenDraft.nilIfEmpty,
        accountEmail: self.gmailAccountEmailDraft.nilIfEmpty,
        displayName: self.gmailConnectionNameDraft.nilIfEmpty
      )
      self.gmailConnectionNameDraft = ""
      self.gmailClientIdDraft = ""
      self.gmailClientSecretDraft = ""
      self.gmailRefreshTokenDraft = ""
      self.gmailAccessTokenDraft = ""
      self.gmailAccountEmailDraft = ""
      self.gmailSelectedConnectionId = connection.id
      self.gmailConnectionStatus =
        "\(connection.accountLabel ?? "Gmail OAuth account") saved. No Relay-owned Google app or web callback is used."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startGmailRelayOwnedOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-gmail-relay-oauth", refresh: .applications) {
      guard app.slug == "gmail" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GOOGLE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = environment["CLAWCHAT_RAILWAY_ORIGIN"]?.nilIfEmpty,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Relay-owned Gmail OAuth needs RELAY_GOOGLE_OAUTH_CLIENT_ID plus the secure CLAWCHAT_RAILWAY_ORIGIN callback/token broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Gmail restricted-scope exchange, offline refresh, revoke, account binding, and disconnect broker is not deployed on Railway yet."
      )
    }
  }
}
