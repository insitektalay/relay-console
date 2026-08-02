import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func savePostHogPersonalAPIKey(for app: MarketplaceCatalogApp) {
    runAction("save-posthog-personal-api-key", refresh: .applications) {
      guard app.slug == "posthog" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      self.postHogConnectionStatus = "Checking PostHog project access before saving."
      await Task.yield()
      let connection = try await services.providerConnections.connectPostHogPersonalAPIKey(
        context: self.chatContext(workspaceId: workspace.id),
        appIdOrSlug: app.id,
        baseURL: self.postHogBaseURLDraft,
        personalAPIKey: self.postHogPersonalAPIKeyDraft,
        organizationId: self.postHogOrganizationIdDraft.nilIfEmpty,
        organizationName: self.postHogOrganizationNameDraft.nilIfEmpty,
        projectId: self.postHogProjectIdDraft.nilIfEmpty,
        projectName: self.postHogProjectNameDraft.nilIfEmpty,
        displayName: self.postHogConnectionNameDraft.nilIfEmpty
      )
      self.postHogConnectionNameDraft = ""
      self.postHogPersonalAPIKeyDraft = ""
      self.postHogOrganizationIdDraft = ""
      self.postHogOrganizationNameDraft = ""
      self.postHogProjectIdDraft = ""
      self.postHogProjectNameDraft = ""
      self.postHogSelectedConnectionId = connection.id
      let projectText =
        connection.health.diagnostics["projectName"]?.string?.nilIfEmpty
        ?? connection.health.diagnostics["projectId"]?.string?.nilIfEmpty
        ?? "selected PostHog project"
      self.postHogConnectionStatus =
        "\(connection.accountLabel ?? "PostHog personal API key") saved for \(projectText). Relay stores only a Keychain reference and exposes read-only wrapper tools."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startPostHogOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-posthog-oauth", refresh: .applications) {
      guard app.slug == "posthog" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let configuration = try Self.postHogRelayOAuthConfiguration()
      let verifier = Self.postHogPKCEVerifier()
      let challenge = Self.postHogPKCEChallenge(verifier)
      let callbackService = GoogleOAuthLoopbackCallbackService.shared
      let state = try callbackService.preparePostHogSession(
        workspaceId: workspace.id, clientId: configuration.clientMetadataURL,
        redirectURI: configuration.redirectURI)
      let authorizationURL = try Self.postHogAuthorizationURL(
        configuration: configuration, state: state, challenge: challenge)
      guard let url = URL(string: authorizationURL) else {
        throw RelayError(.invalidInput, "Relay could not create the PostHog consent URL.")
      }
      self.postHogConnectionStatus = "Opening PostHog sign-in for the exact read-only V1 scopes."
      NSWorkspace.shared.open(url)
      self.postHogConnectionStatus =
        "Waiting for PostHog consent. Relay will save only Keychain token references."
      guard
        let callback = callbackService.consumePostHogCallback(
          workspaceId: workspace.id, clientId: configuration.clientMetadataURL, state: state,
          timeoutSeconds: 180)
      else {
        throw RelayError(
          .invalidInput,
          "PostHog consent did not return within 3 minutes. Click Connect PostHog and try again.")
      }
      if let error = callback.error {
        throw RelayError(.invalidInput, "PostHog consent was not completed: \(error).")
      }
      guard let code = callback.code?.nilIfEmpty else {
        throw RelayError(.invalidInput, "PostHog consent returned without an authorization code.")
      }
      let token = try Self.exchangePostHogAuthorizationCode(
        code: code, configuration: configuration, redirectURI: callback.redirectURI,
        verifier: verifier)
      let connection = try await services.providerConnections.connectPostHogRelayOwnedOAuth(
        context: self.chatContext(workspaceId: workspace.id), appIdOrSlug: app.id,
        apiBaseURL: self.postHogBaseURLDraft, accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        clientMetadataURL: configuration.clientMetadataURL, redirectURI: callback.redirectURI,
        grantedScopes: token.scopes, expiresAt: token.expiresAt,
        organizationId: self.postHogOrganizationIdDraft.nilIfEmpty,
        organizationName: self.postHogOrganizationNameDraft.nilIfEmpty,
        projectId: self.postHogProjectIdDraft.nilIfEmpty,
        projectName: self.postHogProjectNameDraft.nilIfEmpty,
        displayName: self.postHogConnectionNameDraft.nilIfEmpty
      )
      self.postHogConnectionNameDraft = ""
      self.postHogOrganizationIdDraft = ""
      self.postHogOrganizationNameDraft = ""
      self.postHogProjectIdDraft = ""
      self.postHogProjectNameDraft = ""
      self.postHogSelectedConnectionId = connection.id
      self.postHogConnectionStatus =
        "\(connection.accountLabel ?? "PostHog project") connected through Relay-owned OAuth with seven read-only scopes."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  struct PostHogRelayOAuthConfiguration {
    var clientMetadataURL: String
    var redirectURI: String
    let authorizationEndpoint = "https://oauth.posthog.com/oauth/authorize/"
    let tokenEndpoint = "https://oauth.posthog.com/oauth/token/"
  }

  struct PostHogOAuthTokenResponse {
    var accessToken: String
    var refreshToken: String
    var scopes: [String]
    var expiresAt: String?
  }

  static func postHogRelayOAuthConfiguration(
    environment: [String: String] = ProcessInfo.processInfo.environment
  ) throws -> PostHogRelayOAuthConfiguration {
    guard let value = environment["RELAY_POSTHOG_OAUTH_CLIENT_METADATA_URL"]?.nilIfEmpty,
      let url = URL(string: value), url.scheme == "https", url.host?.nilIfEmpty != nil
    else {
      throw RelayError(
        .unsupported,
        "PostHog OAuth needs RELAY_POSTHOG_OAUTH_CLIENT_METADATA_URL pointing to Relay's deployed HTTPS CIMD document."
      )
    }
    return PostHogRelayOAuthConfiguration(
      clientMetadataURL: url.absoluteString,
      redirectURI: "http://127.0.0.1:8767/oauth/posthog/callback")
  }

  static func postHogPKCEVerifier() -> String {
    (UUID().uuidString + UUID().uuidString).replacingOccurrences(of: "-", with: "")
  }

  static func postHogPKCEChallenge(_ verifier: String) -> String {
    Data(SHA256.hash(data: Data(verifier.utf8))).base64EncodedString().replacingOccurrences(
      of: "+", with: "-"
    ).replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }

  static func postHogAuthorizationURL(
    configuration: PostHogRelayOAuthConfiguration, state: String, challenge: String
  ) throws -> String {
    var components = URLComponents(string: configuration.authorizationEndpoint)
    components?.queryItems = [
      URLQueryItem(name: "client_id", value: configuration.clientMetadataURL),
      URLQueryItem(name: "redirect_uri", value: configuration.redirectURI),
      URLQueryItem(name: "response_type", value: "code"),
      URLQueryItem(
        name: "scope", value: ProviderConnectionService.postHogReadScopes.joined(separator: " ")),
      URLQueryItem(name: "state", value: state),
      URLQueryItem(name: "code_challenge", value: challenge),
      URLQueryItem(name: "code_challenge_method", value: "S256"),
    ]
    guard let value = components?.url?.absoluteString else {
      throw RelayError(.invalidInput, "Relay could not create the PostHog consent URL.")
    }
    return value
  }

  static func exchangePostHogAuthorizationCode(
    code: String, configuration: PostHogRelayOAuthConfiguration, redirectURI: String,
    verifier: String
  ) throws -> PostHogOAuthTokenResponse {
    guard let url = URL(string: configuration.tokenEndpoint) else {
      throw RelayError(.invalidInput, "PostHog token discovery is unavailable.")
    }
    let body = [
      ("client_id", configuration.clientMetadataURL), ("code", code), ("redirect_uri", redirectURI),
      ("grant_type", "authorization_code"), ("code_verifier", verifier),
    ].map { "\($0.0)=\(formEncode($0.1))" }.joined(separator: "&")
    let response = try URLSessionPostHogProviderHTTPClient(timeoutSeconds: 30).send(
      PostHogProviderHTTPRequest(
        method: "POST", url: url,
        headers: [
          "Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded",
        ], body: Data(body.utf8)))
    guard (200..<300).contains(response.statusCode),
      let object = try JSONSerialization.jsonObject(with: response.body) as? [String: Any],
      let access = (object["access_token"] as? String)?.nilIfEmpty,
      let refresh = (object["refresh_token"] as? String)?.nilIfEmpty
    else {
      throw RelayError(
        .invalidInput,
        "PostHog rejected the authorization code or did not return the complete token pair.")
    }
    let scopes = ((object["scope"] as? String)?.split(separator: " ").map(String.init) ?? [])
      .sorted()
    guard scopes == ProviderConnectionService.postHogReadScopes.sorted() else {
      throw RelayError(
        .invalidInput, "PostHog returned a different scope set than Relay's read-only V1 contract.")
    }
    let expiresAt = (object["expires_in"] as? NSNumber).map {
      ISO8601DateFormatter().string(from: Date().addingTimeInterval($0.doubleValue))
    }
    return PostHogOAuthTokenResponse(
      accessToken: access, refreshToken: refresh,
      scopes: ProviderConnectionService.postHogReadScopes, expiresAt: expiresAt)
  }

  func selectPostHogConnection(_ connectionId: RelayId) {
    postHogSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func testPostHogConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-posthog-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "posthog" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      self.postHogSelectedConnectionId = connection.id
      self.postHogConnectionStatus = "Checking \(connection.accountLabel ?? "PostHog connection")."
      await Task.yield()
      let updated = try await services.providerConnections.validateSavedPostHogConnection(
        context: self.chatContext(workspaceId: workspace.id),
        connectionId: connection.id
      )
      if updated.status == .connected && updated.health.state == .ready {
        self.postHogSelectedConnectionId = updated.id
      } else {
        self.postHogSelectedConnectionId =
          self.providerConnectionSnapshot?.connections.first {
            $0.id != updated.id && $0.status == .connected && $0.health.state == .ready
          }?.id ?? ""
      }
      self.postHogConnectionStatus =
        "\(updated.accountLabel ?? "PostHog connection"): \(updated.health.message)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deletePostHogConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-posthog-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "posthog" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "posthog" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.postHogSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.postHogConnectionStatus =
        "\(deleted.accountLabel ?? "PostHog connection") deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setPostHogAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-posthog-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "posthog" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(
          .invalidInput, "Connect PostHog through Relay-owned OAuth before assigning agents.")
      }
      guard connection.status == .connected, connection.health.state == .ready else {
        throw RelayError(
          .invalidInput, "Connect a healthy PostHog OAuth grant before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.postHogDisplayName(forAgentId: agentId)
      if enabled {
        if self.activePostHogInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activePostHogInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another PostHog connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.postHogConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "PostHog OAuth project")."
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
              "source": .string("applications-posthog-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("posthog-read-only-product-analytics"),
              "rawMCPExposure": .bool(false),
              "apiBaseURL": connection.health.diagnostics["apiBaseURL"]
                ?? .string("https://us.posthog.com"),
              "projectId": connection.health.diagnostics["projectId"] ?? .null,
              "projectName": connection.health.diagnostics["projectName"] ?? .null,
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.postHogConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "PostHog OAuth project")."
      } else {
        guard let install = self.activePostHogInstall(agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.postHogConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "PostHog OAuth project")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.postHogConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "PostHog OAuth project")."
      }
      self.postHogSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveMicrosoftClarityAPIToken(for app: MarketplaceCatalogApp) {
    runAction("save-microsoft-clarity-api-token", refresh: .applications) {
      guard app.slug == "microsoft-clarity" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let connection = try services.providerConnections.saveMicrosoftClarityAPIToken(
        context: self.chatContext(workspaceId: workspace.id),
        appIdOrSlug: app.id,
        apiToken: self.microsoftClarityAPITokenDraft,
        projectLabel: self.microsoftClarityProjectLabelDraft.nilIfEmpty,
        projectURL: self.microsoftClarityProjectURLDraft.nilIfEmpty,
        projectId: self.microsoftClarityProjectIdDraft.nilIfEmpty,
        displayName: self.microsoftClarityConnectionNameDraft.nilIfEmpty
      )
      self.microsoftClarityConnectionNameDraft = ""
      self.microsoftClarityAPITokenDraft = ""
      self.microsoftClarityProjectLabelDraft = ""
      self.microsoftClarityProjectURLDraft = ""
      self.microsoftClarityProjectIdDraft = ""
      self.microsoftClaritySelectedConnectionId = connection.id
      self.microsoftClarityConnectionStatus =
        "\(connection.accountLabel ?? "Microsoft Clarity project") saved. Use Check connection when you want to spend one bounded Data Export API request."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectMicrosoftClarityConnection(_ connectionId: RelayId) {
    microsoftClaritySelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func testMicrosoftClarityConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-microsoft-clarity-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "microsoft-clarity" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      self.microsoftClaritySelectedConnectionId = connection.id
      self.microsoftClarityConnectionStatus =
        "Checking \(connection.accountLabel ?? "Microsoft Clarity project"). This uses one bounded Data Export API request."
      await Task.yield()
      let updated = try await services.providerConnections.validateSavedMicrosoftClarityConnection(
        context: self.chatContext(workspaceId: workspace.id),
        connectionId: connection.id
      )
      if updated.status == .connected {
        self.microsoftClaritySelectedConnectionId = updated.id
      } else {
        self.microsoftClaritySelectedConnectionId =
          self.providerConnectionSnapshot?.connections.first {
            $0.id != updated.id && $0.status == .connected
          }?.id ?? ""
      }
      self.microsoftClarityConnectionStatus =
        "\(updated.accountLabel ?? "Microsoft Clarity project"): \(updated.health.message)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteMicrosoftClarityConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-microsoft-clarity-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "microsoft-clarity" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "microsoft-clarity" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.microsoftClaritySelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.microsoftClarityConnectionStatus =
        "\(deleted.accountLabel ?? "Microsoft Clarity project") deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setMicrosoftClarityAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-microsoft-clarity-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "microsoft-clarity" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(
          .invalidInput, "Save a Microsoft Clarity Data Export API token before assigning agents.")
      }
      guard connection.status == .connected else {
        throw RelayError(
          .invalidInput, "Save a connected Microsoft Clarity token before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.microsoftClarityDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeMicrosoftClarityInstall(agentId: agentId, connectionId: connection.id) != nil
        {
          return self.selectedThreadId
        }
        if self.activeMicrosoftClarityInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput,
            "\(displayName) is already assigned to another Microsoft Clarity connection.")
        }
        let agent = try services.data.getAgent(agentId)
        self.microsoftClarityConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "Microsoft Clarity project")."
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
              "source": .string("applications-microsoft-clarity-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "runtimeWriteDeferredReason": .string("microsoft-clarity-read-only-data-export"),
              "quotaWarning": .string(
                "Live reads may consume one of the 10 Microsoft Clarity Data Export API requests per project per day."
              ),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.microsoftClarityConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "Microsoft Clarity project")."
      } else {
        guard
          let install = self.activeMicrosoftClarityInstall(
            agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.microsoftClarityConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "Microsoft Clarity project")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.microsoftClarityConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "Microsoft Clarity project")."
      }
      self.microsoftClaritySelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func saveTelemetryDeckPAT(for app: MarketplaceCatalogApp) {
    runAction("save-telemetrydeck-pat", refresh: .applications) {
      guard app.slug == "telemetrydeck" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      self.telemetryDeckConnectionStatus =
        "Checking TelemetryDeck Personal Access Token before saving."
      await Task.yield()
      let connection = try await services.providerConnections.connectTelemetryDeckPAT(
        context: self.chatContext(workspaceId: workspace.id),
        appIdOrSlug: app.id,
        personalAccessToken: self.telemetryDeckPATDraft,
        namespace: self.telemetryDeckNamespaceDraft,
        telemetryDeckAppId: self.telemetryDeckAppIdDraft,
        appDisplayName: self.telemetryDeckAppDisplayNameDraft.nilIfEmpty,
        defaultInsightId: self.telemetryDeckDefaultInsightIdDraft.nilIfEmpty,
        displayName: self.telemetryDeckConnectionNameDraft.nilIfEmpty
      )
      self.telemetryDeckConnectionNameDraft = ""
      self.telemetryDeckPATDraft = ""
      self.telemetryDeckNamespaceDraft = ""
      self.telemetryDeckAppIdDraft = ""
      self.telemetryDeckAppDisplayNameDraft = ""
      self.telemetryDeckDefaultInsightIdDraft = ""
      self.telemetryDeckSelectedConnectionId = connection.id
      self.telemetryDeckConnectionStatus =
        "\(connection.accountLabel ?? "TelemetryDeck app") saved for \(connection.connectedHandle ?? "selected app"). No Relay-owned TelemetryDeck app or callback is used."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func selectTelemetryDeckConnection(_ connectionId: RelayId) {
    telemetryDeckSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func testTelemetryDeckConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("test-telemetrydeck-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "telemetrydeck" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      self.telemetryDeckSelectedConnectionId = connection.id
      self.telemetryDeckConnectionStatus =
        "Checking \(connection.accountLabel ?? "TelemetryDeck app")."
      await Task.yield()
      let updated = try await services.providerConnections.validateSavedTelemetryDeckConnection(
        context: self.chatContext(workspaceId: workspace.id),
        connectionId: connection.id
      )
      if updated.status == .connected && updated.health.state == .ready {
        self.telemetryDeckSelectedConnectionId = updated.id
      } else {
        self.telemetryDeckSelectedConnectionId =
          self.providerConnectionSnapshot?.connections.first {
            $0.id != updated.id && $0.status == .connected && $0.health.state == .ready
          }?.id ?? ""
      }
      self.telemetryDeckConnectionStatus =
        "\(updated.accountLabel ?? "TelemetryDeck app"): \(updated.health.message)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func deleteTelemetryDeckConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-telemetrydeck-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "telemetrydeck" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let activeInstalls = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "telemetrydeck" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in activeInstalls {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.telemetryDeckSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      let disconnectedText =
        activeInstalls.isEmpty
        ? "" : " \(activeInstalls.count) agent\(activeInstalls.count == 1 ? "" : "s") disconnected."
      self.telemetryDeckConnectionStatus =
        "\(deleted.accountLabel ?? "TelemetryDeck app") deleted.\(disconnectedText)"
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setTelemetryDeckAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-telemetrydeck-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "telemetrydeck" else { return self.selectedThreadId }
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection else {
        throw RelayError(
          .invalidInput, "Save a TelemetryDeck Personal Access Token before assigning agents.")
      }
      guard connection.status == .connected, connection.health.state == .ready else {
        throw RelayError(
          .invalidInput, "Check or replace this TelemetryDeck connection before assigning agents.")
      }
      guard let namespace = connection.health.diagnostics["namespace"]?.string?.nilIfEmpty,
        let telemetryDeckAppId = connection.health.diagnostics["telemetryDeckAppId"]?.string?
          .nilIfEmpty
      else {
        throw RelayError(
          .invalidInput, "Save a TelemetryDeck namespace and app ID before assigning agents.")
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let displayName = self.telemetryDeckDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeTelemetryDeckInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeTelemetryDeckInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(displayName) is already assigned to another TelemetryDeck connection."
          )
        }
        let agent = try services.data.getAgent(agentId)
        self.telemetryDeckConnectionStatus =
          "Connecting \(displayName) to \(connection.accountLabel ?? "TelemetryDeck app")."
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
              "source": .string("applications-telemetrydeck-agent-switch"),
              "requestedAgentId": .string(agent.id),
              "selectedConnectionId": .string(connection.id),
              "namespace": .string(namespace),
              "telemetryDeckAppId": .string(telemetryDeckAppId),
              "appDisplayName": connection.health.diagnostics["appDisplayName"] ?? .null,
              "defaultInsightId": connection.health.diagnostics["defaultInsightId"] ?? .null,
              "runtimeWriteDeferredReason": .string("telemetrydeck-read-only-v1"),
            ],
            requestedByActorId: context.actorId,
            requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"
          )
        )
        self.telemetryDeckConnectionStatus =
          "\(displayName) connected to \(connection.accountLabel ?? "TelemetryDeck app")."
      } else {
        guard
          let install = self.activeTelemetryDeckInstall(
            agentId: agentId, connectionId: connection.id)
        else {
          return self.selectedThreadId
        }
        self.telemetryDeckConnectionStatus =
          "Disconnecting \(displayName) from \(connection.accountLabel ?? "TelemetryDeck app")."
        await Task.yield()
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.telemetryDeckConnectionStatus =
          "\(displayName) disconnected from \(connection.accountLabel ?? "TelemetryDeck app")."
      }
      self.telemetryDeckSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startDatadogOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-datadog-oauth", refresh: .applications) {
      guard app.slug == "datadog" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_DATADOG_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = RelayCloudLaunchContract.configuredRailwayOrigin,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Datadog OAuth needs RELAY_DATADOG_OAUTH_CLIENT_ID plus the secure CLAWCHAT_RAILWAY_ORIGIN callback/token broker and Partner Sandbox client setup."
        )
      }
      throw RelayError(
        .unsupported,
        "Datadog's confidential-client callback/token broker is not deployed on Railway yet. The desktop app will not handle the Datadog client secret or exchange authorization codes locally."
      )
    }
  }

  func selectDatadogConnection(_ connectionId: RelayId) {
    datadogSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func deleteDatadogConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-datadog-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "datadog", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "datadog" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.datadogSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.datadogConnectionStatus = "\(deleted.accountLabel ?? "Datadog organization") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setDatadogAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-datadog-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "datadog", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, connection.status == .connected,
        connection.health.state == .ready,
        connection.grantedScopes == ProviderConnectionService.datadogReadScopes,
        connection.health.diagnostics["apiOrigin"]?.string.map(
          DatadogProviderActionSupport.allowedAPIOrigins.contains) == true
      else {
        throw RelayError(
          .invalidInput,
          "Complete and select a ready allowlisted Datadog OAuth connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeDatadogInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeDatadogInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Datadog connection.")
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
              "source": .string("applications-datadog-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "apiOrigin": connection.health.diagnostics["apiOrigin"] ?? .null,
              "runtimeWriteDeferredReason": .string("datadog-read-only-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.datadogConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Datadog")."
      } else if let install = self.activeDatadogInstall(
        agentId: agentId, connectionId: connection.id)
      {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.datadogConnectionStatus = "\(name) disconnected from Datadog."
      }
      self.datadogSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startPagerDutyOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-pagerduty-oauth", refresh: .applications) {
      guard app.slug == "pagerduty" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_PAGERDUTY_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = RelayCloudLaunchContract.configuredRailwayOrigin,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "PagerDuty OAuth needs RELAY_PAGERDUTY_OAUTH_CLIENT_ID plus the secure CLAWCHAT_RAILWAY_ORIGIN callback/token broker and a registered confidential Scoped OAuth app."
        )
      }
      throw RelayError(
        .unsupported,
        "PagerDuty's confidential-client callback, token exchange, serialized refresh, revoke, and disconnect broker is not deployed on Railway yet. The desktop app will not handle the client secret or exchange authorization codes locally."
      )
    }
  }

  func selectPagerDutyConnection(_ connectionId: RelayId) {
    pagerDutySelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func deletePagerDutyConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-pagerduty-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "pagerduty", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "pagerduty" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.pagerDutySelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.pagerDutyConnectionStatus = "\(deleted.accountLabel ?? "PagerDuty account") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setPagerDutyAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-pagerduty-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "pagerduty", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection,
        pagerDutyConnectionIsReadyForAssignment(connection)
      else {
        throw RelayError(
          .invalidInput,
          "Complete and select a ready exact-account PagerDuty Scoped OAuth connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activePagerDutyInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activePagerDutyInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another PagerDuty connection.")
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
              "source": .string("applications-pagerduty-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "apiOrigin": connection.health.diagnostics["apiOrigin"] ?? .null,
              "accountAudience": connection.health.diagnostics["accountAudience"] ?? .null,
              "runtimeWriteDeferredReason": .string("pagerduty-read-only-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.pagerDutyConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "PagerDuty")."
      } else if let install = self.activePagerDutyInstall(
        agentId: agentId, connectionId: connection.id)
      {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.pagerDutyConnectionStatus = "\(name) disconnected from PagerDuty."
      }
      self.pagerDutySelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startCloudflareOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-cloudflare-oauth", refresh: .applications) {
      guard app.slug == "cloudflare" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_CLOUDFLARE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = RelayCloudLaunchContract.configuredRailwayOrigin,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Cloudflare OAuth needs RELAY_CLOUDFLARE_OAUTH_CLIENT_ID plus the secure CLAWCHAT_RAILWAY_ORIGIN callback/token broker and a public verified OAuth client."
        )
      }
      throw RelayError(
        .unsupported,
        "Cloudflare's confidential-client callback, code exchange, serialized refresh, revoke, and disconnect broker is not deployed on Railway yet. The desktop app will not handle the client secret or exchange authorization codes locally."
      )
    }
  }

  func selectCloudflareConnection(_ connectionId: RelayId) {
    cloudflareSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }

  func deleteCloudflareConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-cloudflare-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "cloudflare", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "cloudflare" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.cloudflareSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.cloudflareConnectionStatus = "\(deleted.accountLabel ?? "Cloudflare zone") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func setCloudflareAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-cloudflare-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "cloudflare", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection,
        cloudflareConnectionIsReady(connection)
      else {
        throw RelayError(
          .invalidInput,
          "Complete and select a ready exact-account Cloudflare OAuth connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeCloudflareInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeCloudflareInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Cloudflare connection.")
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
              "source": .string("applications-cloudflare-agent-switch"),
              "selectedConnectionId": .string(connection.id),
              "accountId": connection.health.diagnostics["accountId"] ?? .null,
              "zoneId": connection.health.diagnostics["zoneId"] ?? .null,
              "runtimeWriteDeferredReason": .string("cloudflare-read-only-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.cloudflareConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Cloudflare")."
      } else if let install = self.activeCloudflareInstall(
        agentId: agentId, connectionId: connection.id)
      {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.cloudflareConnectionStatus = "\(name) disconnected from Cloudflare."
      }
      self.cloudflareSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startVercelIntegrationConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-vercel-integration", refresh: .applications) {
      guard app.slug == "vercel" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_VERCEL_INTEGRATION_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = RelayCloudLaunchContract.configuredRailwayOrigin,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Vercel integration authorization needs RELAY_VERCEL_INTEGRATION_CLIENT_ID plus the secure CLAWCHAT_RAILWAY_ORIGIN redirect/token broker and approved connectable integration."
        )
      }
      throw RelayError(
        .unsupported,
        "Vercel's confidential one-time code exchange and configuration-removal broker is not deployed on Railway yet. The desktop app will not handle the integration secret or exchange codes locally."
      )
    }
  }
  func selectVercelConnection(_ connectionId: RelayId) {
    vercelSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteVercelConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-vercel-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "vercel", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "vercel" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.vercelSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.vercelConnectionStatus = "\(deleted.accountLabel ?? "Vercel project") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setVercelAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-vercel-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "vercel", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, vercelConnectionIsReady(connection)
      else {
        throw RelayError(
          .invalidInput,
          "Complete and select a ready exact-scope Vercel integration connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeVercelInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeVercelInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Vercel connection.")
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
              "source": .string("applications-vercel-agent-switch"),
              "configurationId": connection.health.diagnostics["configurationId"] ?? .null,
              "teamId": connection.health.diagnostics["teamId"] ?? .null,
              "projectId": connection.health.diagnostics["projectId"] ?? .null,
              "runtimeWriteDeferredReason": .string("vercel-read-only-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.vercelConnectionStatus = "\(name) connected to \(connection.accountLabel ?? "Vercel")."
      } else if let install = self.activeVercelInstall(
        agentId: agentId, connectionId: connection.id)
      {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.vercelConnectionStatus = "\(name) disconnected from Vercel."
      }
      self.vercelSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startHerokuOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-heroku-oauth", refresh: .applications) {
      guard app.slug == "heroku" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_HEROKU_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = RelayCloudLaunchContract.configuredRailwayOrigin,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Heroku OAuth needs RELAY_HEROKU_OAUTH_CLIENT_ID plus the secure CLAWCHAT_RAILWAY_ORIGIN callback/token broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Heroku's confidential authorization-code exchange, serialized refresh, revoke and disconnect broker is not deployed on Railway yet. The desktop app will not handle the client secret locally."
      )
    }
  }
  func selectHerokuConnection(_ connectionId: RelayId) {
    herokuSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteHerokuConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-heroku-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "heroku", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "heroku" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.herokuSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.herokuConnectionStatus = "\(deleted.accountLabel ?? "Heroku App") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setHerokuAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-heroku-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "heroku", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, herokuConnectionIsReady(connection)
      else {
        throw RelayError(
          .invalidInput,
          "Complete and select a ready exact-Team Heroku read-scope connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeHerokuInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeHerokuInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Heroku connection.")
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
              "source": .string("applications-heroku-agent-switch"),
              "teamId": connection.health.diagnostics["teamId"] ?? .null,
              "appId": connection.health.diagnostics["appId"] ?? .null,
              "runtimeWriteDeferredReason": .string("heroku-read-only-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.herokuConnectionStatus = "\(name) connected to \(connection.accountLabel ?? "Heroku")."
      } else if let install = self.activeHerokuInstall(
        agentId: agentId, connectionId: connection.id)
      {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.herokuConnectionStatus = "\(name) disconnected from Heroku."
      }
      self.herokuSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startDigitalOceanOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-digitalocean-oauth", refresh: .applications) {
      guard app.slug == "digitalocean" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_DIGITALOCEAN_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = RelayCloudLaunchContract.configuredRailwayOrigin,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "DigitalOcean OAuth needs RELAY_DIGITALOCEAN_OAUTH_CLIENT_ID plus the secure CLAWCHAT_RAILWAY_ORIGIN callback/token broker."
        )
      }
      throw RelayError(
        .unsupported,
        "DigitalOcean's confidential exchange, single-use refresh, revoke, team/project/resource verification and disconnect broker is not deployed on Railway yet. The desktop app will not handle the client secret locally."
      )
    }
  }
  func selectDigitalOceanConnection(_ connectionId: RelayId) {
    digitalOceanSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteDigitalOceanConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-digitalocean-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "digitalocean", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "digitalocean" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.digitalOceanSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.digitalOceanConnectionStatus =
        "\(deleted.accountLabel ?? "DigitalOcean resource") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setDigitalOceanAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-digitalocean-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "digitalocean", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection,
        digitalOceanConnectionIsReady(connection)
      else {
        throw RelayError(
          .invalidInput,
          "Complete and select a ready exact-Team/Project/resource DigitalOcean connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeDigitalOceanInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeDigitalOceanInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another DigitalOcean connection.")
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
              "source": .string("applications-digitalocean-agent-switch"),
              "teamId": connection.health.diagnostics["teamId"] ?? .null,
              "projectId": connection.health.diagnostics["projectId"] ?? .null,
              "resourceUrn": connection.health.diagnostics["resourceUrn"] ?? .null,
              "runtimeWriteDeferredReason": .string("digitalocean-read-only-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.digitalOceanConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "DigitalOcean")."
      } else if let install = self.activeDigitalOceanInstall(
        agentId: agentId, connectionId: connection.id)
      {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.digitalOceanConnectionStatus = "\(name) disconnected from DigitalOcean."
      }
      self.digitalOceanSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }

  func startFirebaseOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-firebase-oauth", refresh: .applications) {
      guard app.slug == "firebase" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_FIREBASE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = RelayCloudLaunchContract.configuredRailwayOrigin,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Firebase OAuth needs RELAY_FIREBASE_OAUTH_CLIENT_ID plus the secure CLAWCHAT_RAILWAY_ORIGIN callback/token broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Firebase's confidential Google code exchange, offline refresh, revoke, exact Project selection, and disconnect broker is not deployed on Railway yet. The desktop app will not handle the client secret locally."
      )
    }
  }
  func selectFirebaseConnection(_ connectionId: RelayId) {
    firebaseSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteFirebaseConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-firebase-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "firebase", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "firebase" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.firebaseSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.firebaseConnectionStatus = "\(deleted.accountLabel ?? "Firebase Project") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setFirebaseAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-firebase-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "firebase", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, firebaseConnectionIsReady(connection)
      else {
        throw RelayError(
          .invalidInput,
          "Complete and select a ready exact-scope Firebase Project connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeFirebaseInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeFirebaseInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Firebase connection.")
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
              "source": .string("applications-firebase-agent-switch"),
              "projectId": connection.health.diagnostics["projectId"] ?? .null,
              "runtimeWriteDeferredReason": .string("firebase-read-only-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.firebaseConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Firebase")."
      } else if let install = self.activeFirebaseInstall(
        agentId: agentId, connectionId: connection.id)
      {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.firebaseConnectionStatus = "\(name) disconnected from Firebase."
      }
      self.firebaseSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func startSupabaseOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-supabase-oauth", refresh: .applications) {
      guard app.slug == "supabase" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_SUPABASE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = RelayCloudLaunchContract.configuredRailwayOrigin,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Supabase OAuth needs RELAY_SUPABASE_OAUTH_CLIENT_ID plus the secure CLAWCHAT_RAILWAY_ORIGIN callback/token broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Supabase's confidential PKCE code exchange, refresh, revoke, exact Organization/Project selection, and disconnect broker is not deployed on Railway yet. The desktop app will not handle the client secret locally."
      )
    }
  }
  func selectSupabaseConnection(_ connectionId: RelayId) {
    supabaseSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteSupabaseConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-supabase-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "supabase", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "supabase" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.supabaseSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.supabaseConnectionStatus = "\(deleted.accountLabel ?? "Supabase Project") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setSupabaseAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-supabase-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "supabase", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, supabaseConnectionIsReady(connection)
      else {
        throw RelayError(
          .invalidInput,
          "Complete and select a ready exact-scope Supabase Organization and Project connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeSupabaseInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeSupabaseInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Supabase connection.")
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
              "source": .string("applications-supabase-agent-switch"),
              "organizationSlug": connection.health.diagnostics["organizationSlug"] ?? .null,
              "projectRef": connection.health.diagnostics["projectRef"] ?? .null,
              "runtimeWriteDeferredReason": .string("supabase-read-only-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.supabaseConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Supabase")."
      } else if let install = self.activeSupabaseInstall(
        agentId: agentId, connectionId: connection.id)
      {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.supabaseConnectionStatus = "\(name) disconnected from Supabase."
      }
      self.supabaseSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func saveOktaOINConnection(for app: MarketplaceCatalogApp) {
    runAction("connect-okta-oin", refresh: .applications) {
      guard app.slug == "okta", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let connection = try services.providerConnections.saveOktaOINConnection(
        context: context, appIdOrSlug: app.id, orgDomain: self.oktaOrgDomainDraft,
        clientId: self.oktaClientIdDraft, clientSecret: self.oktaClientSecretDraft,
        applicationId: self.oktaApplicationIdDraft,
        applicationLabel: self.oktaApplicationLabelDraft,
        grantedScopes: ProviderConnectionService.oktaReadScopes)
      self.oktaClientSecretDraft = ""
      self.oktaSelectedConnectionId = connection.id
      self.oktaConnectionStatus = "\(connection.accountLabel ?? "Okta") connected."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func selectOktaConnection(_ connectionId: RelayId) {
    oktaSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteOktaConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-okta-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "okta", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "okta" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.oktaSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.oktaConnectionStatus =
        "\(deleted.accountLabel ?? "Okta Application") deleted. Revoke the OIN instance in Okta to revoke its client grant."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setOktaAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp) {
    runAction("toggle-okta-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "okta", let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard let connection = self.selectedProviderConnection, oktaConnectionIsReady(connection)
      else {
        throw RelayError(
          .invalidInput,
          "Complete and select a ready exact-scope Okta org and Application connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeOktaInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeOktaInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(.invalidInput, "\(name) is already assigned to another Okta connection.")
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
              "source": .string("applications-okta-agent-switch"),
              "orgDomain": connection.health.diagnostics["orgDomain"] ?? .null,
              "applicationId": connection.health.diagnostics["applicationId"] ?? .null,
              "runtimeWriteDeferredReason": .string("okta-read-only-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.oktaConnectionStatus = "\(name) connected to \(connection.accountLabel ?? "Okta")."
      } else if let install = self.activeOktaInstall(agentId: agentId, connectionId: connection.id)
      {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.oktaConnectionStatus = "\(name) disconnected from Okta."
      }
      self.oktaSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func startBambooHROAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-bamboohr-oauth", refresh: .applications) {
      guard app.slug == "bamboohr" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_BAMBOOHR_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = RelayCloudLaunchContract.configuredRailwayOrigin,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "BambooHR OAuth needs RELAY_BAMBOOHR_OAUTH_CLIENT_ID plus the secure CLAWCHAT_RAILWAY_ORIGIN callback/token broker."
        )
      }
      throw RelayError(
        .unsupported,
        "BambooHR's confidential code exchange, refresh, revoke, exact company/Location selection, and disconnect broker is not deployed on Railway yet. The desktop app will not handle the client secret locally."
      )
    }
  }
  func selectBambooHRConnection(_ connectionId: RelayId) {
    bambooHRSelectedConnectionId = connectionId
    scheduleApplicationsRefresh(selectedConnectionId: connectionId)
  }
  func deleteBambooHRConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-bamboohr-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "bamboohr", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      let installs = (self.exaInstallSnapshot?.installs ?? []).filter {
        $0.appSlug == "bamboohr" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }
      for install in installs {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.bambooHRSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.bambooHRConnectionStatus = "\(deleted.accountLabel ?? "BambooHR Location") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setBambooHRAgentConnection(_ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp)
  {
    runAction("toggle-bamboohr-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "bamboohr", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection, bambooHRConnectionIsReady(connection)
      else {
        throw RelayError(
          .invalidInput,
          "Complete and select a ready exact-scope BambooHR company and Location connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeBambooHRInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeBambooHRInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another BambooHR connection.")
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
              "source": .string("applications-bamboohr-agent-switch"),
              "companyDomain": connection.health.diagnostics["companyDomain"] ?? .null,
              "locationId": connection.health.diagnostics["locationId"] ?? .null,
              "runtimeWriteDeferredReason": .string("bamboohr-read-only-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.bambooHRConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "BambooHR")."
      } else if let install = self.activeBambooHRInstall(
        agentId: agentId, connectionId: connection.id)
      {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.bambooHRConnectionStatus = "\(name) disconnected from BambooHR."
      }
      self.bambooHRSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func startGreenhouseOAuthConnect(for app: MarketplaceCatalogApp) {
    runAction("connect-greenhouse-oauth", refresh: .applications) {
      guard app.slug == "greenhouse" else { return self.selectedThreadId }
      let environment = ProcessInfo.processInfo.environment
      guard environment["RELAY_GREENHOUSE_OAUTH_CLIENT_ID"]?.nilIfEmpty != nil,
        let origin = RelayCloudLaunchContract.configuredRailwayOrigin,
        let url = URL(string: origin), url.scheme == "https", url.host?.nilIfEmpty != nil
      else {
        throw RelayError(
          .unsupported,
          "Greenhouse partner OAuth needs RELAY_GREENHOUSE_OAUTH_CLIENT_ID plus the secure CLAWCHAT_RAILWAY_ORIGIN callback/token broker."
        )
      }
      throw RelayError(
        .unsupported,
        "Greenhouse Harvest v3 exchange, refresh, revoke, organization selection, and disconnect broker is not deployed on Railway yet."
      )
    }
  }
  func selectGreenhouseConnection(_ id: RelayId) {
    greenhouseSelectedConnectionId = id
    scheduleApplicationsRefresh(selectedConnectionId: id)
  }
  func deleteGreenhouseConnection(
    _ connection: MarketplaceProviderConnection, for app: MarketplaceCatalogApp
  ) {
    runAction("delete-greenhouse-connection-\(connection.id)", refresh: .applications) {
      guard app.slug == "greenhouse", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      let context = self.chatContext(workspaceId: workspace.id)
      for install in (self.exaInstallSnapshot?.installs ?? []).filter({
        $0.appSlug == "greenhouse" && $0.connectionId == connection.id
          && self.isActiveMarketplaceInstall($0)
      }) {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
      }
      let deleted = try services.providerConnections.deleteConnection(
        context: context, connectionId: connection.id)
      self.greenhouseSelectedConnectionId =
        self.providerConnectionSnapshot?.connections.first { $0.id != deleted.id }?.id ?? ""
      self.greenhouseConnectionStatus = "\(deleted.accountLabel ?? "Greenhouse") deleted."
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
  func setGreenhouseAgentConnection(
    _ agentId: RelayId, enabled: Bool, for app: MarketplaceCatalogApp
  ) {
    runAction("toggle-greenhouse-agent-\(agentId)", refresh: .applications) {
      guard app.slug == "greenhouse", let services = self.services, let workspace = self.workspace
      else { return self.selectedThreadId }
      guard let connection = self.selectedProviderConnection,
        greenhouseConnectionIsReady(connection)
      else {
        throw RelayError(
          .invalidInput,
          "Complete and select a ready exact-scope Greenhouse organization connection before assigning agents."
        )
      }
      let context = self.chatContext(workspaceId: workspace.id)
      let name = self.sentryDisplayName(forAgentId: agentId)
      if enabled {
        if self.activeGreenhouseInstall(agentId: agentId, connectionId: connection.id) != nil {
          return self.selectedThreadId
        }
        if self.activeGreenhouseInstall(agentId: agentId, connectionId: nil) != nil {
          throw RelayError(
            .invalidInput, "\(name) is already assigned to another Greenhouse connection.")
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
              "source": .string("applications-greenhouse-agent-switch"),
              "organizationId": connection.health.diagnostics["organizationId"] ?? .null,
              "runtimeWriteDeferredReason": .string("greenhouse-read-only-v1"),
            ], requestedByActorId: context.actorId, requestedAt: nowIso(),
            redactionStatus: "private-state-excluded"))
        self.greenhouseConnectionStatus =
          "\(name) connected to \(connection.accountLabel ?? "Greenhouse")."
      } else if let install = self.activeGreenhouseInstall(
        agentId: agentId, connectionId: connection.id)
      {
        _ = try services.marketplaceInstalls.removeInstall(context: context, installId: install.id)
        self.greenhouseConnectionStatus = "\(name) disconnected from Greenhouse."
      }
      self.greenhouseSelectedConnectionId = connection.id
      self.applicationsSelectedAppId = app.id
      return self.selectedThreadId
    }
  }
}
