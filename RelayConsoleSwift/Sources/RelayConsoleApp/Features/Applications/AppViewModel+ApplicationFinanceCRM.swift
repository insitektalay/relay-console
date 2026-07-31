import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func selectXeroConnection(_ connectionId: RelayId) {
    xeroSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteXeroOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-xero-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "xero", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "xero" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.xeroSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.xeroConnectionStatus = "\(deleted.accountLabel ?? "Xero organisation") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setXeroAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-xero-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "xero", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready Xero organisation before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.xeroDisplayName(agentId)
      if enabled {
        if self.activeXeroInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeXeroInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Xero organisation.")
        }
        let agent = try services.data.getAgent(agentId)
        self.xeroConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Xero organisation")."
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
              "source": .string("applications-xero-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string("approval-gated-redacted-invoice-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.xeroConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Xero organisation")."
      } else if let install = self.activeXeroInstall(agentId, connection.id) {
        self.xeroConnectionStatus = "Disconnecting \(name) from Xero."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.xeroConnectionStatus = "\(name) disconnected from Xero."
      }
      self.xeroSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectQuickBooksConnection(_ connectionId: RelayId) {
    quickBooksSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteQuickBooksOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-quickbooks-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "quickbooks", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "quickbooks" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.quickBooksSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.quickBooksConnectionStatus = "\(deleted.accountLabel ?? "QuickBooks company") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setQuickBooksAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-quickbooks-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "quickbooks", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready QuickBooks company before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.quickBooksDisplayName(agentId)
      if enabled {
        if self.activeQuickBooksInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeQuickBooksInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another QuickBooks company.")
        }
        let agent = try services.data.getAgent(agentId)
        self.quickBooksConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "QuickBooks company")."
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
              "source": .string("applications-quickbooks-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string("approval-gated-redacted-invoice-balance-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.quickBooksConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "QuickBooks company")."
      } else if let install = self.activeQuickBooksInstall(agentId, connection.id) {
        self.quickBooksConnectionStatus = "Disconnecting \(name) from QuickBooks Online."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.quickBooksConnectionStatus = "\(name) disconnected from QuickBooks Online."
      }
      self.quickBooksSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectFreshBooksConnection(_ connectionId: RelayId) {
    freshBooksSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteFreshBooksOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-freshbooks-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "freshbooks", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "freshbooks" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.freshBooksSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.freshBooksConnectionStatus = "\(deleted.accountLabel ?? "FreshBooks business") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setFreshBooksAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-freshbooks-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "freshbooks", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready FreshBooks business before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.freshBooksDisplayName(agentId)
      if enabled {
        if self.activeFreshBooksInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeFreshBooksInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another FreshBooks business.")
        }
        let agent = try services.data.getAgent(agentId)
        self.freshBooksConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "FreshBooks business")."
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
              "source": .string("applications-freshbooks-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string("approval-gated-redacted-invoice-money-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.freshBooksConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "FreshBooks business")."
      } else if let install = self.activeFreshBooksInstall(agentId, connection.id) {
        self.freshBooksConnectionStatus = "Disconnecting \(name) from FreshBooks."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.freshBooksConnectionStatus = "\(name) disconnected from FreshBooks."
      }
      self.freshBooksSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectWaveConnection(_ connectionId: RelayId) {
    waveSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteWaveOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-wave-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "wave", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "wave" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.waveSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.waveConnectionStatus = "\(deleted.accountLabel ?? "Wave business") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setWaveAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-wave-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "wave", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Wave business before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.waveDisplayName(agentId)
      if enabled {
        if self.activeWaveInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeWaveInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Wave business.")
        }
        let agent = try services.data.getAgent(agentId)
        self.waveConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Wave business")."
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
              "source": .string("applications-wave-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string("approval-gated-redacted-invoice-money-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.waveConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Wave business")."
      } else if let install = self.activeWaveInstall(agentId, connection.id) {
        self.waveConnectionStatus = "Disconnecting \(name) from Wave."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.waveConnectionStatus = "\(name) disconnected from Wave."
      }
      self.waveSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectFreeAgentConnection(_ connectionId: RelayId) {
    freeAgentSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteFreeAgentOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-freeagent-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "freeagent", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "freeagent" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.freeAgentSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.freeAgentConnectionStatus = "\(deleted.accountLabel ?? "FreeAgent company") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setFreeAgentAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-freeagent-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "freeagent", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready FreeAgent company before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.freeAgentDisplayName(agentId)
      if enabled {
        if self.activeFreeAgentInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeFreeAgentInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another FreeAgent company.")
        }
        let agent = try services.data.getAgent(agentId)
        self.freeAgentConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "FreeAgent company")."
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
              "source": .string("applications-freeagent-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string("approval-gated-redacted-invoice-value-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.freeAgentConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "FreeAgent company")."
      } else if let install = self.activeFreeAgentInstall(agentId, connection.id) {
        self.freeAgentConnectionStatus = "Disconnecting \(name) from FreeAgent."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.freeAgentConnectionStatus = "\(name) disconnected from FreeAgent."
      }
      self.freeAgentSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectSalesforceConnection(_ connectionId: RelayId) {
    salesforceSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteSalesforceOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-salesforce-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "salesforce", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "salesforce" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.salesforceSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.salesforceConnectionStatus = "\(deleted.accountLabel ?? "Salesforce org") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setSalesforceAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-salesforce-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "salesforce", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Salesforce org before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.salesforceDisplayName(agentId)
      if enabled {
        if self.activeSalesforceInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeSalesforceInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Salesforce org.")
        }
        let agent = try services.data.getAgent(agentId)
        self.salesforceConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Salesforce org")."
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
              "source": .string("applications-salesforce-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string("approval-gated-bounded-account-opportunity-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.salesforceConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Salesforce org")."
      } else if let install = self.activeSalesforceInstall(agentId, connection.id) {
        self.salesforceConnectionStatus = "Disconnecting \(name) from Salesforce."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.salesforceConnectionStatus = "\(name) disconnected from Salesforce."
      }
      self.salesforceSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectHubSpotConnection(_ connectionId: RelayId) {
    hubSpotSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteHubSpotOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-hubspot-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "hubspot", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "hubspot" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.hubSpotSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.hubSpotConnectionStatus = "\(deleted.accountLabel ?? "HubSpot account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setHubSpotAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-hubspot-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "hubspot", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready HubSpot account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.hubSpotDisplayName(agentId)
      if enabled {
        if self.activeHubSpotInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeHubSpotInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another HubSpot account.")
        }
        let agent = try services.data.getAgent(agentId)
        self.hubSpotConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "HubSpot account")."
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
              "source": .string("applications-hubspot-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string("approval-gated-bounded-company-deal-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.hubSpotConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "HubSpot account")."
      } else if let install = self.activeHubSpotInstall(agentId, connection.id) {
        self.hubSpotConnectionStatus = "Disconnecting \(name) from HubSpot."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.hubSpotConnectionStatus = "\(name) disconnected from HubSpot."
      }
      self.hubSpotSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectPipedriveConnection(_ connectionId: RelayId) {
    pipedriveSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deletePipedriveOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-pipedrive-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "pipedrive", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "pipedrive" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.pipedriveSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.pipedriveConnectionStatus = "\(deleted.accountLabel ?? "Pipedrive company") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setPipedriveAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-pipedrive-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "pipedrive", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready Pipedrive company before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.pipedriveDisplayName(agentId)
      if enabled {
        if self.activePipedriveInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activePipedriveInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Pipedrive company.")
        }
        let agent = try services.data.getAgent(agentId)
        self.pipedriveConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Pipedrive company")."
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
              "source": .string("applications-pipedrive-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string("approval-gated-bounded-organization-deal-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.pipedriveConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Pipedrive company")."
      } else if let install = self.activePipedriveInstall(agentId, connection.id) {
        self.pipedriveConnectionStatus = "Disconnecting \(name) from Pipedrive."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.pipedriveConnectionStatus = "\(name) disconnected from Pipedrive."
      }
      self.pipedriveSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectCopperConnection(_ connectionId: RelayId) {
    copperSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteCopperOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-copper-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "copper", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "copper" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.copperSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.copperConnectionStatus = "\(deleted.accountLabel ?? "Copper account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setCopperAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-copper-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "copper", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Copper account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.copperDisplayName(agentId)
      if enabled {
        if self.activeCopperInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeCopperInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Copper account.")
        }
        let agent = try services.data.getAgent(agentId)
        self.copperConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Copper account")."
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
              "source": .string("applications-copper-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string("approval-gated-bounded-account-opportunity-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.copperConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Copper account")."
      } else if let install = self.activeCopperInstall(agentId, connection.id) {
        self.copperConnectionStatus = "Disconnecting \(name) from Copper."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.copperConnectionStatus = "\(name) disconnected from Copper."
      }
      self.copperSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectCloseConnection(_ connectionId: RelayId) {
    closeSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteCloseOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-close-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "close", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "close" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.closeSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.closeConnectionStatus = "\(deleted.accountLabel ?? "Close Organization") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setCloseAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-close-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "close", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready Close Organization before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.closeDisplayName(agentId)
      if enabled {
        if self.activeCloseInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeCloseInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Close Organization.")
        }
        let agent = try services.data.getAgent(agentId)
        self.closeConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Close Organization")."
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
              "source": .string("applications-close-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string(
                "approval-gated-bounded-organization-opportunity-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.closeConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Close Organization")."
      } else if let install = self.activeCloseInstall(agentId, connection.id) {
        self.closeConnectionStatus = "Disconnecting \(name) from Close."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.closeConnectionStatus = "\(name) disconnected from Close."
      }
      self.closeSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectZendeskConnection(_ connectionId: RelayId) {
    zendeskSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteZendeskOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-zendesk-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "zendesk", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "zendesk" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.zendeskSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.zendeskConnectionStatus =
        "\(deleted.accountLabel ?? "Zendesk Support instance") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setZendeskAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-zendesk-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "zendesk", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready Zendesk Support instance before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.zendeskDisplayName(agentId)
      if enabled {
        if self.activeZendeskInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeZendeskInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Zendesk Support instance.")
        }
        let agent = try services.data.getAgent(agentId)
        self.zendeskConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Zendesk Support instance")."
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
              "source": .string("applications-zendesk-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string("approval-gated-privacy-redacted-ticket-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.zendeskConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Zendesk Support instance")."
      } else if let install = self.activeZendeskInstall(agentId, connection.id) {
        self.zendeskConnectionStatus = "Disconnecting \(name) from Zendesk."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.zendeskConnectionStatus = "\(name) disconnected from Zendesk."
      }
      self.zendeskSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectIntercomConnection(_ connectionId: RelayId) {
    intercomSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteIntercomOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-intercom-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "intercom", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "intercom" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.intercomSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.intercomConnectionStatus = "\(deleted.accountLabel ?? "Intercom workspace") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setIntercomAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-intercom-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "intercom", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready Intercom workspace before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.intercomDisplayName(agentId)
      if enabled {
        if self.activeIntercomInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeIntercomInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Intercom workspace.")
        }
        let agent = try services.data.getAgent(agentId)
        self.intercomConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Intercom workspace")."
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
              "source": .string("applications-intercom-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string(
                "approval-gated-privacy-redacted-conversation-metadata-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.intercomConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Intercom workspace")."
      } else if let install = self.activeIntercomInstall(agentId, connection.id) {
        self.intercomConnectionStatus = "Disconnecting \(name) from Intercom."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.intercomConnectionStatus = "\(name) disconnected from Intercom."
      }
      self.intercomSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectHelpScoutConnection(_ connectionId: RelayId) {
    helpScoutSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteHelpScoutOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-help-scout-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "help-scout", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "help-scout" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.helpScoutSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.helpScoutConnectionStatus = "\(deleted.accountLabel ?? "Help Scout company") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setHelpScoutAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-help-scout-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "help-scout", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready Help Scout company before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.helpScoutDisplayName(agentId)
      if enabled {
        if self.activeHelpScoutInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeHelpScoutInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Help Scout company.")
        }
        let agent = try services.data.getAgent(agentId)
        self.helpScoutConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Help Scout company")."
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
              "source": .string("applications-help-scout-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "permissionPolicyBoundary": .string(
                "safe-approval-or-dangerously-skip-permissions"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.helpScoutConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Help Scout company")."
      } else if let install = self.activeHelpScoutInstall(agentId, connection.id) {
        self.helpScoutConnectionStatus = "Disconnecting \(name) from Help Scout."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.helpScoutConnectionStatus = "\(name) disconnected from Help Scout."
      }
      self.helpScoutSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectFrontConnection(_ connectionId: RelayId) {
    frontSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteFrontOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-front-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "front", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "front" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.frontSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.frontConnectionStatus = "\(deleted.accountLabel ?? "Front company") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setFrontAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-front-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "front", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Front company before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.frontDisplayName(agentId)
      if enabled {
        if self.activeFrontInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeFrontInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Front company.")
        }
        let agent = try services.data.getAgent(agentId)
        self.frontConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Front company")."
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
              "source": .string("applications-front-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "permissionPolicyBoundary": .string(
                "safe-approval-or-dangerously-skip-permissions"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.frontConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Front company")."
      } else if let install = self.activeFrontInstall(agentId, connection.id) {
        self.frontConnectionStatus = "Disconnecting \(name) from Front."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.frontConnectionStatus = "\(name) disconnected from Front."
      }
      self.frontSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectGrooveConnection(_ connectionId: RelayId) {
    grooveSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteGrooveConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-groove-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "groove", let services = self.services, let workspace = self.workspace
      else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "groove" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.grooveSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.grooveConnectionStatus = "\(deleted.accountLabel ?? "Groove account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setGrooveAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-groove-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "groove", let services = self.services, let workspace = self.workspace
      else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Groove account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.grooveDisplayName(agentId)
      if enabled {
        if self.activeGrooveInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeGrooveInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Groove account.")
        }
        let agent = try services.data.getAgent(agentId)
        self.grooveConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Groove account")."
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
              "source": .string("applications-groove-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "permissionPolicyBoundary": .string(
                "safe-approval-or-dangerously-skip-permissions"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.grooveConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Groove account")."
      } else if let install = self.activeGrooveInstall(agentId, connection.id) {
        self.grooveConnectionStatus = "Disconnecting \(name) from Groove."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.grooveConnectionStatus = "\(name) disconnected from Groove."
      }
      self.grooveSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectTeamworkConnection(_ connectionId: RelayId) {
    teamworkSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteTeamworkOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-teamwork-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "teamwork", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "teamwork" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.teamworkSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.teamworkConnectionStatus = "\(deleted.accountLabel ?? "Teamwork installation") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setTeamworkAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-teamwork-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "teamwork", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready Teamwork installation before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.teamworkDisplayName(agentId)
      if enabled {
        if self.activeTeamworkInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeTeamworkInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Teamwork installation.")
        }
        let agent = try services.data.getAgent(agentId)
        self.teamworkConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Teamwork installation")."
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
              "source": .string("applications-teamwork-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "permissionPolicyBoundary": .string(
                "safe-approval-or-dangerously-skip-permissions"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.teamworkConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Teamwork installation")."
      } else if let install = self.activeTeamworkInstall(agentId, connection.id) {
        self.teamworkConnectionStatus = "Disconnecting \(name) from Teamwork."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.teamworkConnectionStatus = "\(name) disconnected from Teamwork."
      }
      self.teamworkSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectBasecampConnection(_ connectionId: RelayId) {
    basecampSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteBasecampOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-basecamp-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "basecamp", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "basecamp" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.basecampSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.basecampConnectionStatus = "\(deleted.accountLabel ?? "Basecamp account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setBasecampAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-basecamp-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "basecamp", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Basecamp account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.basecampDisplayName(agentId)
      if enabled {
        if self.activeBasecampInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeBasecampInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Basecamp account.")
        }
        let agent = try services.data.getAgent(agentId)
        self.basecampConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Basecamp account")."
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
              "source": .string("applications-basecamp-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "permissionPolicyBoundary": .string(
                "safe-bounded-reads-full-api-approval-or-dangerously-skip"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.basecampConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Basecamp account")."
      } else if let install = self.activeBasecampInstall(agentId, connection.id) {
        self.basecampConnectionStatus = "Disconnecting \(name) from Basecamp."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.basecampConnectionStatus = "\(name) disconnected from Basecamp."
      }
      self.basecampSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectWrikeConnection(_ connectionId: RelayId) {
    wrikeSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteWrikeOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-wrike-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "wrike", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "wrike" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.wrikeSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.wrikeConnectionStatus = "\(deleted.accountLabel ?? "Wrike account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setWrikeAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-wrike-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "wrike", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Wrike account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.wrikeDisplayName(agentId)
      if enabled {
        if self.activeWrikeInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeWrikeInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Wrike account.")
        }
        let agent = try services.data.getAgent(agentId)
        self.wrikeConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Wrike account")."
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
              "source": .string("applications-wrike-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "permissionPolicyBoundary": .string(
                "safe-bounded-reads-full-api-approval-or-dangerously-skip"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.wrikeConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Wrike account")."
      } else if let install = self.activeWrikeInstall(agentId, connection.id) {
        self.wrikeConnectionStatus = "Disconnecting \(name) from Wrike."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.wrikeConnectionStatus = "\(name) disconnected from Wrike."
      }
      self.wrikeSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectSmartsheetConnection(_ connectionId: RelayId) {
    smartsheetSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteSmartsheetOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-smartsheet-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "smartsheet", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "smartsheet" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.smartsheetSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.smartsheetConnectionStatus = "\(deleted.accountLabel ?? "Smartsheet account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setSmartsheetAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-smartsheet-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "smartsheet", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready Smartsheet account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.smartsheetDisplayName(agentId)
      if enabled {
        if self.activeSmartsheetInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeSmartsheetInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Smartsheet account.")
        }
        let agent = try services.data.getAgent(agentId)
        self.smartsheetConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Smartsheet account")."
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
              "source": .string("applications-smartsheet-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "permissionPolicyBoundary": .string(
                "safe-bounded-reads-full-api-approval-or-dangerously-skip"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "provider-permission-boundary"))
        self.smartsheetConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Smartsheet account")."
      } else if let install = self.activeSmartsheetInstall(agentId, connection.id) {
        self.smartsheetConnectionStatus = "Disconnecting \(name) from Smartsheet."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.smartsheetConnectionStatus = "\(name) disconnected from Smartsheet."
      }
      self.smartsheetSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectTodoistConnection(_ connectionId: RelayId) {
    todoistSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteTodoistOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-todoist-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "todoist", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "todoist" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.todoistSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.todoistConnectionStatus = "\(deleted.accountLabel ?? "Todoist user") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setTodoistAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-todoist-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "todoist", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready Todoist user before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.todoistDisplayName(agentId)
      if enabled {
        if self.activeTodoistInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeTodoistInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Todoist user.")
        }
        let agent = try services.data.getAgent(agentId)
        self.todoistConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Todoist user")."
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
              "source": .string("applications-todoist-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "permissionPolicyBoundary": .string(
                "safe-bounded-reads-full-api-approval-or-dangerously-skip"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.todoistConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Todoist user")."
      } else if let install = self.activeTodoistInstall(agentId, connection.id) {
        self.todoistConnectionStatus = "Disconnecting \(name) from Todoist."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.todoistConnectionStatus = "\(name) disconnected from Todoist."
      }
      self.todoistSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectHarvestConnection(_ connectionId: RelayId) {
    harvestSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteHarvestOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-harvest-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "harvest", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "harvest" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.harvestSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.harvestConnectionStatus = "\(deleted.accountLabel ?? "Harvest account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setHarvestAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-harvest-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "harvest", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput,
          "Connect a ready exact Harvest account and API user before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.harvestDisplayName(agentId)
      if enabled {
        if self.activeHarvestInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeHarvestInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Harvest account.")
        }
        let agent = try services.data.getAgent(agentId)
        self.harvestConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Harvest account")."
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
              "source": .string("applications-harvest-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string(
                "approval-gated-bounded-harvest-project-assignment-time-entry-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.harvestConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Harvest account")."
      } else if let install = self.activeHarvestInstall(agentId, connection.id) {
        self.harvestConnectionStatus = "Disconnecting \(name) from Harvest."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.harvestConnectionStatus = "\(name) disconnected from Harvest."
      }
      self.harvestSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectCalendlyConnection(_ connectionId: RelayId) {
    calendlySelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteCalendlyOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-calendly-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "calendly", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "calendly" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.calendlySelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.calendlyConnectionStatus = "\(deleted.accountLabel ?? "Calendly user") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setCalendlyAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-calendly-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "calendly", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput,
          "Connect a ready exact Calendly user and organization before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.calendlyDisplayName(agentId)
      if enabled {
        if self.activeCalendlyInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeCalendlyInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Calendly user.")
        }
        let agent = try services.data.getAgent(agentId)
        self.calendlyConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Calendly user")."
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
              "source": .string("applications-calendly-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string(
                "approval-gated-bounded-calendly-event-type-scheduled-event-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.calendlyConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Calendly user")."
      } else if let install = self.activeCalendlyInstall(agentId, connection.id) {
        self.calendlyConnectionStatus = "Disconnecting \(name) from Calendly."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.calendlyConnectionStatus = "\(name) disconnected from Calendly."
      }
      self.calendlySelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectCalComConnection(_ connectionId: RelayId) {
    calComSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteCalComOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-cal-com-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "cal-com", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "cal-com" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.calComSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.calComConnectionStatus = "\(deleted.accountLabel ?? "Cal.com user") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setCalComAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-cal-com-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "cal-com", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready exact Cal.com user before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.calComDisplayName(agentId)
      if enabled {
        if self.activeCalComInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        if self.activeCalComInstall(agentId, nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Cal.com user.")
        }
        let agent = try services.data.getAgent(agentId)
        self.calComConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Cal.com user")."
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
              "source": .string("applications-cal-com-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string(
                "approval-gated-bounded-cal-com-booking-event-type-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.calComConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Cal.com user")."
      } else if let install = self.activeCalComInstall(agentId, connection.id) {
        self.calComConnectionStatus = "Disconnecting \(name) from Cal.com."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.calComConnectionStatus = "\(name) disconnected from Cal.com."
      }
      self.calComSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectDocusignConnection(_ connectionId: RelayId) {
    docusignSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteDocusignOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-docusign-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "docusign", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "docusign" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.docusignSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.docusignConnectionStatus = "\(deleted.accountLabel ?? "Docusign account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
}
