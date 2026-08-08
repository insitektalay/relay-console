import AppKit
import Foundation
import RelayConsoleCore

struct RuntimeDiscoveryConnectionPresentation {
  let state: RuntimeDiscoveryConnectionStatus
  let message: String?
  let needsOpenClawGatewaySetup: Bool
}

struct SetupBridgeCloudContext {
  let account: CloudSavedAccount
  let deployment: CloudSavedDeployment
  let link: CloudSavedLink
}

extension AppViewModel {
  static let railwayTemplateURL: URL? = nil
  static let bridgeInstallerPreviewNotice =
    "Preview installer · Relay downloads and verifies a pinned source revision before it runs."

  var hasConnectedLocalRuntime: Bool {
    records.contains { $0.lifecycleState == .connected }
  }

  func runtimeDiscoveryPresentation(
    for candidate: RuntimeDiscoveryCandidate
  ) -> RuntimeDiscoveryConnectionPresentation {
    let message = runtimeConnectionMessages[candidate.harnessKey]
    let state = RuntimeInstallationDiscovery.connectionStatus(
      for: candidate,
      records: records,
      connecting: runtimeConnectionsInProgress.contains(candidate.harnessKey)
    )
    if state == .connecting {
      return RuntimeDiscoveryConnectionPresentation(
        state: .connecting,
        message: message,
        needsOpenClawGatewaySetup: false
      )
    }
    guard let record = runtimeDiscoveryRecord(for: candidate) else {
      return RuntimeDiscoveryConnectionPresentation(
        state: .available,
        message: message,
        needsOpenClawGatewaySetup: false
      )
    }
    if record.lifecycleState == .connected {
      return RuntimeDiscoveryConnectionPresentation(
        state: .connected,
        message: message,
        needsOpenClawGatewaySetup: false
      )
    }
    let detail = message ?? record.lastError ?? record.health?.message
    let gatewaySetupRequired = candidate.harnessKey == .openclaw
      && detail?.localizedCaseInsensitiveContains("gateway") == true
    return RuntimeDiscoveryConnectionPresentation(
      state: .needsAttention,
      message: detail,
      needsOpenClawGatewaySetup: gatewaySetupRequired
    )
  }

  func runtimeDiscoveryRecord(
    for candidate: RuntimeDiscoveryCandidate
  ) -> HarnessInstallRecord? {
    RuntimeInstallationDiscovery.matchingRecord(for: candidate, records: records)
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

  func setupBridgeCloudContext() throws -> SetupBridgeCloudContext {
    guard let services else {
      throw RelayError(.internalError, "Relay services are unavailable.")
    }
    let accounts = try services.cloudConnections.listAccounts()
    let deployments = try services.cloudConnections.listDeployments()
    let activeLocalWorkspaceId = workspace?.id
    let eligibleLinks = try services.cloudSync.listLinks().filter {
      ![CloudSyncLinkState.unlinked, .revoked].contains($0.state)
    }
    let links = eligibleLinks.sorted { left, right in
      let leftMatchesWorkspace = left.localWorkspaceId == activeLocalWorkspaceId
      let rightMatchesWorkspace = right.localWorkspaceId == activeLocalWorkspaceId
      if leftMatchesWorkspace != rightMatchesWorkspace { return leftMatchesWorkspace }
      let preferredStates: [CloudSyncLinkState] = [.linked, .syncing, .offline]
      let leftPriority = preferredStates.firstIndex(of: left.state) ?? preferredStates.count
      let rightPriority = preferredStates.firstIndex(of: right.state) ?? preferredStates.count
      return leftPriority < rightPriority
    }
    for link in links {
      guard let account = accounts.first(where: { $0.id == link.accountId }),
        let deployment = deployments.first(where: { $0.id == account.deploymentId })
      else { continue }
      return SetupBridgeCloudContext(account: account, deployment: deployment, link: link)
    }
    throw RelayError(
      .permissionDenied,
      "Sign in and select a linked Railway workspace before setting up remote access."
    )
  }

  private func setupBridgeDeviceIsActive(_ row: [String: Any]) -> Bool {
    guard let revokedAt = row["revokedAt"] else { return true }
    return revokedAt is NSNull
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

  func presentSetupAssistant(at step: SetupAssistantStep) {
    setupAssistant.lifecycle = .inProgress
    setupAssistant.step = step
    setupAssistant.history = []
    setupAssistantPresented = true
    setupBackendMessage = nil
    setupPairingMessage = nil
    persistSetupAssistant()
  }

  func presentLocalRuntimeSetup() {
    setupAssistant.mode = setupAssistant.mode == .remote ? .localAndRemote : .local
    presentSetupAssistant(at: .localDiscovery)
    Task { await discoverExistingHarnesses(force: true) }
  }

  func presentRemoteAccessSetup() {
    setupAssistant.mode = setupAssistant.mode == .local ? .localAndRemote : .remote
    let next: SetupAssistantStep
    if setupConfiguredRailwayOrigin == nil {
      next = .railwayConnection
    } else if hasReadyCloudWorkspace {
      next = .remoteRuntimes
    } else {
      next = .relayAccount
    }
    presentSetupAssistant(at: next)
  }

  func setupAdvance(_ step: SetupAssistantStep) {
    setupAssistant.advance(to: step)
    persistSetupAssistant()
  }

  func setupBack() {
    _ = setupAssistant.goBack()
    persistSetupAssistant()
  }

  func dismissSetupAssistant() {
    setupAssistantPresented = false
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
    guard let services else {
      recordSetupPairingFailure(
        for: runtime,
        state: .healthCheckFailed,
        message: "Relay services are unavailable. Close and reopen Relay Console, then try again.",
        recovery: .retryPairing
      )
      return
    }
    setupPairingInProgress.insert(runtime)
    defer { setupPairingInProgress.remove(runtime) }
    setupPairingMessage = nil
    let compatibility = setupAssistant.pairing[runtime]?.compatibility
    setupAssistant.pairing[runtime] = SetupPairingCode(
      state: .notGenerated,
      compatibility: compatibility
    )
    persistSetupAssistant()
    do {
      let context = try setupBridgeCloudContext()
      guard let apiURL = URL(string: context.deployment.apiBaseURL)
      else {
        setupAssistant.pairing[runtime] = SetupPairingCode(state: .permissionDenied)
        throw RelayError(.permissionDenied, "Sign in and select a workspace before generating a pairing code.")
      }
      let transport = try URLSessionRelayCloudTransport(apiBaseURL: apiURL)
      let token = try await services.cloudConnections.validAccessToken(
        accountId: context.account.id,
        transport: transport
      )
      let response = try await transport.send(
        method: "POST",
        path: "bridge/workspaces/\(context.link.remoteWorkspaceId)/enrollments",
        body: [
          "deviceLabel": "\(runtime.displayName) remote bridge",
          "hostInstallationId": try RelayHostIdentity.resolve(using: services.data),
          "expiresInMinutes": 10,
        ],
        accessToken: token
      )
      guard let pairingResponse = SetupPairingResponseParser.parse(response)
      else { throw RelayError(.internalError, "Railway returned an invalid pairing response.") }
      setupAssistant.pairing[runtime] = SetupPairingCode(
        code: pairingResponse.code,
        expiresAt: pairingResponse.expiresAt,
        state: .ready,
        detailMessage: "Pairing code created. Relay is ready to install the \(runtime.displayName) bridge.",
        recoveryAction: nil,
        compatibility: compatibility
      )
      persistSetupAssistant()
    } catch {
      recordSetupPairingFailure(for: runtime, error: error)
    }
  }

  private func recordSetupPairingFailure(for runtime: SetupRemoteRuntime, error: Error) {
    let relay = relayError(error)
    let normalized = relay.message.lowercased()
    if relay.code == .permissionDenied
      || relay.code == .secretStoreUnavailable
      || normalized.contains("unauthorized")
      || normalized.contains("sign in")
      || normalized.contains("access to this workspace")
      || normalized.contains("owner or admin")
    {
      recordSetupPairingFailure(
        for: runtime,
        state: .permissionDenied,
        message: "\(relay.message) Reconnect your Railway account, then try again.",
        recovery: .reconnectRailway
      )
    } else if normalized.contains("temporarily unavailable")
      || normalized.contains("unreachable")
      || normalized.contains("network")
      || normalized.contains("timed out")
    {
      recordSetupPairingFailure(
        for: runtime,
        state: .backendUnreachable,
        message: relay.message,
        recovery: .retryPairing
      )
    } else {
      recordSetupPairingFailure(
        for: runtime,
        state: .healthCheckFailed,
        message: relay.message,
        recovery: .retryPairing
      )
    }
  }

  private func recordSetupPairingFailure(
    for runtime: SetupRemoteRuntime,
    state: SetupPairingState,
    message: String,
    recovery: SetupPairingRecoveryAction
  ) {
    let compatibility = setupAssistant.pairing[runtime]?.compatibility
    setupAssistant.pairing[runtime] = SetupPairingCode(
      state: state,
      detailMessage: message,
      recoveryAction: recovery,
      compatibility: compatibility
    )
    setupPairingMessage = message
    persistSetupAssistant()
  }

  func setupTerminalInstallCommand(for runtime: SetupRemoteRuntime) -> String? {
    guard let origin = setupConfiguredRailwayOrigin else { return nil }
    return RelayBridgeInstaller.terminalCommand(
      runtime: runtime == .hermes ? .hermes : .openclaw,
      apiOrigin: origin,
      externalAgentIds: runtime == .hermes ? setupHermesExternalAgentIds : []
    )
  }

  private var setupHermesExternalAgentIds: [String] {
    var seen = Set<String>()
    return agents.compactMap { agent in
      guard agent.binding.runtimeType == .hermes, agent.lifecycleStatus == .active else { return nil }
      let externalAgentId = agent.binding.externalAgentId?.nilIfEmpty ?? agent.externalId?.nilIfEmpty
      guard let externalAgentId, seen.insert(externalAgentId).inserted else { return nil }
      return externalAgentId
    }
  }

  func hasLocalRuntimeForBridge(_ runtime: SetupRemoteRuntime) -> Bool {
    switch runtime {
    case .hermes:
      return runtimeDiscoveryCandidates.contains { $0.harnessKey == .hermes }
        || records.contains { $0.harnessKey == .hermes && $0.lifecycleState == .connected }
    case .openClaw:
      return runtimeDiscoveryCandidates.contains { $0.harnessKey == .openclaw }
        || records.contains { $0.harnessKey == .openclaw && $0.lifecycleState == .connected }
    }
  }

  func installSetupBridgeOnThisMac(for runtime: SetupRemoteRuntime) async {
    guard let services else {
      recordSetupPairingFailure(
        for: runtime,
        state: .installationFailed,
        message: "Relay services are unavailable. Close and reopen Relay Console, then try again.",
        recovery: .retryInstallation
      )
      return
    }
    setupBridgeInstallInProgress.insert(runtime)
    setupPairingMessage = nil
    defer { setupBridgeInstallInProgress.remove(runtime) }

    guard await preflightSetupBridgeCompatibility(for: runtime) else { return }
    await generateSetupPairingCode(for: runtime)
    guard let pairing = setupAssistant.pairing[runtime],
      pairing.state == .ready,
      !pairing.isExpired,
      let origin = setupConfiguredRailwayOrigin
    else {
      if setupAssistant.pairing[runtime]?.detailMessage == nil {
        recordSetupPairingFailure(
          for: runtime,
          state: .healthCheckFailed,
          message: "Relay could not create the one-time pairing code required by the installer.",
          recovery: .retryPairing
        )
      }
      return
    }

    let runtimePath: URL?
    switch runtime {
    case .hermes:
      runtimePath = runtimeDiscoveryCandidates.first(where: { $0.harnessKey == .hermes })?.location
        ?? records.first(where: { $0.harnessKey == .hermes })
          .flatMap { $0.selectedLocalPath ?? $0.installPath }
          .map { URL(fileURLWithPath: $0, isDirectory: true) }
    case .openClaw:
      runtimePath = records.first(where: { $0.harnessKey == .openclaw })?.openClawStateDir
        .map { URL(fileURLWithPath: $0, isDirectory: true) }
    }

    do {
      let host = Host.current().localizedName?.nilIfEmpty ?? "This Mac"
      _ = try await services.bridgeInstaller.install(
        RelayBridgeInstallRequest(
          runtime: runtime == .hermes ? .hermes : .openclaw,
          runtimePath: runtimePath,
          apiOrigin: origin,
          pairingCode: pairing.code,
          deviceLabel: "\(host) · \(runtime.displayName) bridge",
          externalAgentIds: runtime == .hermes ? setupHermesExternalAgentIds : []
        )
      )
      setupAssistant.pairing[runtime] = SetupPairingCode(
        state: .bridgeOffline,
        detailMessage: "The \(runtime.displayName) bridge was installed and paired. Relay is checking whether it is online.",
        recoveryAction: .checkStatus,
        compatibility: pairing.compatibility
      )
      setupPairingMessage = setupAssistant.pairing[runtime]?.detailMessage
      persistSetupAssistant()
      await refreshSetupBridgeStatus(waitForConnection: true, expectedRuntime: runtime)
    } catch {
      let state: SetupPairingState
      if case .activationFailedAndRestored? = error as? RelayBridgeInstallerError {
        state = .activationRolledBack
      } else {
        state = .installationFailed
      }
      recordSetupPairingFailure(
        for: runtime,
        state: state,
        message: error.localizedDescription,
        recovery: .retryInstallation
      )
    }
  }

  private func preflightSetupBridgeCompatibility(for runtime: SetupRemoteRuntime) async -> Bool {
    guard let context = try? setupBridgeCloudContext(),
      let apiURL = URL(string: context.deployment.apiBaseURL)
    else {
      recordSetupPairingFailure(
        for: runtime,
        state: .backendUnreachable,
        message: "Relay could not preflight this runtime against Railway.",
        recovery: .retryInstallation
      )
      return false
    }

    let installRuntime: RelayBridgeInstallRuntime = runtime == .hermes ? .hermes : .openclaw
    let candidate = runtimeDiscoveryCandidates.first(where: {
      $0.harnessKey == (runtime == .hermes ? .hermes : .openclaw)
    })
    let record = records.first(where: {
      $0.harnessKey == (runtime == .hermes ? .hermes : .openclaw)
    })
    let version = candidate?.version ?? record?.installedVersion ?? record?.targetVersion

    do {
      let transport = try URLSessionRelayCloudTransport(apiBaseURL: apiURL)
      var body: [String: Any] = [
        "pluginVersion": RelayBridgeInstaller.pluginVersion(for: installRuntime),
        "runtimeType": installRuntime.rawValue,
        "hostType": "macos-launchd",
        "apiContractVersion": RelayBridgeInstaller.apiContractVersion,
        "websocketContractVersion": RelayBridgeInstaller.websocketContractVersion,
        "capabilities": RelayBridgeInstaller.capabilities(for: installRuntime),
      ]
      if let version { body["openCoreVersion"] = version }
      let response = try await transport.send(
        method: "POST",
        path: "bridge/compatibility/check",
        body: body,
        accessToken: nil
      )
      guard let summary = SetupBridgeCompatibilityParser.parse(response) else {
        throw RelayError(.internalError, "Railway returned an invalid compatibility preflight.")
      }
      let versionLabel = summary.runtimeVersion ?? version ?? "unknown version"
      let detail: String
      switch summary.level {
      case .verified:
        detail = "\(runtime.displayName) \(versionLabel) is verified for full bridge functionality."
      case .compatible:
        detail = "\(runtime.displayName) \(versionLabel) can connect in Safe mode. Core messaging is enabled; unverified advanced capabilities stay off."
      case .unsupported:
        switch summary.code {
        case "BRIDGE_PLUGIN_VERSION_UNSUPPORTED":
          detail = "This Relay Console build requires a newer bridge compatibility policy on Railway. Update Relay’s backend before installing."
        case "BRIDGE_RUNTIME_VERSION_UNSUPPORTED", "BRIDGE_RUNTIME_VERSION_KNOWN_INCOMPATIBLE":
          detail = "\(runtime.displayName) \(versionLabel) is outside Relay’s supported runtime families. Update the runtime or compatibility policy before installing."
        default:
          detail = "Relay rejected this bridge configuration (\(summary.code ?? "unknown compatibility error"))."
        }
      }
      setupAssistant.pairing[runtime] = SetupPairingCode(
        state: summary.allowsInstallation ? .notGenerated : .incompatible,
        detailMessage: detail,
        recoveryAction: summary.allowsInstallation ? nil : .retryInstallation,
        compatibility: summary
      )
      setupPairingMessage = detail
      persistSetupAssistant()
      return summary.allowsInstallation
    } catch {
      recordSetupPairingFailure(
        for: runtime,
        state: .backendUnreachable,
        message: "Compatibility preflight failed: \(relayError(error).message)",
        recovery: .retryInstallation
      )
      return false
    }
  }

  func refreshSetupBridgeStatus(
    waitForConnection: Bool = false,
    expectedRuntime: SetupRemoteRuntime? = nil
  ) async {
    if setupBridgeStatusRefreshInProgress {
      guard waitForConnection else { return }
      for _ in 0..<20 where setupBridgeStatusRefreshInProgress {
        try? await Task.sleep(nanoseconds: 100_000_000)
      }
      guard !setupBridgeStatusRefreshInProgress else { return }
    }
    setupBridgeStatusRefreshInProgress = true
    defer {
      setupBridgeStatusRefreshInProgress = false
      setupBridgeStatusLastCheckedAt = Date()
    }
    guard let services,
      let context = try? setupBridgeCloudContext(),
      let apiURL = URL(string: context.deployment.apiBaseURL),
      let transport = try? URLSessionRelayCloudTransport(apiBaseURL: apiURL),
      let token = try? await services.cloudConnections.validAccessToken(
        accountId: context.account.id,
        transport: transport
      )
    else {
      setupBridgeOnlineRuntimes = []
      setupPairingMessage = "Railway is unreachable or the account and workspace are not ready."
      for runtime in setupAssistant.selectedRemoteRuntimes where setupAssistant.pairing[runtime]?.state != .connected {
        setupAssistant.pairing[runtime] = SetupPairingCode(
          state: .backendUnreachable,
          detailMessage: setupPairingMessage,
          recoveryAction: .reconnectRailway
        )
      }
      persistSetupAssistant()
      return
    }
    do {
      let attempts = waitForConnection ? 30 : 1
      for attempt in 0..<attempts {
        let rows = try await transport.sendArray(
          method: "GET",
          path: "bridge/workspaces/\(context.link.remoteWorkspaceId)/devices",
          body: nil,
          accessToken: token
        )
        let onlineRuntimes = Set([SetupRemoteRuntime.hermes, .openClaw].filter { runtime in
          return rows.contains {
            setupBridgeDeviceSupportsRuntime($0, runtime: runtime)
              && setupBridgeDeviceIsActive($0)
              && ($0["health"] as? String) == "online"
          }
        })
        setupBridgeOnlineRuntimes = onlineRuntimes
        for runtime in setupAssistant.selectedRemoteRuntimes {
          let devices = rows.filter {
            setupBridgeDeviceSupportsRuntime($0, runtime: runtime)
              && setupBridgeDeviceIsActive($0)
          }
          if let online = devices.first(where: { ($0["health"] as? String) == "online" }) {
            let compatibility = online["compatibility"] as? [String: Any]
            let isCompatible = (compatibility?["compatible"] as? Bool) != false
            let enabledCapabilities = compatibility?["enabledCapabilities"] as? [String] ?? []
            let detailMessage = !isCompatible
              ? "The bridge connected, but its version is not compatible with this Relay backend."
              : compatibility?["operatingMode"] as? String == "safe"
                ? enabledCapabilities.contains(MarketplaceHermesSkillInstaller.capability)
                  ? "The \(runtime.displayName) bridge is online in Safe mode. Core messaging and Marketplace agent assignment are ready; unverified advanced capabilities remain disabled."
                  : "The \(runtime.displayName) bridge is online in Safe mode; unverified advanced capabilities are disabled."
                : "The \(runtime.displayName) bridge is installed, paired and online."
            setupAssistant.pairing[runtime] = SetupPairingCode(
              state: isCompatible ? .connected : .incompatible,
              detailMessage: detailMessage,
              recoveryAction: isCompatible ? nil : .retryInstallation,
              compatibility: setupAssistant.pairing[runtime]?.compatibility
            )
            setupPairingMessage = detailMessage
          } else if !devices.isEmpty {
            let isFinalAttempt = attempt == attempts - 1
            if !waitForConnection || isFinalAttempt {
              setupAssistant.pairing[runtime] = SetupPairingCode(
                state: .bridgeOffline,
                detailMessage: waitForConnection
                  ? "The bridge was installed and started, but Railway has not confirmed its secure connection. Retry status; if it remains offline, reinstall the bridge."
                  : "The bridge is paired but offline. Its background service has not authenticated with Railway.",
                recoveryAction: .checkStatus,
                compatibility: setupAssistant.pairing[runtime]?.compatibility
              )
            }
          } else if setupAssistant.pairing[runtime]?.isExpired == true {
            setupAssistant.pairing[runtime]?.state = .expired
            setupAssistant.pairing[runtime]?.detailMessage = "The pairing code expired before a bridge connected. Generate a new code and try again."
            setupAssistant.pairing[runtime]?.recoveryAction = .retryPairing
          } else if waitForConnection && attempt == attempts - 1
            && (expectedRuntime == nil || runtime == expectedRuntime)
          {
            setupAssistant.pairing[runtime] = SetupPairingCode(
              state: .bridgeOffline,
              detailMessage: "The installer completed, but Railway has not recorded the bridge yet. Retry status; if no device appears, reinstall with a new pairing code.",
              recoveryAction: .checkStatus,
              compatibility: setupAssistant.pairing[runtime]?.compatibility
            )
          }
        }
        persistSetupAssistant()
        let requestedRuntimes = expectedRuntime.map { Set([$0]) }
          ?? setupAssistant.selectedRemoteRuntimes
        if !waitForConnection || requestedRuntimes.isSubset(of: onlineRuntimes) {
          break
        }
        if attempt < attempts - 1 {
          try? await Task.sleep(nanoseconds: 1_000_000_000)
        }
      }
    } catch {
      setupBridgeOnlineRuntimes = []
      setupPairingMessage = "Bridge status could not be checked. Check Railway and try again."
      for runtime in setupAssistant.selectedRemoteRuntimes where setupAssistant.pairing[runtime]?.state != .connected {
        setupAssistant.pairing[runtime]?.state = .healthCheckFailed
        setupAssistant.pairing[runtime]?.detailMessage = error.localizedDescription
        setupAssistant.pairing[runtime]?.recoveryAction = .checkStatus
      }
      persistSetupAssistant()
    }
  }

  func recoverSetupBridgeConnections() async {
    for runtime in setupAssistant.selectedRemoteRuntimes
    where !setupBridgeOnlineRuntimes.contains(runtime) {
      let state = setupAssistant.pairing[runtime]?.state
      if state == .connected || state == .bridgeOffline || state == .healthCheckFailed {
        setupAssistant.pairing[runtime] = SetupPairingCode(
          state: .connecting,
          detailMessage: "Relay is restoring remote access automatically.",
          recoveryAction: nil,
          compatibility: setupAssistant.pairing[runtime]?.compatibility
        )
      }
    }
    persistSetupAssistant()
    _ = await ensureAutomaticCloudLinkIfPossible()
    await refreshSetupBridgeStatus(waitForConnection: true)
  }

  private func setupBridgeDeviceSupportsRuntime(
    _ device: [String: Any],
    runtime: SetupRemoteRuntime
  ) -> Bool {
    let runtimeKey = runtime == .hermes ? "hermes" : "openclaw"
    if (device["runtimeType"] as? String) == runtimeKey { return true }
    let capabilities = Set(device["capabilities"] as? [String] ?? [])
    guard capabilities.contains("clawchat.relay_host.v1") else { return false }
    return capabilities.contains("clawchat.runtime.\(runtimeKey)")
      || capabilities.contains(runtimeKey)
  }
}
