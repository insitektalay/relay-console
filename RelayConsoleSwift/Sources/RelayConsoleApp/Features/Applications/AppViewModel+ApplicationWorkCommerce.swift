import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func setLinearAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-linear-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "linear" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(.invalidInput, "Connect Linear before assigning agents.")
      }
      guard connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready Linear workspace or team before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.linearDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeLinearInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeLinearInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another Linear connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.linearConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Linear account")."
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
              "source": .string("applications-linear-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-linear-provider"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.linearConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Linear account")."
      } else {
        guard let install = self.activeLinearInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.linearConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Linear account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.linearConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Linear account")."
      }
      self.linearSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectAsanaConnection(_ connectionId: RelayId) {
    asanaSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func startAsanaOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-asana-oauth", refresh: .applications) {
      guard app.slug == "asana", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "Asana account",
        "returnTo": "https://relayconsole.work/app?marketplace_app=asana",
        "selectedCapabilities": ["task_read", "project_read", "task_draft", "task_write"],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "asana" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id,
        method: "POST", relativePath: "connectors/asana/oauth/start", body: body)
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "app.asana.com",
        authorizationURL.path == "/-/oauth_authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Asana authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.asanaConnectionStatus =
        "Asana authorization opened. Choose the account and workspaces you want agents to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteAsanaOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-asana-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "asana" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "asana" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.asanaSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnected =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.asanaConnectionStatus =
        "\(deleted.accountLabel ?? "Asana OAuth account") deleted.\(disconnected)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setAsanaAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-asana-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "asana" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Asana workspace before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.asanaDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeAsanaInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeAsanaInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another Asana connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.asanaConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Asana workspace")."
        await Task.yield()
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
              "source": .string("applications-asana-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-asana-task-writes"),
            ],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.asanaConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Asana workspace")."
      } else if let install = self.activeAsanaInstall(agentId: agentId, connectionId: connection.id)
      {
        self.asanaConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Asana workspace")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.asanaConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Asana workspace")."
      }
      self.asanaSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectTrelloConnection(_ connectionId: RelayId) {
    trelloSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func startTrelloOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-trello-oauth", refresh: .applications) {
      guard app.slug == "trello", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "Trello account",
        "returnTo": "https://relayconsole.work/app?marketplace_app=trello",
        "selectedCapabilities": ["board_read", "card_read", "card_draft", "card_write"],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "trello" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/trello/oauth/start", body: body)
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "trello.com",
        authorizationURL.path == "/1/OAuthAuthorizeToken"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Trello authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.trelloConnectionStatus =
        "Trello authorization opened. Approve access and Relay Console will finish the connection."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteTrelloConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-trello-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "trello", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "trello" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/trello/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.trelloSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.trelloConnectionStatus = "\(deleted.accountLabel ?? "Trello account") disconnected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setTrelloAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-trello-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "trello", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Trello account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.trelloDisplayName(agentId)
      if enabled {
        if self.activeTrelloInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeTrelloInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Trello connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.trelloConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Trello account")."
        await Task.yield()
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
            metadata: [
              "source": .string("applications-trello-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-trello-card-writes"),
            ],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          ))
        self.trelloConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Trello account")."
      } else if let install = self.activeTrelloInstall(agentId, connection.id) {
        self.trelloConnectionStatus = "Disconnecting \(name) from Trello."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.trelloConnectionStatus = "\(name) disconnected from Trello."
      }
      self.trelloSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectClickUpConnection(_ connectionId: RelayId) {
    clickUpSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func startClickUpOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-clickup-oauth", refresh: .applications) {
      guard app.slug == "clickup", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "ClickUp account",
        "returnTo": "https://relayconsole.work/app?marketplace_app=clickup",
        "selectedCapabilities": ["workspace_read", "task_read", "task_draft", "task_write"],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "clickup" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/clickup/oauth/start", body: body)
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "app.clickup.com",
        authorizationURL.path == "/api"
      else {
        throw RelayError(.internalError, "Relay returned an invalid ClickUp authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.clickUpConnectionStatus =
        "ClickUp authorization opened. Choose the Workspaces you want agents to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteClickUpOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-clickup-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "clickup", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "clickup" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/clickup/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.clickUpSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.clickUpConnectionStatus = "\(deleted.accountLabel ?? "ClickUp account") disconnected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setClickUpAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-clickup-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "clickup", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready ClickUp Workspace before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.clickUpDisplayName(agentId)
      if enabled {
        if self.activeClickUpInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeClickUpInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another ClickUp connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.clickUpConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "ClickUp Workspace")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id,
            targetAgentId: agent.id, roleId: app.roleManifest.primaryRole,
            selectedCapabilities: app.capabilities, approvalProfileId: nil,
            runtimeFormat: agent.binding.runtimeType, targetMode: .existingAgent,
            riskAcknowledged: true,
            metadata: [
              "source": .string("applications-clickup-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-clickup-task-writes"),
            ],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          ))
        self.clickUpConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "ClickUp Workspace")."
      } else if let install = self.activeClickUpInstall(agentId, connection.id) {
        self.clickUpConnectionStatus = "Disconnecting \(name) from ClickUp."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.clickUpConnectionStatus = "\(name) disconnected from ClickUp."
      }
      self.clickUpSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectMondayConnection(_ connectionId: RelayId) {
    mondaySelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func startMondayOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-monday-oauth", refresh: .applications) {
      guard app.slug == "monday-com", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "Monday.com account",
        "returnTo": "https://relayconsole.work/app?marketplace_app=monday-com",
        "selectedCapabilities": ["board_read", "item_read", "item_draft", "item_write"],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "monday-com" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/monday-com/oauth/start", body: body)
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "auth.monday.com",
        authorizationURL.path == "/oauth2/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Monday.com authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.mondayConnectionStatus =
        "Monday.com authorization opened. Choose the account you want agents to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteMondayOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-monday-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "monday-com", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "monday-com" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/monday-com/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.mondaySelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.mondayConnectionStatus = "\(deleted.accountLabel ?? "Monday.com account") disconnected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setMondayAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-monday-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "monday-com", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready Monday.com account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.mondayDisplayName(agentId)
      if enabled {
        if self.activeMondayInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeMondayInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Monday.com connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.mondayConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Monday.com account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-monday-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-monday-item-writes"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.mondayConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Monday.com account")."
      } else if let install = self.activeMondayInstall(agentId, connection.id) {
        self.mondayConnectionStatus = "Disconnecting \(name) from Monday.com."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.mondayConnectionStatus = "\(name) disconnected from Monday.com."
      }
      self.mondaySelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectAirtableConnection(_ connectionId: RelayId) {
    airtableSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func startAirtableOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-airtable-oauth", refresh: .applications) {
      guard app.slug == "airtable", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "Airtable account",
        "returnTo": "https://relayconsole.work/app?marketplace_app=airtable",
        "selectedCapabilities": ["base_read", "record_read", "record_draft", "record_write"],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "airtable" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/airtable/oauth/start", body: body)
      guard let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw), authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "airtable.com",
        authorizationURL.path == "/oauth2/v1/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Airtable authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.airtableConnectionStatus =
        "Airtable authorization opened. Choose the bases or Workspaces you want agents to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteAirtableOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-airtable-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "airtable", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "airtable" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/airtable/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.airtableSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.airtableConnectionStatus = "\(deleted.accountLabel ?? "Airtable account") disconnected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setAirtableAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-airtable-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "airtable", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Airtable grant before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.airtableDisplayName(agentId)
      if enabled {
        if self.activeAirtableInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeAirtableInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Airtable connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.airtableConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Airtable grant")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-airtable-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-airtable-record-writes"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.airtableConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Airtable grant")."
      } else if let install = self.activeAirtableInstall(agentId, connection.id) {
        self.airtableConnectionStatus = "Disconnecting \(name) from Airtable."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.airtableConnectionStatus = "\(name) disconnected from Airtable."
      }
      self.airtableSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectDropboxConnection(_ connectionId: RelayId) {
    dropboxSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func startDropboxOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-dropbox-oauth", refresh: .applications) {
      guard app.slug == "dropbox", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "Dropbox account",
        "returnTo": "https://relayconsole.work/app?marketplace_app=dropbox",
        "selectedCapabilities": ["account_read", "file_read", "file_draft", "file_write"],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "dropbox" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/dropbox/oauth/start", body: body)
      guard
        let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "www.dropbox.com",
        authorizationURL.path == "/oauth2/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Dropbox authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.dropboxConnectionStatus =
        "Dropbox authorization opened. Choose the account you want agents to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteDropboxOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-dropbox-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "dropbox", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "dropbox" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/dropbox/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.dropboxSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.dropboxConnectionStatus =
        "\(deleted.accountLabel ?? "Dropbox account") disconnected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setDropboxAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-dropbox-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "dropbox", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Dropbox account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.dropboxDisplayName(agentId)
      if enabled {
        if self.activeDropboxInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeDropboxInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Dropbox connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.dropboxConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Dropbox account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-dropbox-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-dropbox-entry-writes"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.dropboxConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Dropbox account")."
      } else if let install = self.activeDropboxInstall(agentId, connection.id) {
        self.dropboxConnectionStatus = "Disconnecting \(name) from Dropbox."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.dropboxConnectionStatus = "\(name) disconnected from Dropbox."
      }
      self.dropboxSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectBoxConnection(_ connectionId: RelayId) {
    boxSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func startBoxOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-box-oauth", refresh: .applications) {
      guard app.slug == "box", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      var body: [String: Any] = [
        "displayName": "Box account",
        "returnTo": "https://relayconsole.work/app?marketplace_app=box",
        "selectedCapabilities": ["user_read", "content_read", "content_draft", "content_write"],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "box" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/box/oauth/start", body: body)
      guard
        let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "account.box.com",
        authorizationURL.path == "/api/oauth2/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Box authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.boxConnectionStatus =
        "Box authorization opened. Choose the account you want agents to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteBoxOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-box-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "box", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "box" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/box/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.boxSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.boxConnectionStatus = "\(deleted.accountLabel ?? "Box account") disconnected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setBoxAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-box-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "box", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Box account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.boxDisplayName(agentId)
      if enabled {
        if self.activeBoxInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeBoxInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Box connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.boxConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Box account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-box-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-box-item-writes"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.boxConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Box account")."
      } else if let install = self.activeBoxInstall(agentId, connection.id) {
        self.boxConnectionStatus = "Disconnecting \(name) from Box."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.boxConnectionStatus = "\(name) disconnected from Box."
      }
      self.boxSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectFigmaConnection(_ connectionId: RelayId) {
    figmaSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func startFigmaOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-figma-oauth", refresh: .applications) {
      guard app.slug == "figma", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      var body: [String: Any] = [
        "displayName": "Figma account",
        "returnTo": "https://relayconsole.work/app?marketplace_app=figma",
        "selectedCapabilities": [
          "design_read", "project_library_read", "comment_management", "developer_handoff",
          "variable_management", "webhook_management",
        ],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "figma" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/figma/oauth/start", body: body)
      guard
        let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "www.figma.com",
        authorizationURL.path == "/oauth"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Figma authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.figmaConnectionStatus =
        "Figma authorization opened. Choose the account you want agents to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteFigmaOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-figma-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "figma", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "figma" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/figma/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.figmaSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.figmaConnectionStatus = "\(deleted.accountLabel ?? "Figma account") disconnected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setFigmaAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-figma-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "figma", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Figma user before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.figmaDisplayName(agentId)
      if enabled {
        if self.activeFigmaInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeFigmaInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Figma connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.figmaConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Figma user")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-figma-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-figma-comment-writes"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.figmaConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Figma user")."
      } else if let install = self.activeFigmaInstall(agentId, connection.id) {
        self.figmaConnectionStatus = "Disconnecting \(name) from Figma."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.figmaConnectionStatus = "\(name) disconnected from Figma."
      }
      self.figmaSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectMiroConnection(_ connectionId: RelayId) {
    miroSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func startMiroOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-miro-oauth", refresh: .applications) {
      guard app.slug == "miro", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      var body: [String: Any] = [
        "displayName": "Miro team",
        "returnTo": "https://relayconsole.work/app?marketplace_app=miro",
        "selectedCapabilities": [
          "board_read", "item_read", "item_draft", "item_write",
        ],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "miro" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/miro/oauth/start", body: body)
      guard
        let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "miro.com",
        authorizationURL.path == "/oauth/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Miro authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.miroConnectionStatus =
        "Miro authorization opened. Choose the team you want agents to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteMiroOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-miro-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "miro", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "miro" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/miro/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.miroSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.miroConnectionStatus = "\(deleted.accountLabel ?? "Miro team") disconnected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setMiroAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-miro-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "miro", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Miro team before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.miroDisplayName(agentId)
      if enabled {
        if self.activeMiroInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeMiroInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Miro connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.miroConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Miro team")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-miro-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-miro-board-item-writes"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.miroConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Miro team")."
      } else if let install = self.activeMiroInstall(agentId, connection.id) {
        self.miroConnectionStatus = "Disconnecting \(name) from Miro."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.miroConnectionStatus = "\(name) disconnected from Miro."
      }
      self.miroSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectCanvaConnection(_ connectionId: RelayId) {
    canvaSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func startCanvaOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-canva-oauth", refresh: .applications) {
      guard app.slug == "canva", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      var body: [String: Any] = [
        "displayName": "Canva team",
        "returnTo": "https://relayconsole.work/app?marketplace_app=canva",
        "selectedCapabilities": [
          "identity", "design_read", "folder_read", "design_draft", "design_write",
        ],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "canva" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/canva/oauth/start", body: body)
      guard
        let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "www.canva.com",
        authorizationURL.path == "/api/oauth/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Canva authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.canvaConnectionStatus =
        "Canva authorization opened. Choose the account and team you want agents to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteCanvaOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-canva-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "canva", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "canva" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/canva/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.canvaSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.canvaConnectionStatus = "\(deleted.accountLabel ?? "Canva team") disconnected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setCanvaAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-canva-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "canva", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Canva team before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.canvaDisplayName(agentId)
      if enabled {
        if self.activeCanvaInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeCanvaInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Canva connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.canvaConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Canva team")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-canva-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-canva-stable-design-create"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.canvaConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Canva team")."
      } else if let install = self.activeCanvaInstall(agentId, connection.id) {
        self.canvaConnectionStatus = "Disconnecting \(name) from Canva."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.canvaConnectionStatus = "\(name) disconnected from Canva."
      }
      self.canvaSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectWebflowConnection(_ connectionId: RelayId) {
    webflowSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func startWebflowOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-webflow-oauth", refresh: .applications) {
      guard app.slug == "webflow", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "Webflow sites",
        "returnTo": "https://relayconsole.work/app?marketplace_app=webflow",
        "selectedCapabilities": [
          "site_read", "collection_read", "item_read", "item_draft", "item_update",
          "item_publish",
        ],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "webflow" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/webflow/oauth/start", body: body)
      guard
        let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "webflow.com",
        authorizationURL.path == "/oauth/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Webflow authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.webflowConnectionStatus =
        "Webflow authorization opened. Choose the sites you want agents to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteWebflowOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-webflow-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "webflow", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "webflow" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/webflow/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.webflowSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.webflowConnectionStatus = "\(deleted.accountLabel ?? "Webflow sites") disconnected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setWebflowAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-webflow-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "webflow", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready Webflow App grant before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.webflowDisplayName(agentId)
      if enabled {
        if self.activeWebflowInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeWebflowInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Webflow connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.webflowConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Webflow App grant")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-webflow-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-webflow-staged-item-writes"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.webflowConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Webflow App grant")."
      } else if let install = self.activeWebflowInstall(agentId, connection.id) {
        self.webflowConnectionStatus = "Disconnecting \(name) from Webflow."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.webflowConnectionStatus = "\(name) disconnected from Webflow."
      }
      self.webflowSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectWordPressComConnection(_ connectionId: RelayId) {
    wordpressComSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func startWordPressComOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-wordpress-com-oauth", refresh: .applications) {
      guard app.slug == "wordpress-com", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "WordPress.com site",
        "returnTo": "https://relayconsole.work/app?marketplace_app=wordpress-com",
        "selectedCapabilities": [
          "site_read", "post_read", "post_draft", "post_update", "post_publish",
        ],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "wordpress-com" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/wordpress-com/oauth/start", body: body)
      guard
        let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "public-api.wordpress.com",
        authorizationURL.path == "/oauth2/authorize"
      else {
        throw RelayError(
          .internalError, "Relay returned an invalid WordPress.com authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.wordpressComConnectionStatus =
        "WordPress.com authorization opened. Choose the site you want agents to use."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func deleteWordPressComOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-wordpress-com-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "wordpress-com", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "wordpress-com" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/wordpress-com/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.wordpressComSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.wordpressComConnectionStatus =
        "\(deleted.accountLabel ?? "WordPress.com site") disconnected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setWordPressComAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-wordpress-com-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "wordpress-com", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready WordPress.com site before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.wordpressComDisplayName(agentId)
      if enabled {
        if self.activeWordPressComInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeWordPressComInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another WordPress.com connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.wordpressComConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "WordPress.com site")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-wordpress-com-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-wordpress-com-draft-writes"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.wordpressComConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "WordPress.com site")."
      } else if let install = self.activeWordPressComInstall(agentId, connection.id) {
        self.wordpressComConnectionStatus = "Disconnecting \(name) from WordPress.com."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.wordpressComConnectionStatus = "\(name) disconnected from WordPress.com."
      }
      self.wordpressComSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startContentfulOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-contentful-oauth", refresh: .applications) {
      guard app.slug == "contentful", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      var body: [String: Any] = [
        "displayName": "Contentful account",
        "returnTo": "https://relayconsole.work/app?marketplace_app=contentful",
        "selectedCapabilities": [
          "space_read", "model_read", "entry_read", "entry_draft", "entry_update",
          "entry_publish",
        ],
      ]
      if let connection = self.selectedProviderConnection, connection.appSlug == "contentful" {
        body["connectionId"] = connection.id
      }
      let response = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/contentful/oauth/start", body: body)
      guard
        let raw = response["authorizationUrl"] as? String,
        let authorizationURL = URL(string: raw),
        authorizationURL.scheme == "https",
        authorizationURL.host?.lowercased() == "be.contentful.com",
        authorizationURL.path == "/oauth/authorize"
      else {
        throw RelayError(.internalError, "Relay returned an invalid Contentful authorization URL.")
      }
      NSWorkspace.shared.open(authorizationURL)
      self.contentfulConnectionStatus =
        "Contentful sign-in opened. Approve access and you will return automatically."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectContentfulConnection(_ connectionId: RelayId) {
    contentfulSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteContentfulOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-contentful-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "contentful", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "contentful" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id, localConnectionId: connection.id)
      _ = try await services.cloudSync.railwayMarketplaceRequest(
        localWorkspaceId: workspace.id, method: "POST",
        relativePath: "connectors/contentful/connections/\(remoteConnectionId)/disconnect")
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.contentfulSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.contentfulConnectionStatus =
        "\(deleted.accountLabel ?? "Contentful account") disconnected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setContentfulAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-contentful-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "contentful", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Contentful space before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.contentfulDisplayName(agentId)
      if enabled {
        if self.activeContentfulInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeContentfulInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Contentful connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.contentfulConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Contentful space")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-contentful-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string(
                "approval-gated-contentful-versioned-entry-writes"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.contentfulConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Contentful space")."
      } else if let install = self.activeContentfulInstall(agentId, connection.id) {
        self.contentfulConnectionStatus = "Disconnecting \(name) from Contentful."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.contentfulConnectionStatus = "\(name) disconnected from Contentful."
      }
      self.contentfulSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectShopifyConnection(_ connectionId: RelayId) {
    shopifySelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteShopifyOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-shopify-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "shopify", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "shopify" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.shopifySelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.shopifyConnectionStatus = "\(deleted.accountLabel ?? "Shopify shop") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setShopifyAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-shopify-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "shopify", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Shopify shop before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.shopifyDisplayName(agentId)
      if enabled {
        if self.activeShopifyInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeShopifyInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Shopify connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.shopifyConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Shopify shop")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-shopify-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string(
                "approval-gated-shopify-draft-activate-publish"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.shopifyConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Shopify shop")."
      } else if let install = self.activeShopifyInstall(agentId, connection.id) {
        self.shopifyConnectionStatus = "Disconnecting \(name) from Shopify."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.shopifyConnectionStatus = "\(name) disconnected from Shopify."
      }
      self.shopifySelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectWooCommerceConnection(_ connectionId: RelayId) {
    wooCommerceSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteWooCommerceApplicationConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-woocommerce-application-connection-\(connection.id)", refresh: .applications)
    {
      guard app.slug == "woocommerce", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "woocommerce" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.wooCommerceSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.wooCommerceConnectionStatus = "\(deleted.accountLabel ?? "WooCommerce store") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setWooCommerceAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-woocommerce-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "woocommerce", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready WooCommerce store before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.wooCommerceDisplayName(agentId)
      if enabled {
        if self.activeWooCommerceInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeWooCommerceInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another WooCommerce connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.wooCommerceConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "WooCommerce store")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-woocommerce-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("approval-gated-woocommerce-draft-publish"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.wooCommerceConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "WooCommerce store")."
      } else if let install = self.activeWooCommerceInstall(agentId, connection.id) {
        self.wooCommerceConnectionStatus = "Disconnecting \(name) from WooCommerce."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.wooCommerceConnectionStatus = "\(name) disconnected from WooCommerce."
      }
      self.wooCommerceSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectStripeConnection(_ connectionId: RelayId) {
    stripeSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteStripeOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-stripe-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "stripe", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "stripe" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.stripeSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.stripeConnectionStatus = "\(deleted.accountLabel ?? "Stripe account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setStripeAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-stripe-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "stripe", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Stripe account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.stripeDisplayName(agentId)
      if enabled {
        if self.activeStripeInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeStripeInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Stripe connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.stripeConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Stripe account")."
        await Task.yield()
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: [
              "source": .string("applications-stripe-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string("approval-gated-redacted-payment-intent-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.stripeConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Stripe account")."
      } else if let install = self.activeStripeInstall(agentId, connection.id) {
        self.stripeConnectionStatus = "Disconnecting \(name) from Stripe."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.stripeConnectionStatus = "\(name) disconnected from Stripe."
      }
      self.stripeSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
}
