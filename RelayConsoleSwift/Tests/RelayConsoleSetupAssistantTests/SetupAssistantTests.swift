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
    try run("existing users migrate without blocking setup", testExistingUserMigration)
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

  private static func testSourceContracts() throws {
    let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    let setup = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/SetupAssistantView.swift")
    let model = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/Features/Settings/AppViewModel+SetupAssistant.swift")
    let views = try RelayConsoleSourceTestSupport.read(root: root, path: "Sources/RelayConsoleApp/Views.swift")
    try expect(setup.contains("discoverExistingHarnesses(force: true)"), "assistant does not reuse local discovery")
    try expect(setup.contains("connectDiscoveredHarness(candidate)"), "assistant does not reuse discovered-runtime connection")
    try expect(setup.contains("connectExistingHarness(record)"), "assistant does not reuse manual location connection")
    try expect(model.contains("/health/live"), "assistant does not check the required liveness endpoint")
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
