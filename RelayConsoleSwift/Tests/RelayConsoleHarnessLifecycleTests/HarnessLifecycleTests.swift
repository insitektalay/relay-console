import Foundation
import RelayConsoleCore

private struct HarnessLifecycleTestFailure: Error, CustomStringConvertible {
    let description: String
}

@main
struct RelayConsoleHarnessLifecycleTests {
    static func main() async throws {
        let manifest = try HarnessCompatibilityManifest.loadCurrent()
        let hermes = try manifest.pin(for: .hermes)
        let openClaw = try manifest.pin(for: .openclaw)
        try expect(hermes.version == "v2026.7.7.2" && hermes.commit.count == 40, "Hermes tested release pin should load")
        try expect(openClaw.version == "v2026.6.11" && openClaw.commit.count == 40, "OpenClaw tested release pin should load")
        try expect(hermes.gitRef.hasPrefix("refs/tags/") && openClaw.gitRef.hasPrefix("refs/tags/"), "source installs must use reviewed tags")
        try expect(manifest.toolchains.nodeArtifacts.count == 2 && manifest.toolchains.uvArtifacts.count == 2, "both supported Mac architectures need verified Node and uv artifacts")

        let integrityFile = FileManager.default.temporaryDirectory.appendingPathComponent("relay-integrity-\(UUID().uuidString)")
        try Data("abc".utf8).write(to: integrityFile)
        try RelayArtifactIntegrity.verify(integrityFile, expectedSHA256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", label: "test artifact")
        try Data("tampered".utf8).write(to: integrityFile)
        do {
            try RelayArtifactIntegrity.verify(integrityFile, expectedSHA256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", label: "test artifact")
            throw HarnessLifecycleTestFailure(description: "tampered artifact should fail")
        } catch let error as HarnessLifecycleTestFailure {
            throw error
        } catch {
            try expect(!FileManager.default.fileExists(atPath: integrityFile.path), "failed download should be deleted before extraction")
        }

        let root = FileManager.default.temporaryDirectory.appendingPathComponent("relay-harness-update-\(UUID().uuidString)", isDirectory: true)
        defer { try? FileManager.default.removeItem(at: root) }
        try await testRuntimeDiscovery(root: root)
        let install = root.appendingPathComponent("install", isDirectory: true)
        let state = root.appendingPathComponent("state", isDirectory: true)
        let backups = root.appendingPathComponent("backups", isDirectory: true)
        try FileManager.default.createDirectory(at: install, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: state, withIntermediateDirectories: true)
        try Data("previous-source".utf8).write(to: install.appendingPathComponent("run_agent.py"))
        try Data("previous-private-state".utf8).write(to: state.appendingPathComponent("profile.json"))

        let backup = try HarnessUpdateTransaction.begin(
            harnessKey: .hermes,
            installPath: install,
            statePath: state,
            backupRoot: backups,
            previousVersion: "v-old",
            previousCommit: String(repeating: "a", count: 40)
        )
        try expect(!FileManager.default.fileExists(atPath: install.path), "begin should atomically move the previous source out of the install path")
        try expect(FileManager.default.fileExists(atPath: backup.source.appendingPathComponent("run_agent.py").path), "backup should retain previous source")
        try expect(FileManager.default.fileExists(atPath: backup.state.appendingPathComponent("profile.json").path), "backup should retain private state")

        try FileManager.default.createDirectory(at: install, withIntermediateDirectories: true)
        try Data("broken-update".utf8).write(to: install.appendingPathComponent("run_agent.py"))
        try Data("mutated-state".utf8).write(to: state.appendingPathComponent("profile.json"))
        try HarnessUpdateTransaction.restore(backup, installPath: install, statePath: state)
        try expect(try String(contentsOf: install.appendingPathComponent("run_agent.py"), encoding: .utf8) == "previous-source", "rollback should restore source")
        try expect(try String(contentsOf: state.appendingPathComponent("profile.json"), encoding: .utf8) == "previous-private-state", "rollback should restore state")

        let userRoot = root.appendingPathComponent("user-managed", isDirectory: true)
        let hermesInstall = userRoot.appendingPathComponent("hermes-agent", isDirectory: true)
        let hermesPython = hermesInstall.appendingPathComponent("venv/bin/python")
        try FileManager.default.createDirectory(at: hermesPython.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("# user-owned Hermes source".utf8).write(to: hermesInstall.appendingPathComponent("run_agent.py"))
        try Data("#!/bin/sh\nexit 0\n".utf8).write(to: hermesPython)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: hermesPython.path)
        let runner = UserManagedHarnessRunner()
        let services = try RelayConsoleServices(
            userDataPath: userRoot.appendingPathComponent("relay-data", isDirectory: true),
            appVersion: "test",
            runner: runner,
            secretStore: MemorySecretStore(),
            refreshInstalledHarnessesOnLaunch: false,
            openExternal: { _ in }
        )

        let incompleteHermes = userRoot.appendingPathComponent("incomplete-hermes", isDirectory: true)
        try FileManager.default.createDirectory(at: incompleteHermes, withIntermediateDirectories: true)
        try Data("# marker without an environment".utf8).write(to: incompleteHermes.appendingPathComponent("run_agent.py"))
        do {
            _ = try await services.harnessInstall.connectExisting(harnessKey: .hermes, location: incompleteHermes)
            throw HarnessLifecycleTestFailure(description: "Hermes selection without .venv or venv should fail")
        } catch let error as HarnessLifecycleTestFailure {
            throw error
        } catch {
            try expect(error.localizedDescription.contains("both .venv and venv"), "invalid Hermes selection should explain both supported layouts")
        }

        let invalidOpenClaw = userRoot.appendingPathComponent("not-openclaw", isDirectory: true)
        try FileManager.default.createDirectory(at: invalidOpenClaw, withIntermediateDirectories: true)
        try Data("// untrusted entry point".utf8).write(to: invalidOpenClaw.appendingPathComponent("openclaw.mjs"))
        try Data(#"{"name":"different-package","version":"1.0.0"}"#.utf8).write(to: invalidOpenClaw.appendingPathComponent("package.json"))
        do {
            _ = try await services.harnessInstall.connectExisting(harnessKey: .openclaw, location: invalidOpenClaw)
            throw HarnessLifecycleTestFailure(description: "an unrelated package should not connect as OpenClaw")
        } catch let error as HarnessLifecycleTestFailure {
            throw error
        } catch {
            try expect(error.localizedDescription.contains("not an OpenClaw checkout"), "invalid OpenClaw selection should have an actionable error")
        }

        let connected = try await services.harnessInstall.connectExisting(
            harnessKey: .hermes,
            location: hermesInstall,
            securityScopedBookmark: "test-bookmark"
        )
        try expect(connected.record.source == .located, "existing Hermes should be recorded as user-located")
        try expect(connected.record.lifecycleState == .connected, "healthy existing Hermes with the official venv layout should connect")
        let storedHarness = try services.data.getHarnessByRuntimeType(.hermes)
        try expect(storedHarness?.mode == .userManaged, "existing Hermes must use user-managed ownership")
        let commands = await runner.commands()
        try expect(commands.allSatisfy { !$0.contains("clone") && !$0.contains("install") && !$0.contains("sync") }, "connecting must not install or mutate Hermes")

        let openClawInstall = userRoot.appendingPathComponent("openclaw", isDirectory: true)
        try FileManager.default.createDirectory(at: openClawInstall, withIntermediateDirectories: true)
        try Data("// user-owned OpenClaw entry point".utf8).write(to: openClawInstall.appendingPathComponent("openclaw.mjs"))
        try Data(#"{"name":"openclaw","version":"2026.7.1"}"#.utf8).write(to: openClawInstall.appendingPathComponent("package.json"))
        let openClawConnection = try await services.harnessInstall.connectExisting(
            harnessKey: .openclaw,
            location: openClawInstall,
            securityScopedBookmark: "test-openclaw-bookmark"
        )
        try expect(openClawConnection.record.source == .located, "existing OpenClaw should be recorded as user-located")
        try expect(openClawConnection.record.lifecycleState == .connected, "healthy existing OpenClaw should connect")
        let storedOpenClaw = try services.data.getHarnessByRuntimeType(.openclaw)
        try expect(storedOpenClaw?.mode == .userManaged, "existing OpenClaw must use user-managed ownership")
        let allCommands = await runner.commands()
        let forbiddenOpenClawMutations = ["gateway install", "gateway start", "gateway restart", "config set", "agents add"]
        try expect(
            allCommands.allSatisfy { command in !forbiddenOpenClawMutations.contains(where: command.contains) },
            "connecting and checking OpenClaw must not configure, install, or start it"
        )

        let legacySource = services.paths.harnessesDir.appendingPathComponent("hermes-agent", isDirectory: true)
        let retainedHermesState = services.paths.hermesHomeDir.appendingPathComponent("retained-profile.json")
        try FileManager.default.createDirectory(at: legacySource, withIntermediateDirectories: true)
        try Data("legacy Relay-managed source".utf8).write(to: legacySource.appendingPathComponent("run_agent.py"))
        try Data("runtime-created state".utf8).write(to: retainedHermesState)
        let legacyHarness = try services.data.upsertHarness(
            runtimeType: .hermes,
            displayName: "Hermes Agent",
            mode: .appManaged,
            config: [
                "kind": .string("external_harness_install"),
                "harnessKey": .string(HarnessKey.hermes.rawValue),
                "source": .string(HarnessInstallSource.managed.rawValue),
                "lifecycleState": .string(HarnessLifecycleState.installed.rawValue),
                "installPath": .string(legacySource.path),
                "dependencyStatus": .string("installed"),
                "modelAuthStatus": .string(HarnessModelAuthStatus.connected.rawValue)
            ]
        )
        let removedLegacy = try services.harnessInstall.removeLegacyManagedRuntime(harnessKey: .hermes)
        try expect(!FileManager.default.fileExists(atPath: legacySource.path), "explicit migration should remove only the old Relay-managed runtime source")
        try expect(FileManager.default.fileExists(atPath: retainedHermesState.path), "explicit migration must preserve runtime-created state and credentials")
        try expect(removedLegacy.record.source == .missing, "removed legacy runtime should return to Connect Existing")
        try expect(removedLegacy.record.harnessId == legacyHarness.id, "migration must preserve the harness identity used by existing agent mappings")
        try expect(removedLegacy.harness?.mode == .userManaged, "post-migration harness ownership must be user-managed")

        let outsideLegacySource = userRoot.appendingPathComponent("must-not-delete", isDirectory: true)
        try FileManager.default.createDirectory(at: outsideLegacySource, withIntermediateDirectories: true)
        try Data("user-owned".utf8).write(to: outsideLegacySource.appendingPathComponent("run_agent.py"))
        _ = try services.data.upsertHarness(
            runtimeType: .hermes,
            displayName: "Hermes Agent",
            mode: .appManaged,
            config: [
                "kind": .string("external_harness_install"),
                "harnessKey": .string(HarnessKey.hermes.rawValue),
                "source": .string(HarnessInstallSource.managed.rawValue),
                "lifecycleState": .string(HarnessLifecycleState.installed.rawValue),
                "installPath": .string(outsideLegacySource.path),
                "dependencyStatus": .string("installed"),
                "modelAuthStatus": .string(HarnessModelAuthStatus.connected.rawValue)
            ]
        )
        do {
            _ = try services.harnessInstall.removeLegacyManagedRuntime(harnessKey: .hermes)
            throw HarnessLifecycleTestFailure(description: "migration must refuse any source outside Relay's exact legacy managed folder")
        } catch let error as HarnessLifecycleTestFailure {
            throw error
        } catch {
            try expect(FileManager.default.fileExists(atPath: outsideLegacySource.path), "refused migration must preserve the user-owned folder")
        }
        print("RelayConsoleHarnessLifecycleTests passed")
    }

    private static func testRuntimeDiscovery(root: URL) async throws {
        let home = root.appendingPathComponent("discovery-home", isDirectory: true)
        let dotVenvHermes = home.appendingPathComponent(".hermes/hermes-agent", isDirectory: true)
        let venvHermes = home.appendingPathComponent("Projects/hermes-agent", isDirectory: true)
        let invalidHermes = home.appendingPathComponent("Developer/hermes-agent", isDirectory: true)
        try makeHermes(at: dotVenvHermes, environment: ".venv", version: "0.20.1")
        try makeHermes(at: venvHermes, environment: "venv", version: nil)
        try FileManager.default.createDirectory(at: invalidHermes, withIntermediateDirectories: true)
        try Data("# missing Python environment".utf8).write(to: invalidHermes.appendingPathComponent("run_agent.py"))

        let openClaw = home.appendingPathComponent(".npm-global/lib/node_modules/openclaw", isDirectory: true)
        try FileManager.default.createDirectory(at: openClaw, withIntermediateDirectories: true)
        try Data("// official entry point".utf8).write(to: openClaw.appendingPathComponent("openclaw.mjs"))
        try Data(#"{"name":"openclaw","version":"2026.7.1"}"#.utf8).write(to: openClaw.appendingPathComponent("package.json"))
        let command = home.appendingPathComponent(".npm-global/bin/openclaw")
        try FileManager.default.createDirectory(at: command.deletingLastPathComponent(), withIntermediateDirectories: true)
        try FileManager.default.createSymbolicLink(at: command, withDestinationURL: openClaw.appendingPathComponent("openclaw.mjs"))

        let node = home.appendingPathComponent("bin/node")
        try FileManager.default.createDirectory(at: node.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("#!/bin/sh\nexit 0\n".utf8).write(to: node)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: node.path)

        let configuration = RuntimeDiscoverySearchConfiguration(
            homeDirectory: home,
            hermesLocations: [dotVenvHermes, venvHermes, invalidHermes, dotVenvHermes],
            openClawCommandLocations: [command],
            openClawPackageLocations: [openClaw],
            nodeLocations: [node]
        )
        let candidates = await RuntimeInstallationDiscovery.discover(configuration: configuration)
        let hermesCandidates = candidates.filter { $0.harnessKey == .hermes }
        let openClawCandidates = candidates.filter { $0.harnessKey == .openclaw }
        try expect(hermesCandidates.count == 2, "discovery should accept .venv and venv, reject incomplete installs, and remove duplicates")
        try expect(hermesCandidates.first(where: { $0.location == dotVenvHermes })?.version == "0.20.1", "Hermes discovery should report a pyproject version when available")
        try expect(openClawCandidates.count == 1, "OpenClaw command symlink and package path should resolve to one candidate")
        try expect(openClawCandidates.first?.location == openClaw.resolvingSymlinksInPath().standardizedFileURL, "OpenClaw discovery should resolve the command to its package")
        try expect(openClawCandidates.first?.version == "2026.7.1", "OpenClaw discovery should report the package version")
        try expect(candidates.allSatisfy { $0.compatibility == .ready }, "only validated ready candidates should be shown")

        let missing = await RuntimeInstallationDiscovery.discover(configuration: RuntimeDiscoverySearchConfiguration(
            homeDirectory: home,
            hermesLocations: [home.appendingPathComponent("missing-hermes")],
            openClawCommandLocations: [home.appendingPathComponent("missing-openclaw")],
            openClawPackageLocations: [],
            nodeLocations: [node]
        ))
        try expect(missing.isEmpty, "missing installations should produce no candidates")
    }

    private static func makeHermes(at root: URL, environment: String, version: String?) throws {
        let python = root.appendingPathComponent("\(environment)/bin/python")
        try FileManager.default.createDirectory(at: python.deletingLastPathComponent(), withIntermediateDirectories: true)
        try Data("# official entry point".utf8).write(to: root.appendingPathComponent("run_agent.py"))
        try Data("#!/bin/sh\nexit 0\n".utf8).write(to: python)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: python.path)
        if let version {
            try Data("[project]\nname = \"hermes-agent\"\nversion = \"\(version)\"\n".utf8).write(to: root.appendingPathComponent("pyproject.toml"))
        }
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else { throw HarnessLifecycleTestFailure(description: message) }
    }
}

private final class UserManagedHarnessRunner: CommandRunning, @unchecked Sendable {
    private let recorder = UserManagedCommandRecorder()

    func commands() async -> [String] {
        await recorder.values
    }

    func run(_ command: String, _ args: [String], options: CommandOptions) async -> CommandResult {
        await recorder.append(([command] + args).joined(separator: " "))
        if command == "/usr/bin/git", args == ["rev-parse", "HEAD"] {
            return CommandResult(code: 0, stdout: String(repeating: "a", count: 40), stderr: "")
        }
        if args.contains("importlib.metadata; print(importlib.metadata.version('hermes-agent'))") {
            return CommandResult(code: 0, stdout: "1.2.3\n", stderr: "")
        }
        if args.contains("import run_agent, tui_gateway.entry; print('ok')") {
            return CommandResult(code: 0, stdout: "ok\n", stderr: "")
        }
        if args == ["openclaw.mjs", "--version"] {
            return CommandResult(code: 0, stdout: "2026.7.1\n", stderr: "")
        }
        if args == ["openclaw.mjs", "models", "auth", "list", "--provider", "openai", "--json"] {
            return CommandResult(code: 0, stdout: #"{"profiles":[{"provider":"openai","type":"oauth"}]}"#, stderr: "")
        }
        if args == ["openclaw.mjs", "gateway", "status", "--json"] {
            return CommandResult(code: 0, stdout: #"{"status":"running"}"#, stderr: "")
        }
        if args == ["openclaw.mjs", "agents", "list", "--json"] {
            return CommandResult(code: 0, stdout: #"{"agents":[]}"#, stderr: "")
        }
        if args.contains("-c") {
            return CommandResult(code: 0, stdout: #"{"logged_in":true}"#, stderr: "")
        }
        return CommandResult(code: 1, stdout: "", stderr: "unexpected test command")
    }

    func spawn(
        _ command: String,
        _ args: [String],
        options: CommandOptions,
        stdin: String?
    ) async throws -> (process: Process, result: Task<CommandResult, Never>) {
        throw RelayError(.unsupported, "spawn is not used by user-managed connection tests")
    }
}

private actor UserManagedCommandRecorder {
    private(set) var values: [String] = []

    func append(_ value: String) {
        values.append(value)
    }
}
