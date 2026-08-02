import AppKit
import Foundation
import RelayConsoleCore

extension AppViewModel {
  static let railwayTemplateURL: URL? = nil
  static let bridgeInstallerUnavailableReason =
    "The bridge is still a preview release and no immutable, checksum-verified one-command installer has been published. Use the reviewed manual guide for now."

  var hasConnectedLocalRuntime: Bool {
    records.contains { $0.lifecycleState == .connected }
  }

  var canUseMainInterface: Bool {
    relayEntitlementAccess.allowsOrdinaryUse
      || (setupAssistant.allowsLocalOnlyUse && hasConnectedLocalRuntime)
  }

  var setupConfiguredRailwayOrigin: String? {
    setupAssistant.configuredRailwayOrigin?.nilIfEmpty
  }

  var hasReadyCloudWorkspace: Bool {
    guard let services else { return false }
    return ((try? services.cloudConnections.listAccounts().isEmpty) == false)
      && ((try? services.cloudSync.listLinks().contains {
        ![CloudSyncLinkState.unlinked, .revoked].contains($0.state)
      }) == true)
  }

  func persistSetupAssistant() {
    guard let services else { return }
    try? services.data.setAppSetting(
      SetupAssistantSnapshot.persistenceKey,
      value: setupAssistant
    )
  }

  func presentSetupAssistant(reopen: Bool = true) {
    setupAssistant.begin(reopen: reopen)
    setupAssistantPresented = true
    setupBackendMessage = nil
    setupPairingMessage = nil
    persistSetupAssistant()
  }

  func setupAdvance(_ step: SetupAssistantStep) {
    setupAssistant.advance(to: step)
    persistSetupAssistant()
  }

  func setupBack() {
    _ = setupAssistant.goBack()
    persistSetupAssistant()
  }

  func skipSetupAssistant() {
    setupAssistant.skip()
    setupAssistantPresented = false
    persistSetupAssistant()
  }

  func finishSetupAssistant() {
    setupAssistant.finish()
    setupAssistantPresented = false
    persistSetupAssistant()
  }

  func beginLocalSetup() {
    setupAssistant.mode = setupAssistant.mode == .remote ? .localAndRemote : .local
    setupAdvance(.localDiscovery)
    Task { await discoverExistingHarnesses(force: true) }
  }

  func beginRemoteSetup() {
    setupAssistant.mode = setupAssistant.mode == .local ? .localAndRemote : .remote
    setupAdvance(.railwayConnection)
  }

  func chooseSetupGuide(_ runtime: SetupRemoteRuntime) {
    setupAssistant.guideRuntime = runtime
    persistSetupAssistant()
    let rawURL = runtime == .hermes
      ? "https://hermes-agent.nousresearch.com/docs/"
      : "https://docs.openclaw.ai/install"
    if let url = URL(string: rawURL) { NSWorkspace.shared.open(url) }
    setupAdvance(.installationGuideReturn)
  }

  func checkSetupBackend() async {
    setupBackendMessage = nil
    setupBackendPendingConfirmation = nil
    setupBackendCheckInProgress = true
    defer { setupBackendCheckInProgress = false }
    do {
      let origins = try RelayDeploymentConfiguration.origins(forRailwayOrigin: setupBackendInput)
      let healthURL = URL(string: origins.apiOrigin + "/health/live")!
      var request = URLRequest(url: healthURL)
      request.timeoutInterval = 15
      request.httpMethod = "GET"
      request.setValue("application/json", forHTTPHeaderField: "Accept")
      let (_, response) = try await URLSession.shared.data(for: request)
      guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
        throw RelayError(.internalError, "The Railway backend did not report healthy.")
      }
      let existing = setupConfiguredRailwayOrigin
      if let existing, existing != origins.railwayOrigin {
        setupBackendPendingConfirmation = origins
        setupBackendMessage = "Changing backends signs out the previous Relay account and isolates its tokens and bridge credentials."
      } else {
        try commitSetupBackend(origins)
      }
    } catch let error as RelayDeploymentConfigurationError {
      setupBackendMessage = backendValidationMessage(error)
    } catch {
      setupBackendMessage = "Relay could not reach /api/v1/health/live on that backend. Check Railway and try again."
    }
  }

  func confirmSetupBackendChange() {
    guard let origins = setupBackendPendingConfirmation else { return }
    do {
      try commitSetupBackend(origins)
      setupBackendPendingConfirmation = nil
    } catch {
      setupBackendMessage = "The backend was not changed: \(error.localizedDescription)"
    }
  }

  private func commitSetupBackend(_ origins: RelayDeploymentOrigins) throws {
    guard let services else { throw RelayError(.internalError, "Relay services are unavailable.") }
    try services.cloudConnections.isolateCredentialsForBackendSwitch(newAPIOrigin: origins.apiOrigin)
    try services.data.setAppSetting(
      RelayDeploymentConfiguration.persistedRailwayOriginSettingKey,
      value: origins.railwayOrigin
    )
    RelayCloudLaunchContract.configure(origins: origins)
    setupAssistant.configuredRailwayOrigin = origins.railwayOrigin
    setupBackendInput = origins.railwayOrigin
    setupBackendMessage = "Railway is healthy. Relay derived \(origins.apiOrigin) and \(origins.websocketOrigin)."
    persistSetupAssistant()
    setupAdvance(.relayAccount)
  }

  private func backendValidationMessage(_ error: RelayDeploymentConfigurationError) -> String {
    switch error {
    case .insecureScheme: return "Use the backend’s public HTTPS address. Insecure HTTP is not accepted."
    case .loopbackBackend: return "A Railway backend cannot use localhost, 127.0.0.1 or another loopback address."
    case .embeddedCredentials: return "Remove the username or password from the address."
    case .explicitPort: return "Use Railway’s public HTTPS address without a custom port."
    case .queryOrFragment, .invalidPath: return "Enter only the backend origin, such as https://your-backend.up.railway.app."
    case .mismatchedBackendHosts, .malformed: return "Enter a valid public Railway HTTPS address."
    }
  }

  func generateSetupPairingCode(for runtime: SetupRemoteRuntime) async {
    guard let services else { return }
    setupPairingInProgress.insert(runtime)
    defer { setupPairingInProgress.remove(runtime) }
    setupPairingMessage = nil
    do {
      guard let account = try services.cloudConnections.listAccounts().first,
        let deployment = try services.cloudConnections.listDeployments().first(where: {
          $0.id == account.deploymentId || $0.active
        }),
        let link = try services.cloudSync.listLinks().first(where: {
          ![CloudSyncLinkState.unlinked, .revoked].contains($0.state)
        }),
        let apiURL = URL(string: deployment.apiBaseURL)
      else {
        setupAssistant.pairing[runtime] = SetupPairingCode(state: .permissionDenied)
        throw RelayError(.permissionDenied, "Sign in and select a workspace before generating a pairing code.")
      }
      let transport = try URLSessionRelayCloudTransport(apiBaseURL: apiURL)
      let token = try await services.cloudConnections.validAccessToken(
        accountId: account.id,
        transport: transport
      )
      let response = try await transport.send(
        method: "POST",
        path: "bridge/workspaces/\(link.remoteWorkspaceId)/enrollments",
        body: [
          "deviceLabel": "\(runtime.displayName) remote bridge",
          "expiresInMinutes": 10,
        ],
        accessToken: token
      )
      guard let code = response["code"] as? String,
        let expiresText = response["expiresAt"] as? String,
        let expiresAt = ISO8601DateFormatter().date(from: expiresText)
      else { throw RelayError(.internalError, "Railway returned an invalid pairing response.") }
      setupAssistant.pairing[runtime] = SetupPairingCode(
        code: code,
        expiresAt: expiresAt,
        state: .ready
      )
      persistSetupAssistant()
    } catch {
      if setupAssistant.pairing[runtime] == nil {
        setupAssistant.pairing[runtime] = SetupPairingCode(state: .backendUnreachable)
      }
      setupPairingMessage = error.localizedDescription
      persistSetupAssistant()
    }
  }

  func refreshSetupBridgeStatus() async {
    guard let services,
      let account = try? services.cloudConnections.listAccounts().first,
      let deployment = try? services.cloudConnections.listDeployments().first(where: {
        $0.id == account.deploymentId || $0.active
      }),
      let link = try? services.cloudSync.listLinks().first(where: {
        ![CloudSyncLinkState.unlinked, .revoked].contains($0.state)
      }),
      let apiURL = URL(string: deployment.apiBaseURL),
      let transport = try? URLSessionRelayCloudTransport(apiBaseURL: apiURL),
      let token = try? await services.cloudConnections.validAccessToken(accountId: account.id, transport: transport)
    else {
      setupPairingMessage = "Railway is unreachable or the account and workspace are not ready."
      return
    }
    do {
      let rows = try await transport.sendArray(
        method: "GET",
        path: "bridge/workspaces/\(link.remoteWorkspaceId)/devices",
        body: nil,
        accessToken: token
      )
      for runtime in setupAssistant.selectedRemoteRuntimes {
        let runtimeKey = runtime == .hermes ? "hermes" : "openclaw"
        let devices = rows.filter { ($0["runtimeType"] as? String) == runtimeKey && $0["revokedAt"] == nil }
        if let online = devices.first(where: { ($0["health"] as? String) == "online" }) {
          setupAssistant.pairing[runtime]?.state = (online["compatible"] as? Bool) == false ? .incompatible : .connected
        } else if !devices.isEmpty {
          setupAssistant.pairing[runtime]?.state = .bridgeOffline
        } else if setupAssistant.pairing[runtime]?.isExpired == true {
          setupAssistant.pairing[runtime]?.state = .expired
        }
      }
      persistSetupAssistant()
    } catch {
      setupPairingMessage = "Bridge status could not be checked. Check Railway and try again."
    }
  }
}
