import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func setDocusignAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-docusign-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "docusign", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput,
          "Connect a ready exact Docusign user and selected account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.docusignDisplayName(agentId)
      if enabled {
        if self.activeDocusignInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeDocusignInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Docusign account.")
        }
        let agent = try services.data.getAgent(agentId)
        self.docusignConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Docusign account")."
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
              "source": .string("applications-docusign-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string("approval-gated-bounded-docusign-envelope-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-envelope-state-excluded"))
        self.docusignConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Docusign account")."
      } else if let install = self.activeDocusignInstall(agentId, connection.id) {
        self.docusignConnectionStatus = "Disconnecting \(name) from Docusign."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.docusignConnectionStatus = "\(name) disconnected from Docusign."
      }
      self.docusignSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectDropboxSignConnection(_ connectionId: RelayId) {
    dropboxSignSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteDropboxSignOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-dropbox-sign-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "dropbox-sign", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "dropbox-sign" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.dropboxSignSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.dropboxSignConnectionStatus =
        "\(deleted.accountLabel ?? "Dropbox Sign account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setDropboxSignAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-dropbox-sign-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "dropbox-sign", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready exact Dropbox Sign account before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.dropboxSignDisplayName(agentId)
      if enabled {
        if self.activeDropboxSignInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeDropboxSignInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Dropbox Sign account.")
        }
        let agent = try services.data.getAgent(agentId)
        self.dropboxSignConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Dropbox Sign account")."
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
              "source": .string("applications-dropbox-sign-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string(
                "approval-gated-bounded-dropbox-sign-signature-request-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-signature-request-state-excluded"))
        self.dropboxSignConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Dropbox Sign account")."
      } else if let install = self.activeDropboxSignInstall(agentId, connection.id) {
        self.dropboxSignConnectionStatus = "Disconnecting \(name) from Dropbox Sign."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.dropboxSignConnectionStatus = "\(name) disconnected from Dropbox Sign."
      }
      self.dropboxSignSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectPandaDocConnection(_ connectionId: RelayId) {
    pandaDocSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deletePandaDocOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-pandadoc-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "pandadoc", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "pandadoc" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.pandaDocSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.pandaDocConnectionStatus = "\(deleted.accountLabel ?? "PandaDoc workspace") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setPandaDocAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-pandadoc-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "pandadoc", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput,
          "Connect a ready exact PandaDoc membership and workspace before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.pandaDocDisplayName(agentId)
      if enabled {
        if self.activePandaDocInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activePandaDocInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another PandaDoc workspace.")
        }
        let agent = try services.data.getAgent(agentId)
        self.pandaDocConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "PandaDoc workspace")."
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
              "source": .string("applications-pandadoc-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string(
                "approval-gated-bounded-pandadoc-document-folder-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-document-state-excluded"))
        self.pandaDocConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "PandaDoc workspace")."
      } else if let install = self.activePandaDocInstall(agentId, connection.id) {
        self.pandaDocConnectionStatus = "Disconnecting \(name) from PandaDoc."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.pandaDocConnectionStatus = "\(name) disconnected from PandaDoc."
      }
      self.pandaDocSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectTypeformConnection(_ connectionId: RelayId) {
    typeformSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteTypeformOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-typeform-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "typeform", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "typeform" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.typeformSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.typeformConnectionStatus = "\(deleted.accountLabel ?? "Typeform workspace") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setTypeformAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-typeform-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "typeform", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput,
          "Connect a ready exact Typeform account, workspace and region before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.typeformDisplayName(agentId)
      if enabled {
        if self.activeTypeformInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeTypeformInstall(agentId, nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Typeform workspace.")
        }
        let agent = try services.data.getAgent(agentId)
        self.typeformConnectionStatus =
          "Connecting \(name) to \(connection.accountLabel ?? "Typeform workspace")."
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
              "source": .string("applications-typeform-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "runtimeReadBoundary": .string(
                "approval-gated-bounded-typeform-form-response-lifecycle-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "respondent-content-excluded"))
        self.typeformConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Typeform workspace")."
      } else if let install = self.activeTypeformInstall(agentId, connection.id) {
        self.typeformConnectionStatus = "Disconnecting \(name) from Typeform."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.typeformConnectionStatus = "\(name) disconnected from Typeform."
      }
      self.typeformSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectSurveyMonkeyConnection(_ id: RelayId) {
    surveyMonkeySelectedConnectionId = id
    scheduleApplicationsRefresh(selectedConnectionId: id)
  }
  func deleteSurveyMonkeyOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-surveymonkey-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "surveymonkey", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "surveymonkey" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.surveyMonkeySelectedConnectionId = ""
      self.surveyMonkeyConnectionStatus = "\(deleted.accountLabel ?? "SurveyMonkey user") deleted."
      return self.selectedThreadId
    }
  }
  func setSurveyMonkeyAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-surveymonkey-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "surveymonkey", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready exact SurveyMonkey user and regional origin first.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.surveyMonkeyDisplayName(agentId)
      if enabled {
        if self.activeSurveyMonkeyInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
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
            metadata: ["source": .string("applications-surveymonkey-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "response-content-excluded"))
        self.surveyMonkeyConnectionStatus = "\(name) connected."
      } else if let install = self.activeSurveyMonkeyInstall(agentId, connection.id) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.surveyMonkeyConnectionStatus = "\(name) disconnected."
      }
      self.surveyMonkeySelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectFilloutConnection(_ id: RelayId) {
    filloutSelectedConnectionId = id
    scheduleApplicationsRefresh(selectedConnectionId: id)
  }
  func deleteFilloutOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-fillout-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "fillout", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "fillout" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.filloutSelectedConnectionId = ""
      self.filloutConnectionStatus = "\(deleted.accountLabel ?? "Fillout OAuth grant") deleted."
      return self.selectedThreadId
    }
  }
  func setFilloutAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-fillout-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "fillout", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready Fillout OAuth grant and official base URL first.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.filloutDisplayName(agentId)
      if enabled {
        if self.activeFilloutInstall(agentId, connection.id) != nil { return self.selectedThreadId }
        let agent = try services.data.getAgent(agentId)
        _ = try services.marketplaceInstalls.createInstall(
          context: context,
          request: MarketplaceInstallRequest(
            id: createRelayId("minreq"), workspaceId: workspace.id, appId: app.id,
            appSlug: app.slug, connectionId: connection.id, targetAgentId: agent.id,
            roleId: app.roleManifest.primaryRole, selectedCapabilities: app.capabilities,
            approvalProfileId: nil, runtimeFormat: agent.binding.runtimeType,
            targetMode: .existingAgent, riskAcknowledged: true,
            metadata: ["source": .string("applications-fillout-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "submission-content-excluded"))
        self.filloutConnectionStatus = "\(name) connected."
      } else if let install = self.activeFilloutInstall(agentId, connection.id) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.filloutConnectionStatus = "\(name) disconnected."
      }
      self.filloutSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectMailchimpConnection(_ id: RelayId) {
    mailchimpSelectedConnectionId = id
    scheduleApplicationsRefresh(selectedConnectionId: id)
  }
  func deleteMailchimpOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-mailchimp-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "mailchimp", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "mailchimp" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.mailchimpSelectedConnectionId = ""
      self.mailchimpConnectionStatus = "\(deleted.accountLabel ?? "Mailchimp account") deleted."
      return self.selectedThreadId
    }
  }
  func setMailchimpAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-mailchimp-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "mailchimp", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready exact Mailchimp account and data-center first.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.mailchimpDisplayName(agentId)
      if enabled {
        if self.activeMailchimpInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
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
            metadata: ["source": .string("applications-mailchimp-agent-switch")],
            requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "contact-and-content-excluded"))
        self.mailchimpConnectionStatus = "\(name) connected."
      } else if let install = self.activeMailchimpInstall(agentId, connection.id) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.mailchimpConnectionStatus = "\(name) disconnected."
      }
      self.mailchimpSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectKlaviyoConnection(_ id: RelayId) {
    klaviyoSelectedConnectionId = id
    scheduleApplicationsRefresh(selectedConnectionId: id)
  }
  func deleteKlaviyoOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-klaviyo-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "klaviyo", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "klaviyo" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.klaviyoSelectedConnectionId = ""
      self.klaviyoConnectionStatus = "\(deleted.accountLabel ?? "Klaviyo account") deleted."
      return self.selectedThreadId
    }
  }
  func setKlaviyoAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-klaviyo-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "klaviyo", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Connect a ready exact Klaviyo Account and fixed API revision first.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.klaviyoDisplayName(agentId)
      if enabled {
        if self.activeKlaviyoInstall(agentId, connection.id) != nil { return self.selectedThreadId }
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
              "source": .string("applications-klaviyo-agent-switch"),
              "runtimeReadBoundary": .string(
                "approval-gated-bounded-klaviyo-account-list-campaign-lifecycle-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "profile-and-content-excluded"))
        self.klaviyoConnectionStatus = "\(name) connected."
      } else if let install = self.activeKlaviyoInstall(agentId, connection.id) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.klaviyoConnectionStatus = "\(name) disconnected."
      }
      self.klaviyoSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectConvertKitConnection(_ id: RelayId) {
    convertKitSelectedConnectionId = id
    scheduleApplicationsRefresh(selectedConnectionId: id)
  }
  func deleteConvertKitOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-convertkit-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "convertkit", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "convertkit" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.convertKitSelectedConnectionId = ""
      self.convertKitConnectionStatus = "\(deleted.accountLabel ?? "Kit Account") deleted."
      return self.selectedThreadId
    }
  }
  func setConvertKitAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-convertkit-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "convertkit", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready exact Kit Creator Account first.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.convertKitDisplayName(agentId)
      if enabled {
        if self.activeConvertKitInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
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
              "source": .string("applications-convertkit-agent-switch"),
              "runtimeReadBoundary": .string(
                "approval-gated-bounded-kit-account-form-broadcast-lifecycle-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "subscriber-and-content-excluded"))
        self.convertKitConnectionStatus = "\(name) connected."
      } else if let install = self.activeConvertKitInstall(agentId, connection.id) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.convertKitConnectionStatus = "\(name) disconnected."
      }
      self.convertKitSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectCampaignMonitorConnection(_ id: RelayId) {
    campaignMonitorSelectedConnectionId = id
    scheduleApplicationsRefresh(selectedConnectionId: id)
  }
  func deleteCampaignMonitorOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-campaign-monitor-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "campaign-monitor", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "campaign-monitor" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.campaignMonitorSelectedConnectionId = ""
      self.campaignMonitorConnectionStatus =
        "\(deleted.accountLabel ?? "Campaign Monitor Client") deleted."
      return self.selectedThreadId
    }
  }
  func setCampaignMonitorAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-campaign-monitor-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "campaign-monitor", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready exact Campaign Monitor Client first.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.campaignMonitorDisplayName(agentId)
      if enabled {
        if self.activeCampaignMonitorInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
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
              "source": .string("applications-campaign-monitor-agent-switch"),
              "runtimeReadBoundary": .string(
                "approval-gated-bounded-campaign-monitor-client-campaign-report-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "subscriber-and-content-excluded"))
        self.campaignMonitorConnectionStatus = "\(name) connected."
      } else if let install = self.activeCampaignMonitorInstall(agentId, connection.id) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.campaignMonitorConnectionStatus = "\(name) disconnected."
      }
      self.campaignMonitorSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectConstantContactConnection(_ id: RelayId) {
    constantContactSelectedConnectionId = id
    scheduleApplicationsRefresh(selectedConnectionId: id)
  }
  func deleteConstantContactOAuthConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-constant-contact-oauth-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "constant-contact", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "constant-contact" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.constantContactSelectedConnectionId = ""
      self.constantContactConnectionStatus =
        "\(deleted.accountLabel ?? "Constant Contact Account") deleted."
      return self.selectedThreadId
    }
  }
  func setConstantContactAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-constant-contact-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "constant-contact", let services = self.services,
        let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected else {
        throw RelayError(.invalidInput, "Connect a ready exact Constant Contact Account first.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.constantContactDisplayName(agentId)
      if enabled {
        if self.activeConstantContactInstall(agentId, connection.id) != nil {
          return self.selectedThreadId
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
              "source": .string("applications-constant-contact-agent-switch"),
              "runtimeReadBoundary": .string(
                "approval-gated-bounded-constant-contact-account-campaign-report-reads"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "contact-and-content-excluded"))
        self.constantContactConnectionStatus = "\(name) connected."
      } else if let install = self.activeConstantContactInstall(agentId, connection.id) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.constantContactConnectionStatus = "\(name) disconnected."
      }
      self.constantContactSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func toggleExaAgentSelection(_ agentId: RelayId) {
    if exaSelectedAgentIds.contains(agentId) {
      exaSelectedAgentIds.remove(agentId)
    } else {
      exaSelectedAgentIds.insert(agentId)
    }
  }

  func isActiveMarketplaceInstall(_ install: MarketplaceInstallRecord) -> Bool {
    install.installStatus == .installed || install.installStatus == .requested
  }

  func repairConnectedExaSearchSkillFiles(
    services: RelayConsoleServices,
    context: ServiceRequestContext,
    snapshot: MarketplaceInstallSnapshot
  ) throws -> [AgentWithBinding] {
    var repairedAgents: [AgentWithBinding] = []
    var repairedAgentIds = Set<RelayId>()
    for install in snapshot.installs where isActiveMarketplaceInstall(install) {
      guard !repairedAgentIds.contains(install.agentId),
        let repairedAgent = try services.marketplaceInstalls.repairRuntimeSkillFiles(
          context: context,
          installId: install.id
        )
      else {
        continue
      }
      repairedAgentIds.insert(repairedAgent.id)
      repairedAgents.append(repairedAgent)
    }
    return repairedAgents
  }

  func activeExaInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeXInstall(agentId: RelayId, connectionId: RelayId?) -> MarketplaceInstallRecord? {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "x"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeLinkedInInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "linkedin"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeGmailInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "gmail"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeGoogleDocsInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "google-docs"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeGoogleDriveInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "google-drive"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeGoogleSearchConsoleInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "google-search-console"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeGoogleCalendarInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "google-calendar"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeGoogleAnalyticsInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "google-analytics"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activePostHogInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "posthog"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeSentryInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "sentry"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeDatadogInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "datadog" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }

  func activePagerDutyInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "pagerduty" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }

  func activeCloudflareInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "cloudflare" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }

  func activeVercelInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "vercel" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }

  func activeHerokuInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "heroku" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }

  func activeDigitalOceanInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "digitalocean" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeFirebaseInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "firebase" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeSupabaseInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "supabase" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeOktaInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "okta" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeBambooHRInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "bamboohr" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeGreenhouseInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "greenhouse" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeLeverInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "lever" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }

  func activeNotionInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "notion"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeSlackInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "slack"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeGitHubInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "github"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeGitLabInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "gitlab"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeBitbucketInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "bitbucket"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeLinearInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "linear"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeAsanaInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "asana"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeTrelloInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "trello" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }

  func activeClickUpInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "clickup" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }

  func activeMondayInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "monday-com" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeAirtableInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "airtable" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeDropboxInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "dropbox" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeBoxInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "box" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeFigmaInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "figma" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeMiroInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "miro" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeCanvaInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "canva" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeWebflowInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "webflow" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeWordPressComInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "wordpress-com" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeContentfulInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "contentful" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeShopifyInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "shopify" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeWooCommerceInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "woocommerce" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeStripeInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "stripe" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeXeroInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "xero" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeQuickBooksInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "quickbooks" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeFreshBooksInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "freshbooks" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeWaveInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "wave" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeFreeAgentInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "freeagent" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeSalesforceInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "salesforce" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeHubSpotInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "hubspot" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activePipedriveInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "pipedrive" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeCopperInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "copper" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeCloseInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "close" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeZendeskInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "zendesk" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeIntercomInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "intercom" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeHelpScoutInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "help-scout" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeFrontInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "front" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeGrooveInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "groove" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeTeamworkInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "teamwork" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeBasecampInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "basecamp" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeWrikeInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "wrike" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeSmartsheetInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "smartsheet" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeTodoistInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "todoist" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeHarvestInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "harvest" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeCalendlyInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "calendly" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeCalComInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "cal-com" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeDocusignInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "docusign" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeDropboxSignInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "dropbox-sign" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activePandaDocInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "pandadoc" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeTypeformInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "typeform" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeSurveyMonkeyInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "surveymonkey" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeFilloutInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "fillout" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeMailchimpInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "mailchimp" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeKlaviyoInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "klaviyo" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeConvertKitInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "convertkit" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeCampaignMonitorInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "campaign-monitor" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }
  func activeConstantContactInstall(_ agentId: RelayId, _ connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first {
      $0.agentId == agentId && $0.appSlug == "constant-contact" && isActiveMarketplaceInstall($0)
        && (connectionId == nil || $0.connectionId == connectionId)
    }
  }

  func activeTelemetryDeckInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "telemetrydeck"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func activeMicrosoftClarityInstall(agentId: RelayId, connectionId: RelayId?)
    -> MarketplaceInstallRecord?
  {
    (exaInstallSnapshot?.installs ?? []).first { install in
      install.agentId == agentId
        && install.appSlug == "microsoft-clarity"
        && isActiveMarketplaceInstall(install)
        && (connectionId == nil || install.connectionId == connectionId)
    }
  }

  func prepareXAgentForInstall(services: RelayConsoleServices, agentId: RelayId)
    async throws -> AgentWithBinding
  {
    let agent = try services.data.getAgent(agentId)
    switch agent.binding.runtimeType {
    case .hermes:
      return try await services.harnessInstall.ensureHermesAgentProfile(agent)
    case .openclaw:
      return try await services.harnessInstall.ensureOpenClawAgentProvisioned(agent)
    default:
      throw RelayError(.invalidInput, "X supports Hermes and OpenClaw agents.")
    }
  }

  func recordUserManagedRuntimeRestartRequired(
    services: RelayConsoleServices,
    agent: AgentWithBinding,
    reason: String
  ) {
    _ = try? services.data.log(
      severity: "info",
      category: "harness",
      message:
        "Restart the user-managed runtime outside Relay Console before expecting this change to take effect.",
      harnessId: agent.harness.id,
      detail: ["agentId": .string(agent.id), "reason": .string(reason)]
    )
  }

  func prepareExaAgentForInstall(services: RelayConsoleServices, agentId: RelayId)
    async throws -> AgentWithBinding
  {
    let agent = try services.data.getAgent(agentId)
    switch agent.binding.runtimeType {
    case .hermes:
      return try await services.harnessInstall.ensureHermesAgentProfile(agent)
    case .openclaw:
      return try await services.harnessInstall.ensureOpenClawAgentProvisioned(agent)
    default:
      throw RelayError(.invalidInput, "Exa Search supports Hermes and OpenClaw agents.")
    }
  }

  func exaDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func xDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func linkedinDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func gmailDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func googleDocsDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func googleCalendarDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func googleDriveDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func googleSearchConsoleDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func googleAnalyticsDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func postHogDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func sentryDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func notionDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func slackDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func githubDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func gitLabDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func bitbucketDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func linearDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func asanaDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func trelloDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func clickUpDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func mondayDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func airtableDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func dropboxDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func boxDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func figmaDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func miroDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func canvaDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func webflowDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func wordpressComDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func contentfulDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func shopifyDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func wooCommerceDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func stripeDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func xeroDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func quickBooksDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func freshBooksDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func waveDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func freeAgentDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func salesforceDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func hubSpotDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func pipedriveDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func copperDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func closeDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func zendeskDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func intercomDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func helpScoutDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func frontDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func grooveDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func teamworkDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func basecampDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func wrikeDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func smartsheetDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func todoistDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func harvestDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func calendlyDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func calComDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func docusignDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func dropboxSignDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func pandaDocDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func typeformDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func surveyMonkeyDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func filloutDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func mailchimpDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func klaviyoDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func convertKitDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func campaignMonitorDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }
  func constantContactDisplayName(_ agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func telemetryDeckDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func microsoftClarityDisplayName(forAgentId agentId: RelayId) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? agentId
  }

  func agentDisplayName(for agentId: RelayId, fallback: String) -> String {
    agents.first { $0.id == agentId }.map(resolveAgentDisplayName) ?? fallback
  }

  static func marketplacePolicyStatusLabel(_ preset: MarketplaceActionPolicyPreset)
    -> String
  {
    switch preset {
    case .approvalRequired:
      return "Standard"
    case .allowDirectWrites:
      return "Direct writes"
    case .readOnly:
      return "Read only"
    case .blocked:
      return "Blocked"
    }
  }

  func exaAgentListText(_ names: [String]) -> String {
    let clean =
      names
      .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
      .filter { !$0.isEmpty }
    switch clean.count {
    case 0:
      return "the selected agents"
    case 1:
      return clean[0]
    case 2:
      return "\(clean[0]) and \(clean[1])"
    default:
      return "\(clean.dropLast().joined(separator: ", ")), and \(clean.last ?? "")"
    }
  }

  func connectExaSearch(for app: MarketplaceCatalogApp) {
    runAction("connect-exa-search", refresh: .applications) {
      guard app.slug == "exa-search" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let selectedIds = self.exaSelectedAgentIds.filter { agentId in
        guard
          let target = self.exaInstallSnapshot?.compatibleAgents.first(where: {
            $0.agentId == agentId
          })
        else {
          return true
        }
        return target.status == .compatible && target.existingInstallId == nil
      }
      guard !selectedIds.isEmpty else {
        throw RelayError(.invalidInput, "Select at least one unconnected agent for Exa Search.")
      }
      let sortedSelectedIds = selectedIds.sorted()
      let selectedAgentNames = sortedSelectedIds.map { self.exaDisplayName(forAgentId: $0) }
      let selectedAgentSummary = self.exaAgentListText(selectedAgentNames)
      self.exaConnectionStatus =
        "Preparing Exa Search for \(selectedAgentSummary). macOS may ask for Keychain access."
      await Task.yield()
      let context = self.chatContext(workspaceId: workspace.id)
      let trimmedKey = self.exaAPIKeyDraft.trimmingCharacters(in: .whitespacesAndNewlines)
      let connection: MarketplaceProviderConnection
      if trimmedKey.isEmpty {
        self.exaConnectionStatus =
          "Loading the saved Exa API key for \(selectedAgentSummary). macOS may ask for Keychain access."
        await Task.yield()
        let snapshot = try services.providerConnections.snapshot(
          context: context, appIdOrSlug: app.id)
        guard let existing = snapshot.selectedConnection else {
          throw RelayError(.invalidInput, "Enter an Exa API key before connecting Exa Search.")
        }
        guard existing.resolvedExecutionAuthority == .railway else {
          throw RelayError(
            .invalidInput,
            "This old Exa connection used the local Swift authority. Enter the Exa API key again so Railway can replace it.")
        }
        connection = existing
      } else {
        self.exaConnectionStatus =
          "Sending the new Exa API key to Railway before connecting \(selectedAgentSummary)."
        await Task.yield()
        connection = try await self.saveExaRailwayConnection(for: app, apiKey: trimmedKey)
      }
      self.exaConnectionStatus =
        "Connecting Exa Search to \(selectedAgentSummary)."
      await Task.yield()
      let remoteConnectionId = try services.cloudSync.remoteMarketplaceConnectionId(
        localWorkspaceId: workspace.id,
        localConnectionId: connection.id
      )
      for agentId in sortedSelectedIds {
        let agentDisplayName = self.exaDisplayName(forAgentId: agentId)
        self.exaConnectionStatus =
          "Preparing \(agentDisplayName) for Exa Search. Keep Relay Console open."
        await Task.yield()
        let agent = try services.data.getAgent(agentId)
        let prepared: AgentWithBinding
        switch agent.binding.runtimeType {
        case .hermes:
          prepared = try await services.harnessInstall.ensureHermesAgentProfile(agent)
        case .openclaw:
          prepared = try await services.harnessInstall.ensureOpenClawAgentProvisioned(agent)
        default:
          throw RelayError(.invalidInput, "Exa Search supports Hermes and OpenClaw agents.")
        }
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
              ?? "Railway could not install Exa Search for \(agentDisplayName)."
          )
        }
        self.recordUserManagedRuntimeRestartRequired(
          services: services,
          agent: prepared,
          reason: "Exa Search connection changed"
        )
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
      self.exaAPIKeyDraft = ""
      self.exaSelectedAgentIds.subtract(selectedIds)
      self.exaConnectionStatus = "Exa Search connected to \(selectedAgentSummary)."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
}
