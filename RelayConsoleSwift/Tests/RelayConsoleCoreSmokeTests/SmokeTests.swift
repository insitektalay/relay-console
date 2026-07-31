import Foundation
import RelayConsoleCore

@main
struct RelayConsoleCoreSmokeTests {
    static func main() throws {
        try run("default local state creates one profile and workspace", testDefaultLocalState)
        try run("environment user data path override uses temporary local state", testEnvironmentUserDataPathOverrideUsesTemporaryState)
        try run("install catalog exposes Hermes and OpenClaw only", testInstallCatalogRecords)
        try run("Hermes legacy runtime override cleanup runs once on startup", testHermesLegacyRuntimeOverrideCleanupRunsOnceOnStartup)
        try run("createAgent always creates a distinct local agent", testCreateAgentIsNotIdempotent)
        try run("ensureAgentForHarness reuses an existing harness-bound agent", testEnsureAgentForHarnessIsIdempotent)
        try run("secrets and token-like values are redacted from persisted records and logs", testSecretsAreRedactedFromSQLite)
        try run("no fake welcome messages are created with the default workspace", testDefaultWorkspaceHasNoWelcomeMessages)
        try run("runtime HTML failures are replaced with useful plain-language errors", testRuntimeHTMLFailuresAreSanitized)
        print("RelayConsoleCoreSmokeTests passed")
    }

    private static func testRuntimeHTMLFailuresAreSanitized() throws {
        let html = "<html><head><title>Unexpected response</title></head><body><svg>loading</svg></body></html>"
        let sanitized = userFacingRuntimeFailureMessage(html, runtimeName: "Hermes Agent")
        try expect(!sanitized.contains("<html"), "runtime HTML should not reach the chat surface")
        try expect(sanitized.contains("Hermes Agent returned an unexpected web page"), "runtime HTML should have an actionable replacement")

        let ordinary = "Hermes Agent stopped before replying."
        try expect(
            userFacingRuntimeFailureMessage(ordinary, runtimeName: "Hermes Agent") == ordinary,
            "ordinary runtime errors should be preserved"
        )
    }

    private static func run(_ name: String, _ test: () throws -> Void) throws {
        do {
            try test()
            print("ok - \(name)")
        } catch {
            print("not ok - \(name): \(error)")
            throw error
        }
    }

    private static func testDefaultLocalState() throws {
        let services = try makeServices()
        let state = try services.data.getAppState()

        try expect(state.appName == "Relay Console", "unexpected app name")
        try expect(state.hasProfile, "profile was not created")
        try expect(state.activeProfile?.displayName == "Local user", "unexpected profile name")
        try expect(state.activeWorkspace?.name == "Local workspace", "unexpected workspace name")
        try expect(!state.firstRunRequired, "first run should be complete")
    }

    private static func testInstallCatalogRecords() throws {
        let services = try makeServices()
        let records = try services.harnessInstall.listRecords()

        try expect(records.map(\.harnessKey) == [.hermes, .openclaw], "unexpected harness keys")
        try expect(records.map(\.runtimeType) == [.hermes, .openclaw], "unexpected runtime types")
        try expect(records.allSatisfy { $0.lifecycleState == .notInstalled }, "fresh records should be not installed")
    }

    private static func testEnvironmentUserDataPathOverrideUsesTemporaryState() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("RelayConsoleSwiftCaptureReadiness", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let services = try RelayConsoleServices(
            appVersion: "test",
            runner: StubCommandRunner(),
            secretStore: MemorySecretStore(),
            refreshInstalledHarnessesOnLaunch: false,
            environment: [
                RelayConsoleServices.temporaryUserDataPathEnvironmentKey: root.path
            ],
            openExternal: { _ in }
        )

        try expect(services.paths.root.path == root.path, "environment data root was not used")
        try expect(services.paths.databasePath.path.hasPrefix(root.path), "database path did not stay under temporary root")
        try expect(FileManager.default.fileExists(atPath: services.paths.databasePath.path), "temporary database was not created")
        try expect(try services.data.getAppState().activeProfile?.displayName == "Local user", "temporary root did not initialize default profile")
        try expect(
            RelayConsoleServices.userDataPathOverride(from: [RelayConsoleServices.temporaryUserDataPathEnvironmentKey: "   "]) == nil,
            "blank environment override should be ignored"
        )
        services.database.close()
    }

    private static func testHermesLegacyRuntimeOverrideCleanupRunsOnceOnStartup() throws {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("RelayConsoleSwiftHermesRuntimeCleanup", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        defer { try? FileManager.default.removeItem(at: root) }

        let hermesHome = root.appendingPathComponent("hermes-home", isDirectory: true)
        let profileHome = hermesHome.appendingPathComponent("profiles/legacy-agent", isDirectory: true)
        try FileManager.default.createDirectory(at: profileHome, withIntermediateDirectories: true)
        let legacyRuntime = "codex_" + "app_server"
        let legacyConfig = """
        model:
          provider: openai-codex
          default: gpt-5.5
          openai_runtime: \(legacyRuntime)
          api_mode: \(legacyRuntime)
        delegation:
          api_mode: keep-this-nested-value
        """
        try legacyConfig.write(to: hermesHome.appendingPathComponent("config.yaml"), atomically: true, encoding: .utf8)
        try legacyConfig.write(to: profileHome.appendingPathComponent("config.yaml"), atomically: true, encoding: .utf8)

        let services = try RelayConsoleServices(
            userDataPath: root,
            appVersion: "test",
            runner: StubCommandRunner(),
            secretStore: MemorySecretStore(),
            refreshInstalledHarnessesOnLaunch: false,
            openExternal: { _ in }
        )

        let rootConfig = try String(contentsOf: hermesHome.appendingPathComponent("config.yaml"), encoding: .utf8)
        let profileConfig = try String(contentsOf: profileHome.appendingPathComponent("config.yaml"), encoding: .utf8)
        for config in [rootConfig, profileConfig] {
            try expect(!config.contains("openai_runtime:"), "startup cleanup should remove legacy openai_runtime override")
            try expect(!config.contains("api_mode: \(legacyRuntime)"), "startup cleanup should remove model-level legacy api_mode override")
            try expect(config.contains("api_mode: keep-this-nested-value"), "startup cleanup should not remove unrelated nested api_mode values")
        }
        let hermes = try unwrap(services.data.getHarnessByRuntimeType(.hermes), "missing Hermes harness record")
        try expect(stringValue(hermes.config["hermesRuntimeOverrideCleanupCompletedAt"]) != nil, "startup cleanup should write completion marker")
        services.database.close()

        try legacyConfig.write(to: hermesHome.appendingPathComponent("config.yaml"), atomically: true, encoding: .utf8)
        let relaunched = try RelayConsoleServices(
            userDataPath: root,
            appVersion: "test",
            runner: StubCommandRunner(),
            secretStore: MemorySecretStore(),
            refreshInstalledHarnessesOnLaunch: false,
            openExternal: { _ in }
        )
        let skippedConfig = try String(contentsOf: hermesHome.appendingPathComponent("config.yaml"), encoding: .utf8)
        try expect(skippedConfig.contains("openai_runtime: \(legacyRuntime)"), "startup cleanup should be marker-gated after the first completed run")
        relaunched.database.close()
    }

    private static func testCreateAgentIsNotIdempotent() throws {
        let services = try makeServices()
        let workspace = try unwrap(services.data.getAppState().activeWorkspace, "missing workspace")
        let harness = try services.data.upsertHarness(
            runtimeType: .hermes,
            displayName: "Hermes Agent",
            mode: .appManaged,
            config: [:]
        )

        let first = try services.data.createAgent(
            workspaceId: workspace.id,
            name: "Workflow Assistant",
            harnessId: harness.id,
            externalAgentId: "workflow_assistant"
        )
        let second = try services.data.createAgent(
            workspaceId: workspace.id,
            name: "Workflow Assistant",
            harnessId: harness.id,
            externalAgentId: "workflow_assistant_2"
        )

        try expect(first.id != second.id, "createAgent reused an agent id")
        try expect(first.binding.id != second.binding.id, "createAgent reused a binding id")
        try expect(try services.data.listAgents(workspaceId: workspace.id).count == 2, "expected two agents")
    }

    private static func testEnsureAgentForHarnessIsIdempotent() throws {
        let services = try makeServices()
        let workspace = try unwrap(services.data.getAppState().activeWorkspace, "missing workspace")
        let harness = try services.data.upsertHarness(
            runtimeType: .openclaw,
            displayName: "OpenClaw",
            mode: .appManaged,
            config: [:]
        )

        let first = try services.data.ensureAgentForHarness(
            workspaceId: workspace.id,
            name: "OpenClaw Main",
            harnessId: harness.id,
            externalAgentId: "main"
        )
        let second = try services.data.ensureAgentForHarness(
            workspaceId: workspace.id,
            name: "Different Name",
            harnessId: harness.id,
            externalAgentId: "different"
        )

        try expect(first.id == second.id, "ensureAgentForHarness created a second agent")
        try expect(first.binding.id == second.binding.id, "ensureAgentForHarness created a second binding")
        try expect(try services.data.listAgents(workspaceId: workspace.id).count == 1, "expected one agent")
    }

    private static func testSecretsAreRedactedFromSQLite() throws {
        let services = try makeServices()
        let rawSecret = "sk-test-super-secret"
        let installPath = "/Users/example/Library/Application Support/Relay Console/harnesses/hermes-agent"

        let reference = try services.secrets.set(scope: "test", label: "OpenAI API Key", secretValue: rawSecret)
        try expect(try services.secrets.getSecretValue(reference.id) == rawSecret, "secret did not round-trip through secret store")
        _ = try services.data.upsertHarness(
            runtimeType: .hermes,
            displayName: "Hermes Agent",
            mode: .appManaged,
            config: [
                "installPath": .string(installPath),
                "modelAuthCommand": .object([
                    "command": .string("\(installPath)/.venv/bin/python"),
                    "args": .array([.string("-m"), .string("hermes_cli.main"), .string("auth"), .string("add"), .string("openai-codex"), .string("--type"), .string("oauth")]),
                    "cwd": .string(installPath)
                ]),
                "command": .string("run --api_key=\(rawSecret)"),
                "nested": .object(["authorization": .string("Bearer token-secret-value")])
            ]
        )
        _ = try services.data.log(
            severity: "info",
            category: "test",
            message: "authorization=Bearer token-secret-value",
            detail: ["token": .string("token=\(rawSecret)")]
        )

        let harness = try unwrap(services.data.getHarnessByRuntimeType(.hermes), "missing redacted harness")
        let command = stringValue(harness.config["command"]) ?? ""
        let storedInstallPath = stringValue(harness.config["installPath"]) ?? ""
        let storedModelAuthCommand: JSONRecord
        if case .object(let commandSpec) = harness.config["modelAuthCommand"] {
            storedModelAuthCommand = commandSpec
        } else {
            storedModelAuthCommand = [:]
        }
        let nestedAuth: String
        if case .object(let nested) = harness.config["nested"] {
            nestedAuth = stringValue(nested["authorization"]) ?? ""
        } else {
            nestedAuth = ""
        }
        let log = try unwrap(
            services.data.queryEventLog().first { $0.category == "test" },
            "missing redacted log"
        )
        try expect(command.contains("[REDACTED]"), "harness command was not redacted")
        try expect(storedInstallPath == installPath, "harness install path should remain usable")
        try expect(stringValue(storedModelAuthCommand["cwd"]) == installPath, "harness auth command cwd should remain usable")
        try expect(nestedAuth.contains("[REDACTED]"), "nested auth token was not redacted")
        try expect(log.message.contains("[REDACTED]"), "log message was not redacted")
        try expect((stringValue(log.detail["token"]) ?? "").contains("[REDACTED]"), "log detail was not redacted")

        let sqliteBytes = try Data(contentsOf: services.paths.databasePath)
        let sqliteText = String(decoding: sqliteBytes, as: UTF8.self)
        try expect(!sqliteText.contains(rawSecret), "raw secret was persisted in SQLite")
        try expect(!sqliteText.contains("token-secret-value"), "raw bearer token was persisted in SQLite")
    }

    private static func testDefaultWorkspaceHasNoWelcomeMessages() throws {
        let services = try makeServices()
        let workspace = try unwrap(services.data.getAppState().activeWorkspace, "missing workspace")

        try expect(try services.data.listThreads(workspaceId: workspace.id).isEmpty, "default workspace should not create fake welcome threads")
        try expect(
            try services.data.queryEventLog().contains { $0.message.contains("Default local Relay Console workspace initialized.") },
            "default initialization event was not logged"
        )
    }

    private static func makeServices() throws -> RelayConsoleServices {
        let root = FileManager.default.temporaryDirectory
            .appendingPathComponent("RelayConsoleSwiftTests", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        return try RelayConsoleServices(
            userDataPath: root,
            appVersion: "test",
            runner: StubCommandRunner(),
            secretStore: MemorySecretStore(),
            refreshInstalledHarnessesOnLaunch: false,
            openExternal: { _ in }
        )
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else {
            throw SmokeTestFailure(message)
        }
    }

    private static func unwrap<T>(_ value: T?, _ message: String) throws -> T {
        guard let value else {
            throw SmokeTestFailure(message)
        }
        return value
    }
}

private struct SmokeTestFailure: Error, CustomStringConvertible {
    var description: String
    init(_ description: String) {
        self.description = description
    }
}

private final class StubCommandRunner: CommandRunning {
    func run(_ command: String, _ args: [String], options: CommandOptions) async -> CommandResult {
        CommandResult(code: 127, stdout: "", stderr: "stubbed command runner: \(command)")
    }

    func spawn(_ command: String, _ args: [String], options: CommandOptions, stdin: String?) async throws -> (process: Process, result: Task<CommandResult, Never>) {
        throw RelayError(.unsupported, "spawn is not available in tests")
    }
}
