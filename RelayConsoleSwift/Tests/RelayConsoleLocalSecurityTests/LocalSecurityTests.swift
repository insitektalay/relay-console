import Foundation
import RelayConsoleCore

struct LocalSecurityTestFailure: Error, CustomStringConvertible {
    let description: String
}

@main
enum RelayConsoleLocalSecurityTests {
    static func main() async throws {
        try testManagedModesAreCreatedAndRepaired()
        try testDatabaseModesArePrivate()
        try testSecretContinuityAcrossServiceReopen()
        try testProductionKeychainUsesModernStableAttributes()
        try testExternalArtifactURLPolicy()
        try testExternalArtifactSourceBoundary()
        try await testProcessRunnerRejectsPathAndUnknownExecutables()
        try await testProcessRunnerValidatesPythonVirtualEnvironments()
        try await testConfiguredHermesPythonEnvironment()
        try await testProcessRunnerBoundsOutputAndTime()
        try await testProcessRunnerRedactsDiagnosticsAndSanitizesEnvironment()
        try testRuntimeFailureClassification()
        try testProcessExecutionSourceContract()
        print("RelayConsoleLocalSecurityTests passed")
    }

    private static func testExternalArtifactURLPolicy() throws {
        guard let destination = ExternalArtifactURLPolicy.destination(
            "HTTPS://Docs.Example.test:443/brief?q=1#section"
        ) else {
            throw LocalSecurityTestFailure(
                description: "canonical HTTPS artifact URL was rejected"
            )
        }
        try expect(
            destination.normalizedURL == "https://docs.example.test/brief?q=1#section",
            "artifact URL was not canonicalized"
        )
        try expect(destination.host == "docs.example.test", "destination host was not bounded")

        for value in [
            "http://docs.example.test/brief",
            "//docs.example.test/brief",
            "https:docs.example.test/brief",
            " https://docs.example.test/brief",
            "https://user:secret@docs.example.test/brief",
            "https://docs.example.test\\@attacker.test/brief",
            "https://docs.example.test/\nattacker",
            "javascript:alert(1)",
        ] {
            try expect(
                ExternalArtifactURLPolicy.destination(value) == nil,
                "unsafe artifact URL was accepted: \(value)"
            )
        }
    }

    private static func testExternalArtifactSourceBoundary() throws {
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let core = try [
            "Sources/RelayConsoleCore/ArtifactLibraryService.swift",
            "Sources/RelayConsoleCore/CloudRelaySync.swift",
            "Sources/RelayConsoleCore/ExternalArtifactSyncPolicy.swift",
            "Sources/RelayConsoleCore/RuntimeBridge.swift",
        ].map {
            try String(contentsOf: root.appendingPathComponent($0), encoding: .utf8)
        }.joined(separator: "\n")
        let app = try [
            "Sources/RelayConsoleApp/Features/Agents/AppViewModel+Agents.swift",
            "Sources/RelayConsoleApp/Features/Artifacts/ArtifactViews.swift",
        ].map {
            try String(contentsOf: root.appendingPathComponent($0), encoding: .utf8)
        }.joined(separator: "\n")

        try expect(
            core.components(separatedBy: "ExternalArtifactURLPolicy.destination(").count - 1 >= 3
                && core.contains("ExternalArtifactURLPolicy.destination(rawValue)"),
            "native manifest or cloud synchronization bypasses the artifact URL policy"
        )
        try expect(
            app.contains("ExternalArtifactURLPolicy.destination(artifact.externalURL)"),
            "native presentation or opener bypasses the artifact URL policy"
        )
        try expect(
            app.contains("NSWorkspace.shared.open(destination.url)"),
            "native opener does not use the revalidated destination"
        )
        try expect(
            !app.contains("URL(string: rawURL)"),
            "native opener still parses an unvalidated raw artifact URL"
        )
        try expect(
            core.contains("absolute HTTPS URL without embedded credentials"),
            "runtime artifact instructions omit the HTTPS-only contract"
        )
    }

    private static func testManagedModesAreCreatedAndRepaired() throws {
        let root = temporaryRoot("permissions")
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let unsafeDirectory = root.appendingPathComponent("workspaces/unsafe", isDirectory: true)
        try FileManager.default.createDirectory(at: unsafeDirectory, withIntermediateDirectories: true)
        let unsafeFile = unsafeDirectory.appendingPathComponent("private.txt")
        let executable = unsafeDirectory.appendingPathComponent("owner-tool")
        try Data("private".utf8).write(to: unsafeFile)
        try Data("tool".utf8).write(to: executable)
        try FileManager.default.setAttributes([.posixPermissions: 0o777], ofItemAtPath: root.path)
        try FileManager.default.setAttributes([.posixPermissions: 0o777], ofItemAtPath: unsafeDirectory.path)
        try FileManager.default.setAttributes([.posixPermissions: 0o666], ofItemAtPath: unsafeFile.path)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: executable.path)

        let paths = try AppPathsService(basePath: root).ensure()
        try expect(mode(paths.root) == 0o700, "managed root mode was not repaired to 0700")
        try expect(mode(unsafeDirectory) == 0o700, "managed directory mode was not repaired to 0700")
        try expect(mode(unsafeFile) == 0o600, "managed file mode was not repaired to 0600")
        try expect(mode(executable) == 0o700, "owner execute permission was not preserved privately")
    }

    private static func testDatabaseModesArePrivate() throws {
        let root = temporaryRoot("database")
        defer { try? FileManager.default.removeItem(at: root) }
        let paths = try AppPathsService(basePath: root).ensure()
        let database = DatabaseService(databasePath: paths.databasePath)
        try database.open()
        try database.exec("CREATE TABLE IF NOT EXISTS mode_test (id TEXT PRIMARY KEY)")
        try expect(mode(paths.databasePath) == 0o600, "SQLite database mode was not 0600")
        for suffix in ["-wal", "-shm"] {
            let sidecar = URL(fileURLWithPath: paths.databasePath.path + suffix)
            if FileManager.default.fileExists(atPath: sidecar.path) {
                try expect(mode(sidecar) == 0o600, "SQLite sidecar \(suffix) mode was not 0600")
            }
        }
        database.close()
        do {
            _ = try database.all("SELECT 1")
            throw LocalSecurityTestFailure(description: "closed database query did not fail")
        } catch let error as RelayError {
            try expect(error.code == .databaseUnavailable, "closed database query returned the wrong error")
        }
    }

    private static func testSecretContinuityAcrossServiceReopen() throws {
        let root = temporaryRoot("keychain")
        defer { try? FileManager.default.removeItem(at: root) }
        let paths = try AppPathsService(basePath: root).ensure()
        let store = MemorySecretStore()
        let referenceId: String
        do {
            let database = DatabaseService(databasePath: paths.databasePath)
            try database.open()
            try runMigrations(database: database)
            let secrets = SecretService(database: database, store: store)
            let reference = try secrets.set(scope: "continuity", label: "Provider Token", secretValue: "retained-across-update")
            referenceId = reference.id
            try expect(try secrets.repairStoredAccess() == 1, "legacy access repair did not process the saved reference")
            database.close()
        }
        do {
            let database = DatabaseService(databasePath: paths.databasePath)
            try database.open()
            let secrets = SecretService(database: database, store: store)
            try expect(try secrets.getSecretValue(referenceId) == "retained-across-update", "stable service/account lookup did not survive service reopen")
            database.close()
        }
    }

    private static func testProductionKeychainUsesModernStableAttributes() throws {
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let source = try String(contentsOf: root.appendingPathComponent("Sources/RelayConsoleCore/SecretService.swift"), encoding: .utf8)
        try expect(source.contains("kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly"), "Keychain item does not use the reviewed device-only accessibility class")
        try expect(source.contains("kSecAttrService") && source.contains("kSecAttrAccount"), "Keychain lookup does not retain stable service/account identity")
        try expect(source.contains("interactionNotAllowed = true"), "Keychain reads can block app launch waiting for authentication UI")
        try expect(!source.contains("kSecUseAuthenticationUI"), "deprecated Keychain authentication UI policy remains")
        for deprecated in ["SecTrustedApplicationCreateFromPath", "SecAccessCreate", "kSecAttrAccess as String"] {
            try expect(!source.contains(deprecated), "deprecated per-binary Keychain ACL remains: \(deprecated)")
        }
    }

    private static func testProcessRunnerRejectsPathAndUnknownExecutables() async throws {
        let root = temporaryRoot("process-path")
        defer { try? FileManager.default.removeItem(at: root) }
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        let marker = root.appendingPathComponent("path-command-ran")
        let fakeGit = root.appendingPathComponent("git")
        try Data("#!/bin/sh\n/usr/bin/touch '\(marker.path)'\n".utf8).write(to: fakeGit)
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o700],
            ofItemAtPath: fakeGit.path
        )

        let runner = ProcessCommandRunner()
        var hostileEnvironment = CommandExecutionEnvironment.minimal
        hostileEnvironment["PATH"] = "\(root.path):/usr/bin:/bin"
        let relative = await runner.run(
            "git",
            ["--version"],
            options: CommandOptions(env: hostileEnvironment, timeoutMs: 5_000)
        )
        try expect(relative.code == 127, "relative executable was not rejected")
        try expect(
            !FileManager.default.fileExists(atPath: marker.path),
            "hostile PATH executable was launched"
        )

        let unknown = await runner.run(
            "/bin/sh",
            ["-c", "exit 0"],
            options: CommandOptions(timeoutMs: 5_000)
        )
        try expect(unknown.code == 127, "unknown absolute executable was not rejected")

        let allowed = await runner.run(
            "/usr/bin/git",
            ["--version"],
            options: CommandOptions(timeoutMs: 10_000)
        )
        try expect(allowed.code == 0, "allowlisted absolute Git did not run")

        let trustedDirectory = root.appendingPathComponent("trusted", isDirectory: true)
        try FileManager.default.createDirectory(at: trustedDirectory, withIntermediateDirectories: true)
        let escapingSymlink = trustedDirectory.appendingPathComponent("escape")
        try FileManager.default.createSymbolicLink(
            at: escapingSymlink,
            withDestinationURL: URL(fileURLWithPath: "/bin/sh")
        )
        let escaped = await runner.run(
            escapingSymlink.path,
            ["-c", "exit 0"],
            options: CommandOptions(
                timeoutMs: 5_000,
                executableAuthorization: .beneath(trustedDirectory)
            )
        )
        try expect(escaped.code == 127, "symlink escape from an authorized root was not rejected")
    }

    private static func testProcessRunnerValidatesPythonVirtualEnvironments() async throws {
        let container = temporaryRoot("python-venv")
        defer { try? FileManager.default.removeItem(at: container) }
        let root = container.appendingPathComponent("hermes", isDirectory: true)
        let bin = root.appendingPathComponent("venv/bin", isDirectory: true)
        try FileManager.default.createDirectory(at: bin, withIntermediateDirectories: true)

        let externalBin = container.appendingPathComponent("managed-python/bin", isDirectory: true)
        try FileManager.default.createDirectory(
            at: externalBin,
            withIntermediateDirectories: true
        )
        let systemPython = externalBin.appendingPathComponent("python3")
        try "#!/bin/sh\nprintf 'ok\\n'\n"
            .write(to: systemPython, atomically: true, encoding: .utf8)
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o700],
            ofItemAtPath: systemPython.path
        )
        let configuration = root.appendingPathComponent("venv/pyvenv.cfg")
        try "home = \(externalBin.path)\n"
            .write(to: configuration, atomically: true, encoding: .utf8)
        let launcher = bin.appendingPathComponent("python")
        try FileManager.default.createSymbolicLink(
            at: launcher,
            withDestinationURL: systemPython
        )

        let runner = ProcessCommandRunner()
        let valid = await runner.run(
            launcher.path,
            ["-c", "print('ok')"],
            options: CommandOptions(
                timeoutMs: 10_000,
                executableAuthorization: .pythonVirtualEnvironment(harnessRoot: root)
            )
        )
        try expect(
            valid.code == 0 && valid.stdout.trimmingCharacters(in: .whitespacesAndNewlines) == "ok",
            "standard virtual-environment Python symlink was rejected: \(valid.stderr)"
        )

        try FileManager.default.removeItem(at: launcher)
        try FileManager.default.createSymbolicLink(
            at: launcher,
            withDestinationURL: URL(fileURLWithPath: "/bin/sh")
        )
        let substituted = await runner.run(
            launcher.path,
            ["-c", "exit 0"],
            options: CommandOptions(
                timeoutMs: 5_000,
                executableAuthorization: .pythonVirtualEnvironment(harnessRoot: root)
            )
        )
        try expect(
            substituted.code == 127,
            "non-Python executable substituted into a virtual environment was launched"
        )
    }

    private static func testConfiguredHermesPythonEnvironment() async throws {
        guard let configuredPath = ProcessInfo.processInfo.environment[
            "RELAY_TEST_HERMES_PATH"
        ]?.trimmingCharacters(in: .whitespacesAndNewlines),
              !configuredPath.isEmpty
        else {
            return
        }
        let root = URL(fileURLWithPath: configuredPath, isDirectory: true)
            .standardizedFileURL
        let launchers = [
            root.appendingPathComponent(".venv/bin/python"),
            root.appendingPathComponent("venv/bin/python")
        ]
        guard let launcher = launchers.first(where: {
            FileManager.default.fileExists(atPath: $0.path)
        }) else {
            throw LocalSecurityTestFailure(
                description: "configured Hermes installation has no Python launcher"
            )
        }
        let result = await ProcessCommandRunner().run(
            launcher.path,
            ["-c", "import run_agent, tui_gateway.entry; print('ok')"],
            options: CommandOptions(
                cwd: root,
                timeoutMs: 30_000,
                executableAuthorization: .pythonVirtualEnvironment(harnessRoot: root)
            )
        )
        try expect(
            result.code == 0,
            "configured Hermes gateway environment failed validation "
                + "(code \(result.code), stdout \(result.stdout), stderr \(result.stderr))"
        )
    }

    private static func testProcessRunnerBoundsOutputAndTime() async throws {
        let runner = ProcessCommandRunner()
        let yes = URL(fileURLWithPath: "/usr/bin/yes")
        let noisy = await runner.run(
            yes.path,
            [],
            options: CommandOptions(
                timeoutMs: 5_000,
                executableAuthorization: .exact(yes),
                maximumOutputBytes: 32 * 1_024,
                maximumCapturedBytesPerStream: 4 * 1_024,
                maximumLineBytes: 1_024
            )
        )
        try expect(noisy.code == 125, "noisy process did not receive the output-limit code")
        try expect(
            noisy.terminationReason == .outputLimit,
            "noisy process did not report output-limit termination"
        )
        try expect(
            Data(noisy.stdout.utf8).count <= 4 * 1_024,
            "stdout ring buffer exceeded its capture limit"
        )
        try expect(noisy.outputTruncated, "bounded noisy output was not marked truncated")

        let shell = URL(fileURLWithPath: "/bin/sh")
        let longLine = await runner.run(
            shell.path,
            ["-c", "printf '%02048d' 0"],
            options: CommandOptions(
                timeoutMs: 5_000,
                executableAuthorization: .exact(shell),
                maximumOutputBytes: 32 * 1_024,
                maximumCapturedBytesPerStream: 4 * 1_024,
                maximumLineBytes: 1_024
            )
        )
        try expect(longLine.code == 125, "oversized line did not receive the line-limit code")
        try expect(
            longLine.terminationReason == .lineLimit,
            "oversized line did not report line-limit termination"
        )

        let sleep = URL(fileURLWithPath: "/bin/sleep")
        let timedOut = await runner.run(
            sleep.path,
            ["5"],
            options: CommandOptions(
                timeoutMs: 100,
                executableAuthorization: .exact(sleep)
            )
        )
        try expect(timedOut.code == 124, "timed-out process did not receive the timeout code")
        try expect(
            timedOut.terminationReason == .timeout,
            "timed-out process did not report timeout termination"
        )
    }

    private static func testProcessRunnerRedactsDiagnosticsAndSanitizesEnvironment() async throws {
        let runner = ProcessCommandRunner()
        let shell = URL(fileURLWithPath: "/bin/sh")
        let secret = "relay_secretvalue123456"
        let jwt = "eyJheader123456.eyJpayload123456.signature123456"
        var environment = CommandExecutionEnvironment.minimal
        environment["DYLD_INSERT_LIBRARIES"] = "/tmp/evil.dylib"
        environment["NODE_OPTIONS"] = "--require=/tmp/evil.js"
        environment["RELAY_SAFE_TEST_VALUE"] = "present"

        let result = await runner.run(
            shell.path,
            [
                "-c",
                "printf 'token=\(secret) email=user@example.test jwt=\(jwt)\\n' >&2; /usr/bin/env"
            ],
            options: CommandOptions(
                env: environment,
                timeoutMs: 5_000,
                executableAuthorization: .exact(shell)
            )
        )
        try expect(result.code == 0, "diagnostic/environment fixture failed")
        for sensitive in [secret, jwt, "user@example.test"] {
            try expect(
                !result.stderr.contains(sensitive) && !result.diagnosticTail.contains(sensitive),
                "diagnostic output retained sensitive data"
            )
        }
        try expect(
            !result.stdout.contains("DYLD_INSERT_LIBRARIES=")
                && !result.stdout.contains("NODE_OPTIONS="),
            "dangerous environment injection key reached the process"
        )
        try expect(
            result.stdout.contains("RELAY_SAFE_TEST_VALUE=present"),
            "explicit safe environment value was not preserved"
        )
    }

    private static func testRuntimeFailureClassification() throws {
        for message in [
            "Authentication required.",
            "OpenAI auth required.",
            "The saved credential expired.",
            "Invalid token.",
            "User is not logged in."
        ] {
            try expect(
                RuntimeFailureClassifier.isAuthenticationFailure(message),
                "authentication failure was not classified: \(message)"
            )
        }
        for message in [
            "The executable is not authorized for this operation.",
            "The Hermes Agent Python environment failed executable validation."
        ] {
            try expect(
                !RuntimeFailureClassifier.isAuthenticationFailure(message),
                "non-authentication executable failure was classified as authentication: \(message)"
            )
        }
    }

    private static func testProcessExecutionSourceContract() throws {
        let sourceRoot = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .appendingPathComponent("Sources/RelayConsoleCore", isDirectory: true)
        let processFiles = [
            "ProcessRunner.swift",
            "HarnessInstallManager.swift",
            "HarnessInstallManagerHelpers.swift",
            "HarnessInstallUtilities.swift",
            "NativeRuntimeInventory.swift",
            "HermesCronSchedulerService.swift",
            "HermesGatewayClient.swift"
        ]
        let source = try processFiles.map {
            try String(
                contentsOf: sourceRoot.appendingPathComponent($0),
                encoding: .utf8
            )
        }.joined(separator: "\n")
        try expect(!source.contains("/usr/bin/env"), "PATH-dispatch executable wrapper remains")
        try expect(
            !source.contains(#"processInfo.environment["PATH"]"#),
            "runtime executable discovery still trusts the inherited PATH"
        )
        try expect(
            source.components(separatedBy: "Process()").count - 1 == 3,
            "a new direct Process launch bypasses the reviewed execution boundaries"
        )
        try expect(
            source.contains("CommandExecutionEnvironment.minimal"),
            "minimal process environment policy is not wired into runtime execution"
        )
        try expect(
            source.contains("maximumOutputBytes")
                && source.contains("maximumLineBytes")
                && source.contains("CommandOutputRedactor"),
            "bounded and redacted output controls are not present"
        )
        try expect(
            source.components(separatedBy: ".pythonVirtualEnvironment").count - 1 >= 6,
            "Hermes launch and health paths do not share virtual-environment validation"
        )
    }

    private static func mode(_ url: URL) throws -> Int {
        let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
        return (attributes[.posixPermissions] as? NSNumber)?.intValue ?? -1
    }

    private static func temporaryRoot(_ label: String) -> URL {
        FileManager.default.temporaryDirectory.appendingPathComponent("relay-console-security-\(label)-\(UUID().uuidString)", isDirectory: true)
    }

    private static func expect(_ condition: @autoclosure () throws -> Bool, _ message: String) throws {
        guard try condition() else { throw LocalSecurityTestFailure(description: message) }
    }
}
