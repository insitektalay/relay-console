import Foundation
#if canImport(Darwin)
import Darwin
#endif

public struct HermesCronSchedulerStatus: Codable, Equatable, Sendable {
    public var label: String
    public var plistPath: String
    public var hermesHomePath: String
    public var installed: Bool
    public var running: Bool
    public var pid: Int?
    public var lastCheckedAt: IsoTimestamp
    public var message: String

    public init(
        label: String,
        plistPath: String,
        hermesHomePath: String,
        installed: Bool,
        running: Bool,
        pid: Int?,
        lastCheckedAt: IsoTimestamp,
        message: String
    ) {
        self.label = label
        self.plistPath = plistPath
        self.hermesHomePath = hermesHomePath
        self.installed = installed
        self.running = running
        self.pid = pid
        self.lastCheckedAt = lastCheckedAt
        self.message = message
    }
}

public final class HermesCronSchedulerService: @unchecked Sendable {
    private let paths: RelayConsolePaths
    private let runner: CommandRunning
    private let fileManager: FileManager

    public init(
        paths: RelayConsolePaths,
        runner: CommandRunning = ProcessCommandRunner(),
        fileManager: FileManager = .default
    ) {
        self.paths = paths
        self.runner = runner
        self.fileManager = fileManager
    }

    public func status(forHermesHome hermesHome: URL) -> HermesCronSchedulerStatus {
        cleanupLeakedTestLaunchAgentsIfNeeded()
        let label = launchdLabel(forHermesHome: hermesHome)
        let plist = plistURL(forLabel: label)
        let pid = gatewayPID(in: hermesHome)
        let running = pid.map(processIsRunning) ?? false
        let installed = fileManager.fileExists(atPath: plist.path)
        let message: String
        if running, let pid {
            message = "Relay Console background scheduler is running (PID \(pid))."
        } else if installed {
            message = "Relay Console background scheduler is installed but not running yet."
        } else {
            message = "Relay Console background scheduler is not installed for this Hermes profile."
        }
        return HermesCronSchedulerStatus(
            label: label,
            plistPath: plist.path,
            hermesHomePath: hermesHome.path,
            installed: installed,
            running: running,
            pid: running ? pid : nil,
            lastCheckedAt: nowIso(),
            message: message
        )
    }

    public func ensureInstalledAndStarted(
        harnessPath: URL,
        hermesHome: URL,
        environment: [String: String]
    ) async throws -> HermesCronSchedulerStatus {
        cleanupLeakedTestLaunchAgentsIfNeeded()
        guard fileManager.fileExists(atPath: hermesHome.path) else {
            throw RelayError(.harnessMissing, "Hermes profile home does not exist.")
        }
        let python = [".venv/bin/python", "venv/bin/python"]
            .map(harnessPath.appendingPathComponent)
            .first { fileManager.fileExists(atPath: $0.path) }
        guard let python else {
            throw RelayError(.harnessMissing, "Hermes Agent Python environment is not installed.")
        }

        let label = launchdLabel(forHermesHome: hermesHome)
        let plist = plistURL(forLabel: label)
        let expected = try launchdPlistData(
            label: label,
            python: python,
            harnessPath: harnessPath,
            hermesHome: hermesHome,
            environment: environment
        )
        try fileManager.createDirectory(at: plist.deletingLastPathComponent(), withIntermediateDirectories: true)
        let existing = try? Data(contentsOf: plist)
        let rewrotePlist = existing != expected
        if rewrotePlist {
            try expected.write(to: plist, options: [.atomic])
        }

        let domains = launchdDomains()
        if rewrotePlist {
            for domain in domains {
                _ = await runner.run(
                    "/bin/launchctl",
                    ["bootout", "\(domain)/\(label)"],
                    options: CommandOptions(timeoutMs: 20_000)
                )
            }
        }

        var lastFailure = ""
        for domain in domains {
            if !(await launchdServiceIsLoaded(label: label, domain: domain)) {
                let bootstrap = await runner.run(
                    "/bin/launchctl",
                    ["bootstrap", domain, plist.path],
                    options: CommandOptions(timeoutMs: 30_000)
                )
                if bootstrap.code != 0, !(await launchdServiceIsLoaded(label: label, domain: domain)) {
                    lastFailure = bootstrap.diagnosticTail.trimmingCharacters(in: .whitespacesAndNewlines)
                    continue
                }
            }
            let kickstart = await runner.run(
                "/bin/launchctl",
                ["kickstart", "-k", "\(domain)/\(label)"],
                options: CommandOptions(timeoutMs: 30_000)
            )
            let launched: Bool
            if kickstart.code == 0 {
                launched = true
            } else {
                launched = await launchdServiceIsLoaded(label: label, domain: domain)
            }
            if launched {
                try? await Task.sleep(nanoseconds: 750_000_000)
                return status(forHermesHome: hermesHome)
            }
            lastFailure = kickstart.diagnosticTail.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        let current = status(forHermesHome: hermesHome)
        if current.installed {
            return HermesCronSchedulerStatus(
                label: current.label,
                plistPath: current.plistPath,
                hermesHomePath: current.hermesHomePath,
                installed: current.installed,
                running: current.running,
                pid: current.pid,
                lastCheckedAt: nowIso(),
                message: lastFailure.isEmpty
                    ? current.message
                    : "LaunchAgent installed, but launchd did not start it: \(lastFailure)"
            )
        }
        throw RelayError(.internalError, lastFailure.isEmpty ? "Relay Console could not install the Hermes background scheduler." : lastFailure)
    }

    public func uninstall(hermesHome: URL) async {
        let label = launchdLabel(forHermesHome: hermesHome)
        for domain in launchdDomains() {
            _ = await runner.run(
                "/bin/launchctl",
                ["bootout", "\(domain)/\(label)"],
                options: CommandOptions(timeoutMs: 20_000)
            )
        }
        try? fileManager.removeItem(at: plistURL(forLabel: label))
    }

    private func launchdPlistData(
        label: String,
        python: URL,
        harnessPath: URL,
        hermesHome: URL,
        environment: [String: String]
    ) throws -> Data {
        _ = try ProcessExecutionPolicy.validateExecutable(
            python.path,
            authorization: .pythonVirtualEnvironment(harnessRoot: harnessPath)
        )
        let logs = hermesHome.appendingPathComponent("logs", isDirectory: true)
        try fileManager.createDirectory(at: logs, withIntermediateDirectories: true)
        var env: [String: String] = [:]
        for key in ["LANG", "LC_ALL", "LC_CTYPE", RelayConsoleServices.temporaryUserDataPathEnvironmentKey] {
            if let value = environment[key], !value.isEmpty {
                env[key] = value
            }
        }
        let venv = python.deletingLastPathComponent().deletingLastPathComponent()
        env["HERMES_HOME"] = hermesHome.path
        env["CODEX_HOME"] = paths.codexHomeDir.path
        env["RELAY_CONSOLE_ARTIFACT_ROOT"] = paths.artifactsDir.path
        env["RELAY_CONSOLE_CRON_ARTIFACT_ROOT"] = paths.artifactsDir.appendingPathComponent("cron", isDirectory: true).path
        env["VIRTUAL_ENV"] = venv.path
        env["PYTHONPATH"] = mergePath([harnessPath.path], existing: environment["PYTHONPATH"] ?? "")
        env["PATH"] = mergePath(
            [
                venv.appendingPathComponent("bin", isDirectory: true).path,
                harnessPath.appendingPathComponent("node_modules/.bin", isDirectory: true).path
            ],
            existing: environment["PATH"] ?? ""
        )

        env = CommandExecutionEnvironment.sanitized(env)
        let plist: [String: Any] = [
            "Label": label,
            "ProgramArguments": [
                python.path,
                "-m",
                "hermes_cli.main",
                "gateway",
                "run",
                "--replace"
            ],
            "WorkingDirectory": hermesHome.path,
            "EnvironmentVariables": env,
            "LimitLoadToSessionType": ["Aqua", "Background"],
            "RunAtLoad": true,
            "KeepAlive": true,
            "StandardOutPath": logs.appendingPathComponent("gateway.log").path,
            "StandardErrorPath": logs.appendingPathComponent("gateway.error.log").path
        ]
        return try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
    }

    private func launchdServiceIsLoaded(label: String, domain: String) async -> Bool {
        let result = await runner.run(
            "/bin/launchctl",
            ["print", "\(domain)/\(label)"],
            options: CommandOptions(timeoutMs: 10_000)
        )
        return result.code == 0
    }

    private func plistURL(forLabel label: String) -> URL {
        launchAgentsDirectory()
            .appendingPathComponent("\(label).plist")
    }

    private func launchAgentsDirectory() -> URL {
        if usesIsolatedLaunchAgentsDirectory {
            return paths.root
                .appendingPathComponent("LaunchAgents", isDirectory: true)
        }
        return realHomeDirectory()
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("LaunchAgents", isDirectory: true)
    }

    private func realHomeDirectory() -> URL {
        FileManager.default.homeDirectoryForCurrentUser
    }

    private var usesIsolatedLaunchAgentsDirectory: Bool {
        let path = paths.root.standardizedFileURL.path
        return path.contains("/RelayConsoleServiceTests/")
            || path.contains("/RelayConsoleMigrationTests/")
            || path.contains("/RelayConsole")
                && path.contains("/TemporaryItems/")
    }

    private func cleanupLeakedTestLaunchAgentsIfNeeded() {
        guard !usesIsolatedLaunchAgentsDirectory else { return }
        let directory = realHomeDirectory()
            .appendingPathComponent("Library", isDirectory: true)
            .appendingPathComponent("LaunchAgents", isDirectory: true)
        guard let files = try? fileManager.contentsOfDirectory(
            at: directory,
            includingPropertiesForKeys: nil,
            options: [.skipsHiddenFiles]
        ) else { return }
        for file in files where file.lastPathComponent.hasPrefix("work.relayconsole.hermes.gateway.") && file.pathExtension == "plist" {
            guard launchAgentReferencesRelayConsoleTestPath(file) else { continue }
            let label = (try? launchAgentLabel(file)) ?? file.deletingPathExtension().lastPathComponent
            for domain in launchdDomains() {
                bootoutLaunchAgentSynchronously(domain: domain, label: label)
            }
            try? fileManager.removeItem(at: file)
        }
    }

    private func bootoutLaunchAgentSynchronously(domain: String, label: String) {
        let process = Process()
        process.executableURL = try? ProcessExecutionPolicy.validateExecutable(
            "/bin/launchctl",
            authorization: .system
        )
        process.arguments = ["bootout", "\(domain)/\(label)"]
        process.environment = CommandExecutionEnvironment.minimal
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        do {
            try process.run()
        } catch {
            return
        }
        DispatchQueue.global().asyncAfter(deadline: .now() + 5) {
            ProcessExecutionPolicy.terminate(process)
        }
        process.waitUntilExit()
    }

    private func launchAgentReferencesRelayConsoleTestPath(_ file: URL) -> Bool {
        guard let data = try? Data(contentsOf: file),
              let plist = try? PropertyListSerialization.propertyList(from: data, options: [], format: nil) as? [String: Any]
        else { return false }
        let arguments = plist["ProgramArguments"] as? [String] ?? []
        let environment = plist["EnvironmentVariables"] as? [String: String] ?? [:]
        let text = (arguments + Array(environment.values)).joined(separator: "\n")
        return text.contains("/RelayConsoleServiceTests/")
            || text.contains("/RelayConsoleMigrationTests/")
    }

    private func launchAgentLabel(_ file: URL) throws -> String {
        let data = try Data(contentsOf: file)
        guard let plist = try PropertyListSerialization.propertyList(from: data, options: [], format: nil) as? [String: Any],
              let label = plist["Label"] as? String,
              !label.isEmpty
        else {
            throw RelayError(.internalError, "LaunchAgent plist is missing a label.")
        }
        return label
    }

    private func launchdDomains() -> [String] {
        #if canImport(Darwin)
        let uid = getuid()
        return ["user/\(uid)", "gui/\(uid)"]
        #else
        return []
        #endif
    }

    private func launchdLabel(forHermesHome hermesHome: URL) -> String {
        "work.relayconsole.hermes.gateway.\(stableSuffix(hermesHome.standardizedFileURL.path))"
    }

    private func gatewayPID(in hermesHome: URL) -> Int? {
        let pidURL = hermesHome.appendingPathComponent("gateway.pid")
        guard let data = try? Data(contentsOf: pidURL) else { return nil }
        if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            if let int = object["pid"] as? Int { return int }
            if let number = object["pid"] as? NSNumber { return number.intValue }
            if let string = object["pid"] as? String { return Int(string) }
        }
        if let raw = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) {
            return Int(raw)
        }
        return nil
    }

    private func processIsRunning(_ pid: Int) -> Bool {
        guard pid > 0 else { return false }
        #if canImport(Darwin)
        let result = kill(pid_t(pid), 0)
        return result == 0 || errno == EPERM
        #else
        return false
        #endif
    }

    private func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        return String(hash, radix: 16)
    }
}
