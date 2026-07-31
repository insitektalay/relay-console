import Foundation
import RelayConsoleCore
import RelayConsoleSourceTestSupport

struct DataLifecycleTestFailure: Error, CustomStringConvertible {
  let description: String
}

final class CleanupCommandRunner: CommandRunning {
  func run(_ command: String, _ args: [String], options: CommandOptions) async -> CommandResult {
    CommandResult(code: 0, stdout: "", stderr: "")
  }

  func spawn(_ command: String, _ args: [String], options: CommandOptions, stdin: String?)
    async throws -> (process: Process, result: Task<CommandResult, Never>)
  {
    throw DataLifecycleTestFailure(description: "Cleanup test did not expect a spawned process")
  }
}

@main
enum RelayConsoleDataLifecycleTests {
  static func main() async throws {
    try testRedactedExportWritesUsableFile()
    try await testCleanupRequiresConfirmationAndRemovesManagedState()
    try testSourceWiring()
    print("RelayConsoleDataLifecycleTests passed")
  }

  private static func testRedactedExportWritesUsableFile() throws {
    let root = temporaryRoot("export")
    let externalRuntime = temporaryRoot("export-user-runtime")
    defer {
      try? FileManager.default.removeItem(at: root)
      try? FileManager.default.removeItem(at: externalRuntime)
    }
    try FileManager.default.createDirectory(at: externalRuntime, withIntermediateDirectories: true)
    let runtimeMarker = externalRuntime.appendingPathComponent("run_agent.py")
    try "user-owned runtime".write(to: runtimeMarker, atomically: true, encoding: .utf8)
    let store = MemorySecretStore()
    let services = try RelayConsoleServices(
      userDataPath: root,
      runner: CleanupCommandRunner(),
      secretStore: store,
      refreshInstalledHarnessesOnLaunch: false,
      startRuntimeBrokerServer: false
    )
    let state = try services.data.getAppState()
    let profile = try unwrap(state.activeProfile, "missing profile")
    let workspace = try unwrap(state.activeWorkspace, "missing workspace")
    let context = ServiceRequestContext(
      actorId: profile.id, workspaceId: workspace.id, roles: [.owner], correlationId: "data-export")
    let thread = try services.data.createThread(
      workspaceId: workspace.id, title: "Exported conversation")
    _ = try services.data.createMessage(
      threadId: thread.id, senderType: .user, senderName: "Local User",
      content: "Retained user content")
    _ = try services.data.upsertHarness(
      runtimeType: .hermes,
      displayName: "User-managed Hermes Agent",
      mode: .userManaged,
      config: [
        "installPath": .string(externalRuntime.path),
        "securityScopedBookmark": .string("never-export-this-bookmark"),
        "runtimeOwnership": .string("user_managed"),
      ]
    )
    _ = try services.secrets.set(
      scope: "test", label: "Private Token", secretValue: "never-export-this-secret")
    let destination = root.deletingLastPathComponent().appendingPathComponent(
      "relay-export-\(UUID().uuidString).json")
    defer { try? FileManager.default.removeItem(at: destination) }

    let record = try services.dataLifecycle.writeRedactedExport(
      context: context,
      profileId: profile.id,
      destination: destination,
      now: Date(timeIntervalSince1970: 1_767_225_600)
    )
    let data = try Data(contentsOf: destination)
    let text = String(decoding: data, as: UTF8.self)
    let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    try expect(
      record.status == "written" && record.recordCount >= 4,
      "export record did not describe a written usable file")
    try expect(object?["schemaVersion"] as? Int == 1, "export schema version missing")
    try expect(
      text.contains("Exported conversation") && text.contains("Retained user content")
        && text.contains("User-managed Hermes Agent"),
      "export omitted useful local content or runtime metadata")
    try expect(
      !text.contains("never-export-this-secret") && !text.contains("never-export-this-bookmark")
        && !text.contains(externalRuntime.path) && !text.contains("keychain_account"),
      "export leaked secret or machine-local runtime material")
    try expect(
      FileManager.default.fileExists(atPath: runtimeMarker.path),
      "export modified the user-managed runtime")
    let permissions =
      (try FileManager.default.attributesOfItem(atPath: destination.path)[.posixPermissions]
      as? NSNumber)?.intValue
    try expect(permissions == 0o600, "export file permissions were not 0600")
  }

  private static func testCleanupRequiresConfirmationAndRemovesManagedState() async throws {
    let root = temporaryRoot("cleanup")
    let externalHermes = temporaryRoot("cleanup-user-hermes")
    let externalOpenClaw = temporaryRoot("cleanup-user-openclaw")
    defer {
      try? FileManager.default.removeItem(at: root)
      try? FileManager.default.removeItem(at: externalHermes)
      try? FileManager.default.removeItem(at: externalOpenClaw)
    }
    try FileManager.default.createDirectory(at: externalHermes, withIntermediateDirectories: true)
    try FileManager.default.createDirectory(at: externalOpenClaw, withIntermediateDirectories: true)
    let hermesMarker = externalHermes.appendingPathComponent("run_agent.py")
    let openClawMarker = externalOpenClaw.appendingPathComponent("openclaw.mjs")
    try "user-owned Hermes".write(to: hermesMarker, atomically: true, encoding: .utf8)
    try "user-owned OpenClaw".write(to: openClawMarker, atomically: true, encoding: .utf8)
    let store = MemorySecretStore()
    let services = try RelayConsoleServices(
      userDataPath: root,
      runner: CleanupCommandRunner(),
      secretStore: store,
      refreshInstalledHarnessesOnLaunch: false,
      startRuntimeBrokerServer: false
    )
    let reference = try services.secrets.set(
      scope: "test", label: "Cleanup Token", secretValue: "remove-me")
    _ = try services.data.upsertHarness(
      runtimeType: .hermes,
      displayName: "User-managed Hermes Agent",
      mode: .userManaged,
      config: [
        "installPath": .string(externalHermes.path), "runtimeOwnership": .string("user_managed"),
      ]
    )
    _ = try services.data.upsertHarness(
      runtimeType: .openclaw,
      displayName: "User-managed OpenClaw",
      mode: .userManaged,
      config: [
        "installPath": .string(externalOpenClaw.path), "runtimeOwnership": .string("user_managed"),
      ]
    )
    try "managed".write(
      to: services.paths.harnessesDir.appendingPathComponent("cleanup-marker"), atomically: true,
      encoding: .utf8)
    do {
      _ = try await services.dataLifecycle.executeCleanup(
        kind: .resetLocalData, confirmation: "reset")
      throw DataLifecycleTestFailure(description: "cleanup accepted the wrong confirmation")
    } catch is DataLifecycleTestFailure {
      throw DataLifecycleTestFailure(description: "cleanup accepted the wrong confirmation")
    } catch {
      try expect(
        FileManager.default.fileExists(atPath: root.path), "rejected cleanup changed managed state")
    }
    let result = try await services.dataLifecycle.executeCleanup(
      kind: .resetLocalData,
      confirmation: LocalDataCleanupKind.resetLocalData.confirmationPhrase
    )
    try expect(result.removedSecretCount == 1, "cleanup did not remove every Keychain reference")
    try expect(
      !store.exists(account: reference.keychainAccount), "cleanup left the secret in the store")
    try expect(
      FileManager.default.fileExists(atPath: root.path),
      "Relay reset removed the runtime-preservation root"
    )
    try expect(
      FileManager.default.fileExists(
        atPath: services.paths.harnessesDir.appendingPathComponent("cleanup-marker").path
      ),
      "Relay reset deleted retained runtime installation data"
    )
    try expect(
      !FileManager.default.fileExists(atPath: services.paths.databaseDir.path),
      "Relay reset retained the local account database"
    )
    let retainedHermes = try String(contentsOf: hermesMarker, encoding: .utf8)
    let retainedOpenClaw = try String(contentsOf: openClawMarker, encoding: .utf8)
    try expect(
      retainedHermes == "user-owned Hermes",
      "cleanup modified or deleted the user-managed Hermes installation")
    try expect(
      retainedOpenClaw == "user-owned OpenClaw",
      "cleanup modified or deleted the user-managed OpenClaw installation")
    try expect(result.requiresApplicationExit, "cleanup did not require app exit")
  }

  private static func testSourceWiring() throws {
    let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    let viewModel = try RelayConsoleSourceTestSupport.appViewModelSource(root: root)
    let views = try RelayConsoleSourceTestSupport.viewSource(root: root)
    let lifecycle = try String(
      contentsOf: root.appendingPathComponent(
        "Sources/RelayConsoleCore/LocalDataLifecycleService.swift"), encoding: .utf8)
    try expect(
      viewModel.contains("NSSavePanel") && viewModel.contains("writeRedactedExport"),
      "UI does not write a user-selected export file")
    try expect(
      views.contains("PREPARE FOR APP REMOVAL") || views.contains("confirmationPhrase"),
      "cleanup UI does not require typed confirmation")
    try expect(views.contains("Delete local data"), "local cleanup is not exposed")
    try expect(
      !views.contains("Prepare for app removal"),
      "specialized uninstall cleanup should not be exposed in the compact Security pane")
    try expect(
      lifecycle.contains("removePersistentDomain"),
      "cleanup does not clear Relay Console UserDefaults")
  }

  private static func temporaryRoot(_ label: String) -> URL {
    FileManager.default.temporaryDirectory.appendingPathComponent(
      "relay-console-\(label)-\(UUID().uuidString)", isDirectory: true)
  }

  private static func unwrap<T>(_ value: T?, _ message: String) throws -> T {
    guard let value else { throw DataLifecycleTestFailure(description: message) }
    return value
  }

  private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
    guard condition() else { throw DataLifecycleTestFailure(description: message) }
  }
}
