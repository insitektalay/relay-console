import Foundation
import RelayConsoleCore
import RelayConsoleSourceTestSupport

struct SetupAssistantTestFailure: Error, CustomStringConvertible {
  let description: String
}

@main
enum SetupAssistantTests {
  static func main() throws {
    try run("state-machine navigation, Back, skip and Settings reopen", testNavigation)
    try run("local-only mode never requires Railway", testLocalOnly)
    try run("Railway origins derive and reject unsafe URLs", testDeploymentOrigins)
    try run("runtime Railway origin persists across service composition", testOriginPersistence)
    try run("backend switching isolates old credentials and links", testCredentialIsolation)
    try run("browser-return and remote runtime selections persist", testRemoteSelection)
    try run("pairing codes and failure states remain per runtime", testPairingStates)
    try run("Railway pairing expiry responses parse with milliseconds", testPairingResponseParsing)
    try run("bridge installer pins source and keeps pairing codes out of commands", testBridgeInstallerContract)
    try run("bridge compatibility preflight preserves safe-mode capability guidance", testBridgeCompatibilityParsing)
    try run("existing users migrate without blocking setup", testExistingUserMigration)
    try run("saved setup reconciles the active Railway backend", testSavedSetupRailwayReconciliation)
    try run("local discovery reconciles existing runtime connection state", testLocalDiscoveryConnectionState)
    try run("local discovery and launch-overlay coordination reuse app paths", testSourceContracts)
    print("Relay Console setup assistant tests passed")
  }

  private static func run(_ name: String, _ test: () throws -> Void) throws {
    do {
      try test()
      print("✓ \(name)")
    } catch {
      print("✗ \(name): \(error)")
      throw error
    }
  }

  private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    if !condition() { throw SetupAssistantTestFailure(description: message) }
  }

  private static func testNavigation() throws {
    var state = SetupAssistantSnapshot()
    try expect(state.requiresFirstLaunchPresentation, "fresh setup did not present")
    state.begin()
    state.advance(to: .localDiscovery)
    state.advance(to: .localRailwayOffer)
    try expect(state.goBack() && state.step == .localDiscovery, "Back did not restore the prior step")
    state.skip()
    try expect(state.lifecycle == .skipped && !state.requiresFirstLaunchPresentation, "Skip remained blocking")
    state.begin(reopen: true)
    try expect(state.lifecycle == .inProgress && state.step == .location, "Settings reopen did not restore the full assistant")
  }

  private static func testLocalOnly() throws {
    var state = SetupAssistantSnapshot()
    state.begin()
    state.mode = .local
    state.advance(to: .localRailwayOffer)
    state.finish()
    try expect(state.allowsLocalOnlyUse, "completed local-only setup was not usable")
    try expect(state.configuredRailwayOrigin == nil, "local-only setup invented a Railway origin")
  }

  private static func testDeploymentOrigins() throws {
    let origins = try RelayDeploymentConfiguration.origins(
      forRailwayOrigin: "https://customer-backend.up.railway.app/api/v1"
    )
    try expect(origins.railwayOrigin == "https://customer-backend.up.railway.app", "origin was not normalized")
    try expect(origins.apiOrigin.hasSuffix("/api/v1"), "API base was not derived")
    try expect(origins.websocketOrigin == "wss://customer-backend.up.railway.app", "WSS base was not derived")
    for unsafe in ["http://example.com", "https://localhost", "https://127.0.0.1", "https://[::1]"] {
      do {
        _ = try RelayDeploymentConfiguration.origins(forRailwayOrigin: unsafe)
        throw SetupAssistantTestFailure(description: "accepted unsafe backend \(unsafe)")
      } catch is RelayDeploymentConfigurationError {}
    }
  }

  private static func testOriginPersistence() throws {
    try withServices { root, services in
      let origin = "https://persisted-customer.up.railway.app"
      try services.data.setAppSetting(
        RelayDeploymentConfiguration.persistedRailwayOriginSettingKey,
        value: origin
      )
      services.database.close()
      let relaunched = try RelayConsoleServices(
        userDataPath: root,
        secretStore: MemorySecretStore(),
        refreshInstalledHarnessesOnLaunch: false,
        startRuntimeBrokerServer: false,
        environment: [:]
      )
      try expect(RelayCloudLaunchContract.railwayOrigin == origin, "persisted origin was not applied at composition")
      try expect(RelayCloudLaunchContract.apiOrigin == origin + "/api/v1", "persisted API base was not derived")
      try expect(RelayCloudLaunchContract.websocketOrigin == "wss://persisted-customer.up.railway.app", "persisted websocket base was not derived")
      relaunched.database.close()
    }
  }

  private static func testCredentialIsolation() throws {
    try withServices { _, services in
      let manifest = manifestForCurrentOrigin(id: "old-deployment")
      let deployment = try services.cloudConnections.saveDeployment(manifest: manifest)
      let account = try services.cloudConnections.saveAccount(
        deploymentId: deployment,
        remoteUserId: "old-user",
        displayName: "Old backend user",
        email: nil,
        accessToken: "old-access-token",
        refreshToken: "old-refresh-token",
        accessExpiresAt: nil
      )
      let workspace = try require(services.data.getAppState().activeWorkspace, "missing workspace")
      _ = try services.cloudSync.createLocalLink(
        localWorkspaceId: workspace.id,
        deploymentId: deployment,
        accountId: account,
        remoteInstallationId: "old-installation",
        remoteWorkspaceId: "old-workspace",
        remoteSyncLinkId: "old-link",
        attachmentPolicy: .metadataOnly,
        offlineRetention: true
      )
      try services.cloudConnections.isolateCredentialsForBackendSwitch(
        newAPIOrigin: "https://different-customer.up.railway.app/api/v1"
      )
      let accounts = try services.cloudConnections.listAccounts()
      let links = try services.cloudSync.listLinks()
      try expect(accounts.isEmpty, "old account remained signed in")
      try expect(links.allSatisfy { $0.state == .unlinked }, "old workspace link remained active")
      do {
        _ = try services.cloudConnections.accessToken(accountId: account)
        throw SetupAssistantTestFailure(description: "old backend token remained reusable")
      } catch let error as RelayError {
        try expect(error.code == .permissionDenied, "isolated token failed with the wrong reason")
      }
    }
  }

  private static func testRemoteSelection() throws {
    var state = SetupAssistantSnapshot()
    state.begin()
    state.mode = .remote
    state.advance(to: .railwayConnection)
    state.advance(to: .railwayBrowser)
    state.advance(to: .railwayURL)
    try expect(state.goBack() && state.step == .railwayBrowser, "browser-return state was lost")
    state.selectedRemoteRuntimes = [.hermes]
    try expect(state.selectedRemoteRuntimes == [.hermes], "Hermes-only selection failed")
    state.selectedRemoteRuntimes = [.openClaw]
    try expect(state.selectedRemoteRuntimes == [.openClaw], "OpenClaw-only selection failed")
    state.selectedRemoteRuntimes = [.hermes, .openClaw]
    state.remoteOperatingSystem = .linux
    try expect(state.selectedRemoteRuntimes.count == 2 && state.remoteOperatingSystem == .linux, "dual-runtime Linux selection failed")
  }

  private static func testPairingStates() throws {
    var state = SetupAssistantSnapshot()
    state.selectedRemoteRuntimes = [.hermes, .openClaw]
    state.pairing[.hermes] = SetupPairingCode(code: "HERMES-CODE", expiresAt: Date().addingTimeInterval(600), state: .ready)
    state.pairing[.openClaw] = SetupPairingCode(code: "OPENCLAW-CODE", expiresAt: Date().addingTimeInterval(600), state: .ready)
    try expect(state.pairing[.hermes]?.code != state.pairing[.openClaw]?.code, "dual runtimes shared one pairing code")
    state.pairing[.hermes]?.state = .permissionDenied
    state.pairing[.openClaw]?.state = .bridgeOffline
    try expect(state.pairing[.hermes]?.state == .permissionDenied, "permission state was not explicit")
    try expect(state.pairing[.openClaw]?.state == .bridgeOffline, "offline state was not explicit")
    state.pairing[.hermes] = SetupPairingCode(code: "EXPIRED", expiresAt: Date().addingTimeInterval(-1), state: .ready)
    try expect(state.pairing[.hermes]?.isExpired == true, "pairing expiry was not detected")
    state.pairing[.openClaw]?.state = .incompatible
    try expect(state.pairing[.openClaw]?.state == .incompatible, "incompatible version state was not retained")

    state.pairing[.hermes] = SetupPairingCode(
      state: .permissionDenied,
      detailMessage: "The saved Railway login could not authorize bridge pairing.",
      recoveryAction: .reconnectRailway
    )
    let encoded = try JSONEncoder().encode(state)
    let restored = try JSONDecoder().decode(SetupAssistantSnapshot.self, from: encoded)
    try expect(
      restored.pairing[.hermes]?.detailMessage == "The saved Railway login could not authorize bridge pairing.",
      "the runtime-specific pairing error disappeared after persistence"
    )
    try expect(
      restored.pairing[.hermes]?.recoveryAction == .reconnectRailway,
      "the runtime-specific recovery action disappeared after persistence"
    )
    let legacyPairing = try JSONDecoder().decode(
      SetupPairingCode.self,
      from: Data(#"{"code":"","expiresAt":-63114076800,"state":"backendUnreachable"}"#.utf8)
    )
    try expect(
      legacyPairing.state == .backendUnreachable
        && legacyPairing.detailMessage == nil
        && legacyPairing.recoveryAction == nil,
      "existing saved setup state no longer decodes after adding visible outcomes"
    )
  }

  private static func testPairingResponseParsing() throws {
    let response: [String: Any] = [
      "code": "HERMES-CODE",
      "expiresAt": "2026-08-04T04:46:36.123Z",
    ]
    let parsed = SetupPairingResponseParser.parse(response)
    try expect(
      parsed?.code == "HERMES-CODE" && parsed?.expiresAt.timeIntervalSince1970 == 1785818796.123,
      "Railway pairing response with millisecond expiry was rejected"
    )
  }

  private static func testBridgeInstallerContract() throws {
    let command = RelayBridgeInstaller.terminalCommand(
      runtime: .hermes,
      apiOrigin: "https://customer-backend.up.railway.app"
    )
    try expect(
      command.contains(RelayBridgeInstaller.pinnedRevision),
      "remote install command did not pin the reviewed bridge source revision"
    )
    try expect(
      RelayBridgeInstaller.pluginVersion(for: .hermes) == "0.3.0-rc.6",
      "Hermes compatibility preflight did not advertise the isolated-runtime bridge"
    )
    try expect(
      RelayBridgeInstaller.pluginVersion(for: .openclaw) == "2026.7.31-rc.4",
      "OpenClaw compatibility preflight did not advertise reload-safe credentials"
    )
    try expect(
      RelayBridgeInstaller.capabilities(for: .hermes).contains(MarketplaceHermesSkillInstaller.capability),
      "Hermes compatibility preflight omitted managed Marketplace skill installation"
    )
    try expect(
      command.contains("--runtime hermes")
        && command.contains("--api-url 'https://customer-backend.up.railway.app'"),
      "remote install command omitted the runtime or backend"
    )
    try expect(
      !command.localizedCaseInsensitiveContains("pairing-code")
        && !command.localizedCaseInsensitiveContains("enrollment-code"),
      "remote install command invited a pairing secret into shell history"
    )
    let agentCommand = RelayBridgeInstaller.terminalCommand(
      runtime: .hermes,
      apiOrigin: "https://customer-backend.up.railway.app",
      externalAgentIds: ["hugo-prototype", "leo's-metrics", "hugo-prototype"]
    )
    try expect(
      agentCommand.components(separatedBy: "--agent 'hugo-prototype'").count == 2
        && agentCommand.contains("--agent 'leo'\\''s-metrics'"),
      "Hermes guided installation did not safely register unique runtime agent identities"
    )
    let quoted = RelayBridgeInstaller.terminalCommand(
      runtime: .openclaw,
      apiOrigin: "https://customer-backend.up.railway.app",
      runtimePath: "/srv/user's openclaw"
    )
    try expect(
      quoted.contains("--runtime-path '/srv/user'\\''s openclaw'"),
      "runtime paths were not safely shell quoted"
    )
  }

  private static func testBridgeCompatibilityParsing() throws {
    let parsed = SetupBridgeCompatibilityParser.parse([
      "code": "BRIDGE_RUNTIME_VERSION_UNVERIFIED",
      "level": "compatible",
      "operatingMode": "safe",
      "runtimeVersion": "0.15.2",
      "enabledCapabilities": ["clawchat.runtime.hermes"],
      "disabledCapabilities": ["clawchat.runtime.structured_jobs"],
      "warnings": ["BRIDGE_RUNTIME_VERSION_UNVERIFIED"],
    ])
    try expect(parsed?.allowsInstallation == true, "safe-mode runtime was blocked")
    try expect(parsed?.code == "BRIDGE_RUNTIME_VERSION_UNVERIFIED", "compatibility error code was discarded")
    try expect(
      parsed?.disabledCapabilities == ["clawchat.runtime.structured_jobs"],
      "disabled capability guidance disappeared"
    )
    try expect(
      RelayBridgeInstaller.capabilities(for: .hermes).contains("clawchat.bridge.rotating_credentials.v1"),
      "preflight metadata omitted rotating credentials"
    )
  }

  private static func testExistingUserMigration() throws {
    let local = SetupAssistantSnapshot.migrateExistingUser(saved: nil, hasLocalConnection: true, configuredRailwayOrigin: nil)
    try expect(local.lifecycle == .completed && local.mode == .local && local.reviewRecommended, "local existing user was blocked")
    let both = SetupAssistantSnapshot.migrateExistingUser(
      saved: nil,
      hasLocalConnection: true,
      configuredRailwayOrigin: "https://existing.up.railway.app"
    )
    try expect(both.mode == .localAndRemote && !both.requiresFirstLaunchPresentation, "connected existing user was remigrated destructively")
  }

  private static func testSavedSetupRailwayReconciliation() throws {
    let origin = "https://existing.up.railway.app"
    let stale = SetupAssistantSnapshot(
      lifecycle: .inProgress,
      mode: .local,
      step: .railwayConnection
    )
    let reconciled = SetupAssistantSnapshot.migrateExistingUser(
      saved: stale,
      hasLocalConnection: true,
      configuredRailwayOrigin: origin
    )
    try expect(
      reconciled.configuredRailwayOrigin == origin,
      "the active Railway backend was hidden by a stale setup snapshot"
    )
  }

  private static func testLocalDiscoveryConnectionState() throws {
    try withServices { _, services in
      var hermes = try require(
        services.harnessInstall.listRecords().first(where: { $0.harnessKey == .hermes }),
        "missing Hermes install record"
      )
      let location = URL(fileURLWithPath: "/tmp/relay-connected-hermes", isDirectory: true)
      let candidate = RuntimeDiscoveryCandidate(
        harnessKey: .hermes,
        runtimeName: "Hermes Agent",
        location: location,
        displayLocation: location.path,
        version: "0.15.1"
      )
      try expect(
        RuntimeInstallationDiscovery.connectionStatus(
          for: candidate,
          records: [hermes],
          connecting: false
        ) == .available,
        "an unconfigured record was shown as connected"
      )
      hermes.installPath = location.path
      hermes.selectedLocalPath = location.path
      hermes.lifecycleState = .connected
      try expect(
        RuntimeInstallationDiscovery.connectionStatus(
          for: candidate,
          records: [hermes],
          connecting: false
        ) == .connected,
        "the matching connected Hermes record still showed Connect"
      )
      try expect(
        RuntimeInstallationDiscovery.connectionStatus(
          for: candidate,
          records: [hermes],
          connecting: true
        ) == .connecting,
        "candidate-specific progress did not override the stored state"
      )
      hermes.lifecycleState = .error
      try expect(
        RuntimeInstallationDiscovery.connectionStatus(
          for: candidate,
          records: [hermes],
          connecting: false
        ) == .needsAttention,
        "a located but unhealthy runtime did not show a setup warning"
      )
    }
  }

  private static func testSourceContracts() throws {
    let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    let setup = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/SetupAssistantView.swift")
    let appModel = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/AppViewModel.swift")
    let model = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/Features/Settings/AppViewModel+SetupAssistant.swift")
    let installer = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleCore/RelayBridgeInstaller.swift")
    let chatModel = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/Features/Chats/AppViewModel+Chats.swift")
    let views = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/Views.swift")
    try expect(setup.contains("discoverExistingHarnesses(force: true)"), "assistant does not reuse local discovery")
    try expect(
      !setup.contains("SetupAssistantStep.allCases") && !setup.contains("Step \\(position) of"),
      "assistant still presents branched setup as one linear step count"
    )
    try expect(
      setup.contains("Railway backend connected")
        && setup.contains("One-click Railway deployment is not available in this build")
        && !setup.contains("Button(\"Deploy on Railway\") {}"),
      "Railway setup does not distinguish an existing backend from unavailable deployment"
    )
    try expect(
      setup.contains("Connected locally")
        && setup.contains("Remote access and Marketplace agent assignment require an active Relay bridge"),
      "local runtime status is still presented as full remote readiness"
    )
    try expect(
      setup.contains("title: \"Remote Access\"")
        && setup.contains("compactBridgeCard(runtime)")
        && setup.contains("case .remotePairing: remoteInstallationStep")
        && setup.contains("Update or Reinstall Bridge")
        && setup.contains("Reconnect Railway")
        && setup.contains("Install on another computer")
        && setup.contains("Copy Install Command")
        && setup.contains("DisclosureGroup(\"Show terminal command\")")
        && setup.contains("DisclosureGroup(\"Technical details\")")
        && setup.contains("This page checks automatically")
        && model.contains("installSetupBridgeOnThisMac")
        && model.contains("setupBridgeStatusLastCheckedAt = Date()")
        && model.contains("waitForConnection: true")
        && model.contains("setupBridgeOnlineRuntimes")
        && setup.contains("await model.refreshSetupBridgeStatus()")
        && setup.contains("Task.sleep(nanoseconds: 5_000_000_000)")
        && installer.contains("externalAgentIds")
        && installer.contains("--agent")
        && model.contains("RelayBridgeInstallRequest"),
      "bridge setup does not poll to a shared online state or register selected runtime agents"
    )
    try expect(
      model.contains("func setupBridgeCloudContext()")
        && model.contains("$0.id == link.accountId")
        && model.contains("$0.id == account.deploymentId")
        && model.contains("left.localWorkspaceId == activeLocalWorkspaceId")
        && model.contains("context.link.remoteWorkspaceId")
        && model.contains("revokedAt is NSNull")
        && model.contains("setupBridgeDeviceIsActive($0)"),
      "bridge setup can mix unrelated Railway accounts, deployments, or workspaces"
    )
    try expect(
      setup.contains("On this Mac")
        && setup.contains("Relay cloud services")
        && setup.contains("Remote runtime access")
        && setup.contains("Relay Console on this Mac")
        && setup.contains("Railway backend address ·")
        && setup.contains("No active bridge")
        && setup.contains("Install or reconnect the Relay bridge")
        && setup.contains("Railway backend → Relay bridge → Hermes Agent or OpenClaw"),
      "Setup & Connections is not a three-card explanation of the local and remote routes"
    )
    try expect(
      setup.contains("StatusBadge(")
        && setup.contains("headerPills:")
        && setup.contains("cardAction(")
        && setup.contains(".buttonStyle(PrimaryLightButtonStyle())")
        && setup.contains("Manage Local Runtimes")
        && setup.contains("Set Up Remote Access"),
      "Setup & Connections does not reuse the app's visual status and action language"
    )
    try expect(
      !setup.contains("Current setup mode")
        && !setup.contains("Run Setup Assistant")
        && !setup.contains("NativeSettingsRow(title: \"Hermes Agent\"")
        && !setup.contains("NativeSettingsRow(title: \"OpenClaw\""),
      "Setup & Connections still exposes assistant history or duplicates Harness details"
    )
    try expect(
      appModel.contains("services.cloudConnections.listDeployments()")
        && appModel.contains("activeDeploymentOrigin")
        && appModel.contains("persistedOrigin.nilIfEmpty ?? activeDeploymentOrigin"),
      "Setup & Connections cannot recover an active Railway backend from the cloud connection store"
    )
    try expect(
      model.contains("func presentSetupAssistant(at step: SetupAssistantStep)")
        && model.contains("setupAssistant.history = []")
        && model.contains("func presentLocalRuntimeSetup()")
        && model.contains("func presentRemoteAccessSetup()"),
      "card actions still inherit unrelated navigation history from the full setup assistant"
    )
    try expect(
      setup.contains("Button(\"Close\", systemImage: \"xmark\")")
        && setup.contains("model.dismissSetupAssistant()")
        && model.contains("func dismissSetupAssistant()")
        && model.contains("setupAssistantPresented = false"),
      "Setup & Connections has no explicit non-destructive close action"
    )
    try expect(setup.contains("connectDiscoveredHarness(candidate)"), "assistant does not reuse discovered-runtime connection")
    try expect(setup.contains("connectExistingHarness(record)"), "assistant does not reuse manual location connection")
    try expect(model.contains("/health/live"), "assistant does not check the required liveness endpoint")
    try expect(
      setup.contains("runtimeDiscoveryPresentation(for: candidate)"),
      "discovery rows do not reconcile candidates with existing connection records"
    )
    try expect(
      setup.contains("ProgressView()") && setup.contains("Connecting…"),
      "discovery rows do not show candidate-specific connection progress"
    )
    try expect(
      setup.contains("Relay found and saved this OpenClaw installation")
        && setup.contains("gateway install")
        && setup.contains("Copy gateway setup command"),
      "OpenClaw gateway failures do not provide inline recovery guidance"
    )
    try expect(
      chatModel.contains("runtimeConnectionsInProgress")
        && chatModel.contains("runtimeConnectionMessages"),
      "discovered-runtime connection state is still collapsed into the global busy/error state"
    )
    let setupPosition = views.range(of: "model.setupAssistantPresented")?.lowerBound
    let gatePosition = views.range(of: "!model.canUseMainInterface")?.lowerBound
    try expect(setupPosition != nil && gatePosition != nil && setupPosition! < gatePosition!, "entitlement gate precedes setup location")
    try expect(views.contains("&& !model.setupAssistantPresented") && views.contains("model.telemetryChoiceRequired"), "telemetry can compete with setup")
  }

  private static func withServices(_ body: (URL, RelayConsoleServices) throws -> Void) throws {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent("relay-setup-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: root) }
    let services = try RelayConsoleServices(
      userDataPath: root,
      secretStore: MemorySecretStore(),
      refreshInstalledHarnessesOnLaunch: false,
      startRuntimeBrokerServer: false,
      environment: [:]
    )
    defer { services.database.close() }
    try body(root, services)
  }

  private static func manifestForCurrentOrigin(id: String) -> CloudDeploymentManifest {
    CloudDeploymentManifest(
      deploymentId: id,
      deploymentKey: id,
      displayName: "Test Relay",
      ownershipType: RelayCloudLaunchContract.deploymentOwnership,
      apiVersion: "v1",
      syncContractVersion: CloudRelayConnectionService.syncContractVersion,
      runtimeContractVersion: "bridge.v1",
      marketplaceContractVersion: "swift-marketplace.v1",
      minimumClients: [RelayCloudLaunchContract.clientKind: RelayConsoleReleaseMetadata.current.version],
      origins: .init(api: RelayCloudLaunchContract.apiOrigin, websocket: RelayCloudLaunchContract.websocketOrigin),
      features: [:],
      connectionDescriptorSigning: nil
    )
  }

  private static func require<T>(_ value: T?, _ message: String) throws -> T {
    guard let value else { throw SetupAssistantTestFailure(description: message) }
    return value
  }
}
