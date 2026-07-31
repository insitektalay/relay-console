import Foundation
import AppKit

struct HarnessCatalogEntry {
    var harnessKey: HarnessKey
    var runtimeType: RuntimeType
    var displayName: String
    var officialRepoSlug: String
    var repoUrl: String
    var managedDirName: String
    var setupNotes: [String]
}

let catalog: [HarnessKey: HarnessCatalogEntry] = [
    .hermes: HarnessCatalogEntry(
        harnessKey: .hermes,
        runtimeType: .hermes,
        displayName: "Hermes Agent",
        officialRepoSlug: "NousResearch/hermes-agent",
        repoUrl: "https://github.com/NousResearch/hermes-agent.git",
        managedDirName: "hermes-agent",
        setupNotes: [
            "Install and configure Hermes Agent yourself by following its official documentation.",
            "Connect Relay Console to the existing Hermes Agent folder that contains run_agent.py and its Python environment.",
            "Authenticate with your model provider in Hermes Agent. Relay Console never asks for your OpenAI password.",
            "You are responsible for Hermes Agent updates, provider charges, and runtime availability."
        ]
    ),
    .openclaw: HarnessCatalogEntry(
        harnessKey: .openclaw,
        runtimeType: .openclaw,
        displayName: "OpenClaw",
        officialRepoSlug: "openclaw/openclaw",
        repoUrl: "https://github.com/openclaw/openclaw.git",
        managedDirName: "openclaw",
        setupNotes: [
            "Install and configure OpenClaw yourself by following its official documentation.",
            "Connect Relay Console to the existing OpenClaw folder that contains openclaw.mjs.",
            "Authenticate with your model provider and start the gateway in OpenClaw. Relay Console only checks its health.",
            "You are responsible for OpenClaw updates, provider charges, and runtime availability."
        ]
    )
]

let defaultHermesCodexModel = "gpt-5.5"
let hermesRuntimeOverrideCleanupMarkerKey = "hermesRuntimeOverrideCleanupCompletedAt"
let openClawGatewayPort = "18789"
let openClawPnpmInstallAttempts = 3
let openClawPnpmInstallTimeoutMs = 3_600_000
let openClawPnpmBuildTimeoutMs = 1_800_000
let openClawAuthEventPrefix = "__relay_openclaw_auth__:"

struct HermesGatewayDispatch: Sendable {
    var client: HermesGatewayClient
    var liveSessionId: String
}

public final class HarnessInstallManager {
    let paths: RelayConsolePaths
    let data: LocalDataService
    let runner: CommandRunning
    let eventBus: RelayEventBus
    let openExternal: (String) -> Void
    let marketplaceRuntimeMounts: MarketplaceRuntimeMountService
    let cloudMarketplaceRuntimeToolProxy: CloudMarketplaceRuntimeToolProxy?
    let hermesCronScheduler: HermesCronSchedulerService
    let hermesProfileBackups: HermesProfileBackupService
    let lock = NSLock()
    var activeHermesDispatches: [String: HermesGatewayDispatch] = [:]
    var hermesGatewayClients: [String: HermesGatewayClient] = [:]
    var openClawGatewayProcesses: [String: Process] = [:]
    var openClawGatewayKeepAliveTask: Task<Void, Never>?
    var securityScopedRuntimeURLs: [HarnessKey: URL] = [:]

    /// Managed runtime lifecycle code is retained temporarily only so existing
    /// records can be migrated without deleting user data. Shipping clients
    /// must never execute it.
    private var legacyManagedRuntimeActionsEnabled: Bool { false }

    public init(
        paths: RelayConsolePaths,
        data: LocalDataService,
        runner: CommandRunning = ProcessCommandRunner(),
        eventBus: RelayEventBus,
        marketplaceRuntimeMounts: MarketplaceRuntimeMountService? = nil,
        cloudMarketplaceRuntimeToolProxy: CloudMarketplaceRuntimeToolProxy? = nil,
        hermesCronScheduler: HermesCronSchedulerService? = nil,
        hermesProfileBackups: HermesProfileBackupService? = nil,
        openExternal: @escaping (String) -> Void = { url in
            guard let parsed = URL(string: url) else { return }
            NSWorkspace.shared.open(parsed)
        }
    ) {
        self.paths = paths
        self.data = data
        self.runner = runner
        self.eventBus = eventBus
        self.openExternal = openExternal
        self.marketplaceRuntimeMounts = marketplaceRuntimeMounts ?? MarketplaceRuntimeMountService(data: data)
        self.cloudMarketplaceRuntimeToolProxy = cloudMarketplaceRuntimeToolProxy
        self.hermesCronScheduler = hermesCronScheduler ?? HermesCronSchedulerService(paths: paths, runner: runner)
        self.hermesProfileBackups = hermesProfileBackups
            ?? HermesProfileBackupService(backupsRoot: paths.hermesProfileBackupsDir)
    }

    deinit {
        stopAll()
    }

    public func stopAll() {
        lock.lock()
        let hermes = Array(hermesGatewayClients.values)
        let gateways = openClawGatewayProcesses.values
        let keepAlive = openClawGatewayKeepAliveTask
        let securityScopedURLs = Array(securityScopedRuntimeURLs.values)
        activeHermesDispatches.removeAll()
        hermesGatewayClients.removeAll()
        openClawGatewayProcesses.removeAll()
        openClawGatewayKeepAliveTask = nil
        securityScopedRuntimeURLs.removeAll()
        lock.unlock()
        keepAlive?.cancel()
        for client in hermes {
            client.stop()
        }
        for process in gateways where process.isRunning {
            process.terminate()
        }
        for url in securityScopedURLs {
            url.stopAccessingSecurityScopedResource()
        }
    }

    func isOpenClawGatewayRunning(for installPath: String) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return openClawGatewayProcesses[installPath]?.isRunning == true
    }

    func registerOpenClawGateway(_ process: Process, for installPath: String) {
        lock.lock()
        openClawGatewayProcesses[installPath] = process
        lock.unlock()
    }

    func stopOpenClawGateway(for installPath: String) {
        lock.lock()
        let process = openClawGatewayProcesses.removeValue(forKey: installPath)
        lock.unlock()
        if process?.isRunning == true {
            process?.terminate()
        }
    }

    public func startOpenClawGatewayKeepAlive(intervalSeconds: UInt64 = 1_800) {
        lock.lock()
        let alreadyRunning = openClawGatewayKeepAliveTask != nil
        lock.unlock()
        guard !alreadyRunning else { return }
        let sleepNanoseconds = intervalSeconds * 1_000_000_000
        let task = Task.detached { [weak self] in
            while !Task.isCancelled {
                await self?.maintainOpenClawGateway()
                do {
                    try await Task.sleep(nanoseconds: sleepNanoseconds)
                } catch {
                    break
                }
            }
        }
        lock.lock()
        if openClawGatewayKeepAliveTask == nil {
            openClawGatewayKeepAliveTask = task
            lock.unlock()
        } else {
            lock.unlock()
            task.cancel()
        }
    }

    public func maintainOpenClawGateway() async {
        guard let record = try? getRecord(.openclaw),
              shouldAutoStartOpenClawGateway(record)
        else { return }
        do {
            _ = try await start(harnessKey: .openclaw)
        } catch {
            if Task.isCancelled { return }
            _ = try? data.log(
                severity: "warn",
                category: "harness",
                message: "OpenClaw gateway keepalive failed: \(redactedTechnicalError(error))",
                harnessId: record.harnessId,
                detail: ["runtimeType": .string(RuntimeType.openclaw.rawValue)]
            )
        }
    }

    private func shouldAutoStartOpenClawGateway(_ record: HarnessInstallRecord) -> Bool {
        record.installPath != nil
            && record.dependencyStatus == "installed"
            && record.modelAuthStatus == .connected
            && record.lifecycleState != .notInstalled
            && record.lifecycleState != .authRequired
    }

    func registerHermesDispatch(client: HermesGatewayClient, liveSessionId: String, dispatchId: String) {
        lock.lock()
        activeHermesDispatches[dispatchId] = HermesGatewayDispatch(client: client, liveSessionId: liveSessionId)
        lock.unlock()
    }

    func clearHermesDispatch(_ dispatchId: String) {
        lock.lock()
        activeHermesDispatches[dispatchId] = nil
        lock.unlock()
    }

    func hermesGatewayClient(pythonPath: String, harnessPath: URL, hermesHome: URL, env: [String: String]) -> HermesGatewayClient {
        let key = hermesHome.path
        lock.lock()
        if let client = hermesGatewayClients[key] {
            lock.unlock()
            return client
        }
        let client = HermesGatewayClient(
            pythonPath: pythonPath,
            harnessPath: harnessPath,
            hermesHome: hermesHome,
            launchCwd: harnessPath,
            env: env
        )
        hermesGatewayClients[key] = client
        lock.unlock()
        return client
    }

    public func restartHermesGatewayForProfile(homePath: String?) {
        guard let homePath = homePath?.trimmingCharacters(in: .whitespacesAndNewlines), !homePath.isEmpty else {
            return
        }
        lock.lock()
        let client = hermesGatewayClients.removeValue(forKey: homePath)
        lock.unlock()
        client?.stop()
    }

    public func restartOpenClawGateway() async {
        guard let record = try? getRecord(.openclaw),
              shouldAutoStartOpenClawGateway(record),
              let installPath = record.installPath?.trimmingCharacters(in: .whitespacesAndNewlines),
              !installPath.isEmpty
        else {
            return
        }
        let harnessPath = URL(fileURLWithPath: installPath, isDirectory: true)
        do {
            try await restartOpenClawGatewayService(harnessPath: harnessPath)
            try await waitForOpenClawGateway(harnessPath: harnessPath)
        } catch {
            _ = try? data.log(
                severity: "warn",
                category: "harness",
                message: "OpenClaw gateway restart failed after Marketplace install: \(redactedTechnicalError(error))",
                harnessId: record.harnessId,
                detail: ["runtimeType": .string(RuntimeType.openclaw.rawValue)]
            )
        }
    }

    public func teardownRuntimeIdentity(for agent: AgentWithBinding) async throws -> AgentRuntimeTeardownResult {
        switch agent.binding.runtimeType {
        case .hermes:
            return try await teardownHermesRuntimeIdentity(for: agent)
        case .openclaw:
            return try await teardownOpenClawRuntimeIdentity(for: agent)
        case .relayEcho, .claudeCode, .codexCli:
            return AgentRuntimeTeardownResult(harnessActions: ["runtime identity teardown not required for \(agent.binding.runtimeType.rawValue)"])
        }
    }

    private func teardownHermesRuntimeIdentity(for agent: AgentWithBinding) async throws -> AgentRuntimeTeardownResult {
        var result = AgentRuntimeTeardownResult()
        if let homePath = agent.binding.hermesHomePath,
           let profileSlug = agent.binding.hermesProfileSlug {
            let profileHome = URL(fileURLWithPath: homePath, isDirectory: true)
            let connectedRoot = hermesRoot(for: agent.harness)
            let isOwnedDirectProfile =
                (
                    HermesRelayProfileService.isDirectProfile(
                        profileHome,
                        beneath: paths.hermesHomeDir
                    )
                    || HermesRelayProfileService.isDirectProfile(
                        profileHome,
                        beneath: connectedRoot
                    )
                )
                && HermesRelayProfileService.owns(
                    profileHome: profileHome,
                    agentId: agent.id,
                    profileSlug: profileSlug,
                    ownershipNonce: stringValue(
                        agent.binding.config["relayProfileOwnershipNonce"]
                    )
                )
            if isOwnedDirectProfile {
                guard checkpointHermesProfile(agent, reason: "before-agent-removal") != nil else {
                    throw RelayError(
                        .databaseUnavailable,
                        "Relay could not safely checkpoint the Hermes profile, so it was not removed."
                    )
                }
                restartHermesGatewayForProfile(homePath: homePath)
                await hermesCronScheduler.uninstall(hermesHome: profileHome)
                if FileManager.default.fileExists(atPath: profileHome.path) {
                    try FileManager.default.removeItem(at: profileHome)
                    result.deletedPaths.append(profileHome.path)
                }
            } else {
                result.skippedPaths.append(profileHome.path)
            }
        }
        let profileSlug = agent.binding.hermesProfileSlug ?? hermesProfileSlug(for: agent)
        let workspacePath = URL(
            fileURLWithPath: agent.binding.workspaceFolderPath
                ?? paths.workspacesDir.appendingPathComponent(profileSlug, isDirectory: true).path,
            isDirectory: true
        )
        try deleteManagedRuntimePath(workspacePath, managedRoots: [paths.workspacesDir], result: &result)
        result.harnessActions.append("hermes runtime identity removed")
        return result
    }

    public func maintainHermesCronSchedulersForActiveWorkspace() async {
        guard let workspaceId = try? data.getAppState().activeWorkspace?.id,
              !workspaceId.isEmpty,
              let agents = try? data.listAgents(workspaceId: workspaceId)
        else { return }
        guard let record = try? getRecord(.hermes),
              let installPath = record.installPath?.trimmingCharacters(in: .whitespacesAndNewlines),
              !installPath.isEmpty
        else { return }
        let harnessPath = URL(fileURLWithPath: installPath, isDirectory: true)
        guard resolveHermesPython(harnessPath) != nil else { return }
        for agent in agents where agent.binding.runtimeType == .hermes {
            if Task.isCancelled { return }
            await maintainHermesCronScheduler(for: agent, harnessPath: harnessPath)
        }
    }

    private func maintainHermesCronScheduler(for agent: AgentWithBinding, harnessPath: URL) async {
        guard agent.binding.runtimeType == .hermes,
              let homePath = agent.binding.hermesHomePath?.trimmingCharacters(in: .whitespacesAndNewlines),
              !homePath.isEmpty
        else { return }
        let hermesHome = URL(fileURLWithPath: homePath, isDirectory: true)
        var env = hermesEnv(harnessPath: harnessPath, hermesHome: hermesHome)
        env[RelayConsoleServices.temporaryUserDataPathEnvironmentKey] = paths.root.path
        do {
            let status = try await hermesCronScheduler.ensureInstalledAndStarted(
                harnessPath: harnessPath,
                hermesHome: hermesHome,
                environment: env
            )
            _ = try? data.log(
                severity: status.running ? "info" : "warn",
                category: "harness",
                message: status.message,
                harnessId: agent.harness.id,
                detail: [
                    "agentId": .string(agent.id),
                    "hermesHome": .string(hermesHome.path),
                    "launchAgent": .string(status.label),
                    "plistPath": .string(status.plistPath),
                    "running": .bool(status.running)
                ]
            )
        } catch {
            _ = try? data.log(
                severity: "warn",
                category: "harness",
                message: "Relay Console could not start the Hermes background scheduler: \(redactedTechnicalError(error))",
                harnessId: agent.harness.id,
                detail: [
                    "agentId": .string(agent.id),
                    "hermesHome": .string(hermesHome.path),
                    "error": .string(redactedTechnicalError(error))
                ]
            )
        }
    }

    private func teardownOpenClawRuntimeIdentity(for agent: AgentWithBinding) async throws -> AgentRuntimeTeardownResult {
        var result = AgentRuntimeTeardownResult()
        let configuredSlug = stringValue(agent.binding.config["openclawAgentId"])
        let slug = normalizeOpenClawAgentId(configuredSlug ?? agent.binding.externalAgentId ?? openClawSlug(for: agent))
        if slug != "main",
           let harnessPath = try? harnessPath(for: agent.harness),
           FileManager.default.fileExists(atPath: harnessPath.appendingPathComponent("openclaw.mjs").path) {
            let node = resolveOpenClawNodePath()
            let removalAttempts = [
                ["openclaw.mjs", "agents", "remove", slug, "--non-interactive", "--json"],
                ["openclaw.mjs", "agents", "delete", slug, "--non-interactive", "--json"],
                ["openclaw.mjs", "agents", "rm", slug, "--non-interactive", "--json"]
            ]
            var removedViaCLI = false
            for args in removalAttempts {
                let removal = await runner.run(
                    node.path,
                    args,
                    options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: node), timeoutMs: 60_000, executableAuthorization: .exact(node))
                )
                if removal.code == 0 {
                    result.harnessActions.append("openclaw agent \(slug) removed with \(args[2])")
                    removedViaCLI = true
                    break
                }
            }
            if !removedViaCLI {
                result.harnessActions.append("openclaw agent \(slug) CLI removal unavailable; managed state removed locally")
            }
        } else if slug == "main" {
            result.harnessActions.append("openclaw main agent was not removed")
        }

        let workspacePath = URL(
            fileURLWithPath: stringValue(agent.binding.config["openclawWorkspacePath"])
                ?? agent.binding.workspaceFolderPath
                ?? defaultOpenClawWorkspacePath(for: slug).path,
            isDirectory: true
        )
        try deleteManagedRuntimePath(
            workspacePath,
            managedRoots: [paths.openClawHomeDir, paths.workspacesDir],
            result: &result
        )

        let defaultAgentDir = openClawAgentDir(slug: slug)
        let configuredAgentDir = stringValue(agent.binding.config["openclawAgentDir"]).map { URL(fileURLWithPath: $0, isDirectory: true) }
        let rawAgentDir = configuredAgentDir ?? defaultAgentDir
        let agentIdentityRoot = rawAgentDir.lastPathComponent == "agent"
            ? rawAgentDir.deletingLastPathComponent()
            : rawAgentDir
        if slug != "main" {
            try deleteManagedRuntimePath(
                agentIdentityRoot,
                managedRoots: [paths.openClawHomeDir],
                result: &result
            )
        }
        result.harnessActions.append("openclaw runtime identity removed")
        return result
    }

    private func deleteManagedRuntimePath(
        _ url: URL,
        managedRoots: [URL],
        result: inout AgentRuntimeTeardownResult
    ) throws {
        guard let deletionPath = managedDeletionPath(url, managedRoots: managedRoots) else {
            result.skippedPaths.append(url.path)
            return
        }
        guard FileManager.default.fileExists(atPath: deletionPath.path) else {
            return
        }
        try FileManager.default.removeItem(at: deletionPath)
        result.deletedPaths.append(deletionPath.path)
    }

    private func managedDeletionPath(_ url: URL, managedRoots: [URL]) -> URL? {
        let target = url.standardizedFileURL
        let targetPath = target.path
        guard !targetPath.isEmpty else { return nil }
        for root in managedRoots.map(\.standardizedFileURL) {
            let rootPath = root.path
            guard targetPath != rootPath, targetPath.hasPrefix(rootPath + "/") else {
                continue
            }
            guard !pathContainsSymbolicLink(target, beneath: root) else {
                continue
            }
            let resolvedRoot = root.resolvingSymlinksInPath().standardizedFileURL
            let resolvedTarget = target.resolvingSymlinksInPath().standardizedFileURL
            guard resolvedTarget.path != resolvedRoot.path,
                  resolvedTarget.path.hasPrefix(resolvedRoot.path + "/")
            else {
                continue
            }
            return target
        }
        return nil
    }

    private func pathContainsSymbolicLink(_ target: URL, beneath root: URL) -> Bool {
        let relative = String(
            target.standardizedFileURL.path.dropFirst(root.standardizedFileURL.path.count)
        )
        var current = root.standardizedFileURL
        for component in relative.split(separator: "/") {
            current.appendPathComponent(String(component))
            if (try? current.resourceValues(
                forKeys: [.isSymbolicLinkKey]
            ).isSymbolicLink) == true {
                return true
            }
        }
        return false
    }

    func takeHermesDispatch(_ dispatchId: String) -> HermesGatewayDispatch? {
        lock.lock()
        let dispatch = activeHermesDispatches[dispatchId]
        activeHermesDispatches[dispatchId] = nil
        lock.unlock()
        return dispatch
    }

    func hermesDispatch(_ dispatchId: String) -> HermesGatewayDispatch? {
        lock.lock()
        let dispatch = activeHermesDispatches[dispatchId]
        lock.unlock()
        return dispatch
    }

    public func listRecords() throws -> [HarnessInstallRecord] {
        [try getRecord(.hermes), try getRecord(.openclaw)]
    }

    public func refreshInstalledHarnesses() async {
        guard let records = try? listRecords() else { return }
        for record in records where record.lifecycleState != .notInstalled {
            if Task.isCancelled { return }
            _ = try? await check(harnessKey: record.harnessKey)
        }
        await maintainHermesCronSchedulersForActiveWorkspace()
    }

    /// Connects Relay Console to a runtime the user installed and owns. This
    /// method only validates and records the location; it never installs,
    /// updates, authenticates, starts, or mutates the runtime.
    public func connectExisting(
        harnessKey: HarnessKey,
        location: URL,
        securityScopedBookmark: String? = nil
    ) async throws -> HarnessActionResult {
        let entry = catalogEntry(harnessKey)
        let selected = location.standardizedFileURL
        let installPath = try resolveExistingHarnessRoot(harnessKey: harnessKey, selected: selected)
        try assertHarnessFolder(entry: entry, installPath)

        var update: JSONRecord = [
            "source": .string(HarnessInstallSource.located.rawValue),
            "lifecycleState": .string(HarnessLifecycleState.installed.rawValue),
            "installPath": .string(installPath.path),
            "selectedLocalPath": .string(selected.path),
            "dependencyStatus": .string("installed"),
            "modelAuthProvider": .string("user_managed"),
            "modelAuthCommand": .null,
            "modelAuthSession": .null,
            "runtimeOwnership": .string("user_managed"),
            "setupNotes": .array(entry.setupNotes.map(JSONValue.string)),
            "lastError": .null,
            "lastTechnicalError": .null,
            "lastCheckedAt": .string(nowIso())
        ]
        update["securityScopedBookmark"] = securityScopedBookmark.map(JSONValue.string) ?? .null

        if harnessKey == .hermes {
            update["hermesHome"] = .string(defaultHermesHome(source: .located).path)
            if let commit = try? await readGitCommit(cwd: installPath) {
                update["installedCommit"] = .string(commit)
            }
            if let python = resolveHermesPython(installPath) {
                let version = await runner.run(
                    python.path,
                    ["-c", "import importlib.metadata; print(importlib.metadata.version('hermes-agent'))"],
                    options: CommandOptions(
                        cwd: installPath,
                        timeoutMs: 30_000,
                        executableAuthorization: .pythonVirtualEnvironment(
                            harnessRoot: installPath
                        )
                    )
                )
                let text = version.stdout.trimmingCharacters(in: .whitespacesAndNewlines)
                if version.code == 0, !text.isEmpty { update["installedVersion"] = .string(text) }
            }
        } else {
            let node = try resolveUserManagedNodePath()
            let state = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".openclaw", isDirectory: true)
            update["openClawHome"] = .string(FileManager.default.homeDirectoryForCurrentUser.path)
            update["openClawStateDir"] = .string(state.path)
            update["openClawConfigPath"] = .string(state.appendingPathComponent("openclaw.json").path)
            update["openClawNodePath"] = .string(node.path)
            update["openClawInstallLogPath"] = .null
            let version = await runner.run(
                node.path,
                ["openclaw.mjs", "--version"],
                options: CommandOptions(cwd: installPath, timeoutMs: 30_000, executableAuthorization: .exact(node))
            )
            let text = version.stdout.trimmingCharacters(in: .whitespacesAndNewlines)
            if version.code == 0, !text.isEmpty { update["installedVersion"] = .string(text) }
        }

        _ = try saveRecord(entry: entry, update: update)
        return try await check(harnessKey: harnessKey)
    }

    /// Removes only the runtime source tree that an older Relay Console release
    /// installed inside its own Application Support directory. Conversation
    /// data, agent bindings, workspaces, runtime-created state, and credentials
    /// are deliberately retained so the user can reconnect a runtime they own.
    public func removeLegacyManagedRuntime(harnessKey: HarnessKey) throws -> HarnessActionResult {
        let entry = catalogEntry(harnessKey)
        let record = try getRecord(harnessKey)
        guard record.source == .managed else {
            throw RelayError(.invalidInput, "Only a previous Relay-managed runtime can be removed with this migration action.")
        }

        let expectedSource = paths.harnessesDir
            .appendingPathComponent(entry.managedDirName, isDirectory: true)
            .standardizedFileURL
        guard let storedPath = record.installPath.map({ URL(fileURLWithPath: $0, isDirectory: true).standardizedFileURL }),
              storedPath.path == expectedSource.path
        else {
            throw RelayError(.permissionDenied, "Relay Console refused to remove a runtime outside its legacy managed folder.")
        }

        if harnessKey == .hermes {
            restartHermesGatewayForProfile(homePath: paths.hermesHomeDir.path)
        }
        if FileManager.default.fileExists(atPath: expectedSource.path) {
            try FileManager.default.removeItem(at: expectedSource)
        }

        let migrated = try saveRecord(entry: entry, update: [
            "source": .string(HarnessInstallSource.missing.rawValue),
            "lifecycleState": .string(HarnessLifecycleState.notInstalled.rawValue),
            "installPath": .null,
            "selectedLocalPath": .null,
            "securityScopedBookmark": .null,
            "installedCommit": .null,
            "installedVersion": .null,
            "dependencyStatus": .string("missing"),
            "modelAuthStatus": .string(HarnessModelAuthStatus.unknown.rawValue),
            "modelAuthProvider": .string("user_managed"),
            "modelAuthCommand": .null,
            "modelAuthSession": .null,
            "modelAuthLastError": .null,
            "runtimeCommand": .null,
            "healthCheckCommand": .null,
            "runtimeOwnership": .string("user_managed"),
            "legacyManagedSourceRemovedAt": .string(nowIso()),
            "lastError": .null,
            "lastTechnicalError": .null,
            "lastCheckedAt": .string(nowIso())
        ])
        return HarnessActionResult(
            record: migrated,
            harness: try data.getHarnessByRuntimeType(entry.runtimeType),
            health: nil,
            output: "Removed only the legacy Relay-managed runtime source. Relay data and runtime-created state were retained."
        )
    }

    private func resolveExistingHarnessRoot(harnessKey: HarnessKey, selected: URL) throws -> URL {
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: selected.path, isDirectory: &isDirectory) else {
            throw RelayError(.harnessMissing, "The selected runtime location no longer exists.")
        }
        if harnessKey == .hermes {
            guard isDirectory.boolValue else {
                throw RelayError(.invalidInput, "Choose the Hermes Agent folder that contains run_agent.py.")
            }
            return selected
        }
        if isDirectory.boolValue {
            if FileManager.default.fileExists(atPath: selected.appendingPathComponent("openclaw.mjs").path) {
                return selected
            }
            let package = selected.appendingPathComponent("node_modules/openclaw", isDirectory: true)
            if FileManager.default.fileExists(atPath: package.appendingPathComponent("openclaw.mjs").path) {
                return package
            }
        }
        let resolved = selected.resolvingSymlinksInPath()
        var candidate = isDirectory.boolValue ? resolved : resolved.deletingLastPathComponent()
        for _ in 0..<6 {
            if FileManager.default.fileExists(atPath: candidate.appendingPathComponent("openclaw.mjs").path) {
                return candidate
            }
            let parent = candidate.deletingLastPathComponent()
            if parent.path == candidate.path { break }
            candidate = parent
        }
        throw RelayError(.invalidInput, "Choose the OpenClaw package or source folder that contains openclaw.mjs, or its openclaw command.")
    }

    public func install(harnessKey: HarnessKey) async throws -> HarnessActionResult {
        guard legacyManagedRuntimeActionsEnabled else {
            throw RelayError(.unsupported, "Relay Console does not install runtimes. Install and authenticate the runtime yourself, then connect its existing location.")
        }
        let entry = catalogEntry(harnessKey)
        let pin = try HarnessCompatibilityManifest.loadCurrent().pin(for: harnessKey)
        let installPath = paths.harnessesDir.appendingPathComponent(entry.managedDirName, isDirectory: true)
        _ = try saveRecord(entry: entry, update: [
            "source": .string(HarnessInstallSource.managed.rawValue),
            "lifecycleState": .string(HarnessLifecycleState.installing.rawValue),
            "installPath": .string(installPath.path),
            "selectedLocalPath": .null,
            "dependencyStatus": .string("installing"),
            "modelAuthStatus": .string(HarnessModelAuthStatus.unknown.rawValue),
            "modelAuthProvider": .string("openai_chatgpt"),
            "lastCheckedAt": .string(nowIso()),
            "setupNotes": .array(entry.setupNotes.map(JSONValue.string))
        ])

        do {
            if harnessKey == .hermes {
                try await installHermes(entry: entry, installPath: installPath)
            } else {
                try await installManagedOpenClaw(installPath: installPath)
            }
            let commit: String?
            if harnessKey == .hermes {
                commit = try await readGitCommit(cwd: installPath)
            } else {
                commit = pin.commit
            }
            guard commit == pin.commit else {
                throw RelayError(.internalError, "\(entry.displayName) does not match Relay Console's tested commit.")
            }
            let auth = await checkOpenAIAuth(harnessKey: harnessKey, harnessPath: installPath)
            if harnessKey == .hermes, auth.connected {
                _ = try? await ensureHermesOpenAICodexProvider(harnessPath: installPath, hermesHome: paths.hermesHomeDir)
            }
            let lifecycle: HarnessLifecycleState
            if harnessKey == .openclaw {
                lifecycle = auth.connected ? .installed : .authRequired
            } else {
                lifecycle = auth.connected ? .connected : .authRequired
            }
            let record = try saveRecord(entry: entry, update: [
                "source": .string(HarnessInstallSource.managed.rawValue),
                "lifecycleState": .string(lifecycle.rawValue),
                "installPath": .string(installPath.path),
                "installedCommit": commit.map(JSONValue.string) ?? .null,
                "installedVersion": .string(pin.version),
                "compatibilityManifestVersion": .number(1),
                "testedGitRef": .string(pin.gitRef),
                "dependencyStatus": .string("installed"),
                "modelAuthStatus": .string(auth.connected ? HarnessModelAuthStatus.connected.rawValue : HarnessModelAuthStatus.notConfigured.rawValue),
                "modelAuthProvider": .string("openai_chatgpt"),
                "modelAuthCommand": .object(modelAuthCommand(harnessKey: harnessKey, harnessPath: installPath).json),
                "modelAuthLastError": auth.error.map(JSONValue.string) ?? .null,
                "modelAuthCheckedAt": .string(nowIso()),
                "runtimeCommand": runtimeCommand(harnessKey: harnessKey, harnessPath: installPath)?.jsonValue ?? .null,
                "healthCheckCommand": healthCommand(harnessKey: harnessKey, harnessPath: installPath)?.jsonValue ?? .null,
                "lastError": .null,
                "lastTechnicalError": .null,
                "lastCheckedAt": .string(nowIso())
            ])
            let harness = record.harnessId.flatMap { try? data.getHarness($0) }
            return HarnessActionResult(record: record, harness: harness, health: nil, output: nil)
        } catch {
            let technicalError = redactedTechnicalError(error)
            let message = humanizeHarnessError(technicalError)
            let record = try saveRecord(entry: entry, update: [
                "source": .string(HarnessInstallSource.managed.rawValue),
                "lifecycleState": .string(HarnessLifecycleState.error.rawValue),
                "installPath": .string(installPath.path),
                "dependencyStatus": .string("error"),
                "lastError": .string(message),
                "lastTechnicalError": .string(technicalError),
                "lastCheckedAt": .string(nowIso())
            ])
            emitInstallProgress(harnessKey, stage: "failed", message: message, status: "failed")
            return HarnessActionResult(record: record, harness: record.harnessId.flatMap { try? data.getHarness($0) }, health: nil, output: nil)
        }
    }

    public func update(harnessKey: HarnessKey) async throws -> HarnessActionResult {
        guard legacyManagedRuntimeActionsEnabled else {
            throw RelayError(.unsupported, "Relay Console does not update user-managed runtimes.")
        }
        let entry = catalogEntry(harnessKey)
        let pin = try HarnessCompatibilityManifest.loadCurrent().pin(for: harnessKey)
        let previous = try getRecord(harnessKey)
        guard previous.source == .managed, let installPathText = previous.installPath else {
            throw RelayError(.unsupported, "Only Relay-managed harness installations can be updated.")
        }
        if previous.installedCommit == pin.commit {
            return try await check(harnessKey: harnessKey)
        }

        let installPath = URL(fileURLWithPath: installPathText, isDirectory: true)
        let statePath = harnessKey == .hermes ? paths.hermesHomeDir : openClawManagedHome()
        let backups = paths.cacheDir.appendingPathComponent("harness-update-backups", isDirectory: true)
        if harnessKey == .openclaw { stopOpenClawGateway(for: installPath.path) }
        restartHermesGatewayForProfile(homePath: harnessKey == .hermes ? paths.hermesHomeDir.path : nil)
        let backup = try HarnessUpdateTransaction.begin(
            harnessKey: harnessKey,
            installPath: installPath,
            statePath: statePath,
            backupRoot: backups,
            previousVersion: previous.installedVersion,
            previousCommit: previous.installedCommit
        )
        do {
            _ = try saveRecord(entry: entry, update: [
                "lifecycleState": .string(HarnessLifecycleState.installing.rawValue),
                "dependencyStatus": .string("updating"),
                "updateTargetVersion": .string(pin.version),
                "updateTargetCommit": .string(pin.commit),
                "lastError": .null,
                "lastCheckedAt": .string(nowIso())
            ])
            if harnessKey == .hermes {
                try await installHermes(entry: entry, installPath: installPath)
            } else {
                try await installManagedOpenClaw(installPath: installPath)
            }
            let actualCommit: String?
            if harnessKey == .hermes {
                actualCommit = try await readGitCommit(cwd: installPath)
            } else {
                actualCommit = pin.commit
            }
            guard actualCommit == pin.commit else {
                throw RelayError(.internalError, "Updated \(entry.displayName) does not match Relay Console's tested commit.")
            }
            let auth = await checkOpenAIAuth(harnessKey: harnessKey, harnessPath: installPath)
            let lifecycle: HarnessLifecycleState = auth.connected ? (harnessKey == .hermes ? .connected : .installed) : .authRequired
            let record = try saveRecord(entry: entry, update: [
                "lifecycleState": .string(lifecycle.rawValue),
                "dependencyStatus": .string("installed"),
                "installedVersion": .string(pin.version),
                "installedCommit": .string(pin.commit),
                "compatibilityManifestVersion": .number(1),
                "testedGitRef": .string(pin.gitRef),
                "rollbackBackupRoot": .string(backup.root.path),
                "rollbackPreviousVersion": backup.previousVersion.map(JSONValue.string) ?? .null,
                "rollbackPreviousCommit": backup.previousCommit.map(JSONValue.string) ?? .null,
                "lastError": .null,
                "lastTechnicalError": .null,
                "lastCheckedAt": .string(nowIso())
            ])
            return HarnessActionResult(record: record, harness: record.harnessId.flatMap { try? data.getHarness($0) }, health: nil, output: "Updated to \(pin.version). The previous managed source and state backup are retained for rollback.")
        } catch {
            try? HarnessUpdateTransaction.restore(backup, installPath: installPath, statePath: statePath)
            try? FileManager.default.removeItem(at: backup.root)
            let technicalError = redactedTechnicalError(error)
            let message = humanizeHarnessError(technicalError)
            let record = try saveRecord(entry: entry, update: [
                "lifecycleState": .string(previous.lifecycleState.rawValue),
                "dependencyStatus": .string("installed"),
                "installedVersion": previous.installedVersion.map(JSONValue.string) ?? .null,
                "installedCommit": previous.installedCommit.map(JSONValue.string) ?? .null,
                "lastError": .string("Update failed and Relay Console restored the previous harness installation."),
                "lastTechnicalError": .string(technicalError),
                "lastCheckedAt": .string(nowIso())
            ])
            return HarnessActionResult(record: record, harness: record.harnessId.flatMap { try? data.getHarness($0) }, health: nil, output: message)
        }
    }

    public func rollbackLastUpdate(harnessKey: HarnessKey) async throws -> HarnessActionResult {
        guard legacyManagedRuntimeActionsEnabled else {
            throw RelayError(.unsupported, "Relay Console does not roll back user-managed runtimes.")
        }
        let entry = catalogEntry(harnessKey)
        let record = try getRecord(harnessKey)
        guard record.source == .managed,
              let installPathText = record.installPath,
              let harness = record.harnessId.flatMap({ try? data.getHarness($0) }),
              let backupRootText = stringValue(harness.config["rollbackBackupRoot"])
        else {
            throw RelayError(.unsupported, "No retained managed rollback is available for \(entry.displayName).")
        }
        let backupRoot = URL(fileURLWithPath: backupRootText, isDirectory: true)
        let backup = HarnessUpdateBackup(
            root: backupRoot,
            source: backupRoot.appendingPathComponent("source", isDirectory: true),
            state: backupRoot.appendingPathComponent("state", isDirectory: true),
            previousVersion: stringValue(harness.config["rollbackPreviousVersion"]),
            previousCommit: stringValue(harness.config["rollbackPreviousCommit"])
        )
        let installPath = URL(fileURLWithPath: installPathText, isDirectory: true)
        let statePath = harnessKey == .hermes ? paths.hermesHomeDir : openClawManagedHome()
        if harnessKey == .openclaw { stopOpenClawGateway(for: installPath.path) }
        restartHermesGatewayForProfile(homePath: harnessKey == .hermes ? paths.hermesHomeDir.path : nil)
        try HarnessUpdateTransaction.restore(backup, installPath: installPath, statePath: statePath)
        try assertHarnessFolder(entry: entry, installPath)
        try? FileManager.default.removeItem(at: backup.root)
        let restored = try saveRecord(entry: entry, update: [
            "lifecycleState": .string(HarnessLifecycleState.installed.rawValue),
            "dependencyStatus": .string("installed"),
            "installedVersion": backup.previousVersion.map(JSONValue.string) ?? .null,
            "installedCommit": backup.previousCommit.map(JSONValue.string) ?? .null,
            "rollbackBackupRoot": .null,
            "rollbackPreviousVersion": .null,
            "rollbackPreviousCommit": .null,
            "lastError": .null,
            "lastTechnicalError": .null,
            "lastCheckedAt": .string(nowIso())
        ])
        return HarnessActionResult(record: restored, harness: restored.harnessId.flatMap { try? data.getHarness($0) }, health: nil, output: "Restored \(backup.previousVersion ?? "the previous tested version"). Re-run the harness health check before use.")
    }

    public func connectOpenAI(harnessKey: HarnessKey) async throws -> HarnessActionResult {
        guard legacyManagedRuntimeActionsEnabled else {
            throw RelayError(.unsupported, "Authenticate with the model provider inside Hermes Agent or OpenClaw, then re-check the connection.")
        }
        let entry = catalogEntry(harnessKey)
        var record = try getRecord(harnessKey)
        guard let installPathText = record.installPath else {
            return try await install(harnessKey: harnessKey)
        }
        let harnessPath = URL(fileURLWithPath: installPathText)
        let started = HarnessModelAuthSession(
            provider: "openai_chatgpt",
            status: "starting",
            message: "Opening OpenAI sign-in through \(entry.displayName).",
            userCode: nil,
            verificationUrl: nil,
            startedAt: nowIso(),
            expiresAt: nil
        )
        record = try saveRecord(entry: entry, update: [
            "modelAuthStatus": .string(HarnessModelAuthStatus.checking.rawValue),
            "modelAuthSession": encodeSession(started),
            "lifecycleState": .string(HarnessLifecycleState.authRequired.rawValue)
        ])
        _ = record

        if harnessKey == .openclaw {
            return try await connectOpenClawOpenAI(entry: entry, harnessPath: harnessPath, started: started)
        }

        let authCapture = DeviceAuthCapture()
        let command = modelAuthCommand(harnessKey: harnessKey, harnessPath: harnessPath)
        let result = await runner.run(command.command, command.args, options: CommandOptions(
            cwd: command.cwd.map(URL.init(fileURLWithPath:)),
            env: hermesEnv(harnessPath: harnessPath, hermesHome: defaultHermesHome(source: .managed)),
            timeoutMs: 600_000,
            executableAuthorization: .exact(URL(fileURLWithPath: command.command)),
            onStdoutLine: { [weak self] line in
                guard let self else { return }
                if let parsed = parseDeviceAuthOutput(line) {
                    authCapture.update(url: parsed.url, code: parsed.code)
                    self.openSupportedAuthURL(parsed.url)
                    let captured = authCapture.snapshot()
                    let waiting = HarnessModelAuthSession(
                        provider: "openai_chatgpt",
                        status: "waiting_for_user",
                        message: "Waiting for OpenAI sign-in through \(entry.displayName).",
                        userCode: captured.code ?? parsed.code,
                        verificationUrl: captured.url ?? parsed.url,
                        startedAt: started.startedAt,
                        expiresAt: nil
                    )
                    _ = try? self.saveRecord(entry: entry, update: [
                        "modelAuthStatus": .string(HarnessModelAuthStatus.checking.rawValue),
                        "modelAuthSession": encodeSession(waiting)
                    ])
                }
            },
            onStderrLine: { [weak self] line in
                guard let self else { return }
                if let parsed = parseDeviceAuthOutput(line) {
                    authCapture.update(url: parsed.url, code: parsed.code)
                    self.openSupportedAuthURL(parsed.url)
                }
            }
        ))

        let auth = await checkOpenAIAuth(harnessKey: harnessKey, harnessPath: harnessPath)
        if result.code == 0 || auth.connected {
            if harnessKey == .hermes {
                _ = try? await ensureHermesOpenAICodexProvider(harnessPath: harnessPath, hermesHome: paths.hermesHomeDir)
            }
            let lifecycle: HarnessLifecycleState = harnessKey == .openclaw ? .installed : .connected
            let record = try saveRecord(entry: entry, update: [
                "modelAuthStatus": .string(HarnessModelAuthStatus.connected.rawValue),
                "modelAuthSession": .null,
                "modelAuthLastError": .null,
                "modelAuthCheckedAt": .string(nowIso()),
                "lifecycleState": .string(lifecycle.rawValue)
            ])
            return HarnessActionResult(record: record, harness: record.harnessId.flatMap { try? data.getHarness($0) }, health: nil, output: result.stdout)
        }

        let capturedAuth = authCapture.snapshot()
        let failed = HarnessModelAuthSession(
            provider: "openai_chatgpt",
            status: capturedAuth.url != nil || capturedAuth.code != nil ? "expired" : "failed",
            message: "OpenAI sign-in through \(entry.displayName) did not finish.",
            userCode: capturedAuth.code,
            verificationUrl: capturedAuth.url,
            startedAt: started.startedAt,
            expiresAt: nil
        )
        let recordFailed = try saveRecord(entry: entry, update: [
            "modelAuthStatus": .string(HarnessModelAuthStatus.failed.rawValue),
            "modelAuthSession": encodeSession(failed),
            "modelAuthLastError": .string(trimForStorage(result.diagnosticTail)),
            "modelAuthCheckedAt": .string(nowIso()),
            "lifecycleState": .string(HarnessLifecycleState.authRequired.rawValue)
        ])
        return HarnessActionResult(record: recordFailed, harness: recordFailed.harnessId.flatMap { try? data.getHarness($0) }, health: nil, output: result.stderr)
    }

    private func connectOpenClawOpenAI(entry: HarnessCatalogEntry, harnessPath: URL, started: HarnessModelAuthSession) async throws -> HarnessActionResult {
        let command = modelAuthCommand(harnessKey: .openclaw, harnessPath: harnessPath)
        let helper = openClawAuthHelperCommand(harnessPath: harnessPath)
        let authCapture = DeviceAuthCapture()
        let result = await runner.run(helper.command, helper.args, options: CommandOptions(
            cwd: helper.cwd.map(URL.init(fileURLWithPath:)),
            env: openClawEnv(),
            timeoutMs: 900_000,
            executableAuthorization: .exact(URL(fileURLWithPath: helper.command)),
            onStdoutLine: { [weak self] line in
                guard let self else { return }
                guard let event = parseOpenClawAuthEvent(line) else { return }
                let type = stringValue(event["type"])
                if type == "verification" {
                    guard let url = stringValue(event["verificationUrl"]),
                          let code = stringValue(event["userCode"]),
                          !url.isEmpty,
                          !code.isEmpty
                    else {
                        return
                    }
                    authCapture.update(url: url, code: code)
                    self.openSupportedAuthURL(url)
                    let waiting = HarnessModelAuthSession(
                        provider: "openai_chatgpt",
                        status: "waiting_for_user",
                        message: "Waiting for OpenAI sign-in through \(entry.displayName).",
                        userCode: code,
                        verificationUrl: url,
                        startedAt: started.startedAt,
                        expiresAt: openClawAuthExpiresAt(event)
                    )
                    _ = try? self.saveRecord(entry: entry, update: [
                        "modelAuthStatus": .string(HarnessModelAuthStatus.checking.rawValue),
                        "modelAuthCommand": .object(command.json),
                        "modelAuthSession": encodeSession(waiting),
                        "modelAuthLastError": .null,
                        "lastError": .null,
                        "lastCheckedAt": .string(nowIso())
                    ])
                } else if type == "error" {
                    authCapture.updateError(stringValue(event["message"]) ?? "OpenClaw authentication failed.")
                }
            },
            onStderrLine: { line in
                authCapture.appendOutput(line)
            }
        ))

        let auth = await checkOpenAIAuth(harnessKey: .openclaw, harnessPath: harnessPath)
        if result.code == 0 || auth.connected {
            _ = try saveRecord(entry: entry, update: [
                "modelAuthStatus": .string(HarnessModelAuthStatus.connected.rawValue),
                "modelAuthCommand": .object(command.json),
                "modelAuthSession": .null,
                "modelAuthLastError": .null,
                "modelAuthCheckedAt": .string(nowIso()),
                "lifecycleState": .string(HarnessLifecycleState.installed.rawValue)
            ])
            return try await start(harnessKey: .openclaw)
        }

        let capturedAuth = authCapture.snapshot()
        let technical = capturedAuth.error ?? trimForStorage(result.diagnosticTail)
        let failed = HarnessModelAuthSession(
            provider: "openai_chatgpt",
            status: capturedAuth.url != nil || capturedAuth.code != nil ? "expired" : "failed",
            message: "OpenAI sign-in through \(entry.displayName) did not finish.",
            userCode: capturedAuth.code,
            verificationUrl: capturedAuth.url,
            startedAt: started.startedAt,
            expiresAt: nil
        )
        let recordFailed = try saveRecord(entry: entry, update: [
            "modelAuthStatus": .string(HarnessModelAuthStatus.failed.rawValue),
            "modelAuthCommand": .object(command.json),
            "modelAuthSession": encodeSession(failed),
            "modelAuthLastError": .string(technical.isEmpty ? "OpenClaw authentication failed." : technical),
            "modelAuthCheckedAt": .string(nowIso()),
            "lifecycleState": .string(HarnessLifecycleState.authRequired.rawValue),
            "lastError": .string("OpenAI sign-in through \(entry.displayName) did not finish."),
            "lastCheckedAt": .string(nowIso())
        ])
        return HarnessActionResult(record: recordFailed, harness: recordFailed.harnessId.flatMap { try? data.getHarness($0) }, health: nil, output: result.stderr)
    }

    public func start(harnessKey: HarnessKey) async throws -> HarnessActionResult {
        guard legacyManagedRuntimeActionsEnabled else {
            throw RelayError(.unsupported, "Start and stop the user-managed runtime outside Relay Console.")
        }
        if harnessKey != .openclaw {
            return try await check(harnessKey: harnessKey)
        }
        let entry = catalogEntry(.openclaw)
        var record = try getRecord(.openclaw)
        guard let installPath = record.installPath else {
            return try await install(harnessKey: .openclaw)
        }
        record = try saveRecord(entry: entry, update: ["lifecycleState": .string(HarnessLifecycleState.starting.rawValue)])
        let harnessPath = URL(fileURLWithPath: installPath)
        let node = resolveOpenClawNodePath()
        try await ensureOpenClawGatewayServiceStarted(harnessPath: harnessPath, nodePath: node)
        try await waitForOpenClawGateway(harnessPath: harnessPath)
        if Task.isCancelled {
            throw RelayError(.dispatchCancelled, "OpenClaw gateway startup was cancelled.")
        }
        let health = await getHealthFromHarnessConfig(harnessId: record.harnessId ?? "", config: recordToConfig(record))
        if Task.isCancelled {
            throw RelayError(.dispatchCancelled, "OpenClaw gateway startup was cancelled.")
        }
        let next = try saveRecord(entry: entry, update: [
            "lifecycleState": .string(health.status == .healthy ? HarnessLifecycleState.connected.rawValue : (health.status == .authRequired ? HarnessLifecycleState.authRequired.rawValue : HarnessLifecycleState.error.rawValue)),
            "modelAuthStatus": .string(health.status == .authRequired ? HarnessModelAuthStatus.notConfigured.rawValue : (health.status == .healthy ? HarnessModelAuthStatus.connected.rawValue : record.modelAuthStatus.rawValue)),
            "lastError": health.status == .healthy ? .null : .string(health.message),
            "lastCheckedAt": .string(nowIso())
        ])
        return HarnessActionResult(record: next, harness: next.harnessId.flatMap { try? data.getHarness($0) }, health: health, output: nil)
    }

    public func check(harnessKey: HarnessKey) async throws -> HarnessActionResult {
        let entry = catalogEntry(harnessKey)
        let record = try getRecord(harnessKey)
        guard let harnessId = record.harnessId, let harness = try? data.getHarness(harnessId) else {
            return HarnessActionResult(record: record, harness: nil, health: nil, output: nil)
        }
        var config = harness.config
        for (key, value) in recordToConfig(record) {
            config[key] = value
        }
        let health = await getHealthFromHarnessConfig(harnessId: harness.id, config: config)
        if Task.isCancelled {
            return HarnessActionResult(record: record, harness: harness, health: health, output: nil)
        }
        let lifecycle: HarnessLifecycleState = health.status == .healthy ? .connected : (health.status == .authRequired ? .authRequired : .error)
        var update: JSONRecord = [
            "lifecycleState": .string(lifecycle.rawValue),
            "modelAuthStatus": .string(health.status == .authRequired ? HarnessModelAuthStatus.notConfigured.rawValue : (health.status == .healthy ? HarnessModelAuthStatus.connected.rawValue : record.modelAuthStatus.rawValue)),
            "lastError": health.status == .healthy ? .null : .string(health.message),
            "lastCheckedAt": .string(nowIso())
        ]
        update["installPath"] = record.installPath.map(JSONValue.string) ?? .null
        if record.harnessKey == .hermes {
            update["hermesHome"] = .string(
                stringValue(harness.config["hermesHome"])
                    ?? defaultHermesHome(source: record.source).path
            )
        }
        let next = try saveRecord(entry: entry, update: update)
        return HarnessActionResult(record: next, harness: harness, health: health, output: nil)
    }

    public func getHealthFromHarnessConfig(harnessId: String, config: JSONRecord) async -> HarnessHealth {
        let key = HarnessKey(rawValue: stringValue(config["harnessKey"]) ?? "") ?? .hermes
        let installPathText = stringValue(config["installPath"])
        guard let installPathText else {
            return HarnessHealth(harnessId: harnessId, runtimeType: key == .hermes ? .hermes : .openclaw, status: .missing, message: "\(key.rawValue) is not installed.", capabilities: [], checkedAt: nowIso(), detail: [:])
        }
        let installPath = URL(fileURLWithPath: installPathText)
        if key == .hermes {
            guard FileManager.default.fileExists(atPath: installPath.appendingPathComponent("run_agent.py").path),
                  let python = resolveHermesPython(installPath)
            else {
                return HarnessHealth(harnessId: harnessId, runtimeType: .hermes, status: .missing, message: "Hermes Agent Python environment is not installed.", capabilities: [], checkedAt: nowIso(), detail: [:])
            }
            let source = HarnessInstallSource(rawValue: stringValue(config["source"]) ?? "") ?? .missing
            let hermesHome = stringValue(config["hermesHome"])
                .map { URL(fileURLWithPath: $0, isDirectory: true) }
                ?? defaultHermesHome(source: source)
            let importResult = await runner.run(
                python.path,
                ["-c", "import run_agent, tui_gateway.entry; print('ok')"],
                options: CommandOptions(
                    cwd: installPath,
                    env: hermesEnv(harnessPath: installPath, hermesHome: hermesHome),
                    timeoutMs: 30_000,
                    executableAuthorization: .pythonVirtualEnvironment(
                        harnessRoot: installPath
                    )
                )
            )
            guard importResult.code == 0 else {
                return HarnessHealth(harnessId: harnessId, runtimeType: .hermes, status: .unhealthy, message: trimForStorage(importResult.stderr), capabilities: [], checkedAt: nowIso(), detail: [:])
            }
            let auth = await checkOpenAIAuth(
                harnessKey: .hermes,
                harnessPath: installPath,
                hermesHome: hermesHome
            )
            guard auth.connected else {
                return HarnessHealth(harnessId: harnessId, runtimeType: .hermes, status: .authRequired, message: "Authenticate with your model provider in Hermes Agent, then re-check.", capabilities: [], checkedAt: nowIso(), detail: [:])
            }
            return HarnessHealth(harnessId: harnessId, runtimeType: .hermes, status: .healthy, message: "Hermes Agent is ready.", version: stringValue(config["installedVersion"]), capabilities: ["chat", "streaming", "sessions", "tools", "openai-auth"], checkedAt: nowIso(), detail: [:])
        }

        guard FileManager.default.fileExists(atPath: installPath.appendingPathComponent("openclaw.mjs").path) else {
            return HarnessHealth(harnessId: harnessId, runtimeType: .openclaw, status: .missing, message: "OpenClaw is not installed.", capabilities: [], checkedAt: nowIso(), detail: [:])
        }
        let auth = await checkOpenAIAuth(harnessKey: .openclaw, harnessPath: installPath)
        guard auth.connected else {
            let authMessage = auth.error?.trimmingCharacters(in: .whitespacesAndNewlines)
            return HarnessHealth(harnessId: harnessId, runtimeType: .openclaw, status: .authRequired, message: authMessage?.isEmpty == false ? authMessage! : "Authenticate with your model provider in OpenClaw, then re-check.", capabilities: [], checkedAt: nowIso(), detail: [:])
        }
        let node = resolveOpenClawNodePath()
        let gateway = await runner.run(node.path, ["openclaw.mjs", "gateway", "status", "--json"], options: CommandOptions(cwd: installPath, env: openClawEnv(nodePath: node), timeoutMs: 10_000, executableAuthorization: .exact(node)))
        let agents = await runner.run(node.path, ["openclaw.mjs", "agents", "list", "--json"], options: CommandOptions(cwd: installPath, env: openClawEnv(nodePath: node), timeoutMs: 30_000, executableAuthorization: .exact(node)))
        guard openClawGatewayStatusIsReady(gateway), agents.code == 0 else {
            let gatewayOutput = gateway.diagnosticTail
            let detail = openClawGatewayNotReadyMessage(gatewayOutput)
            return HarnessHealth(harnessId: harnessId, runtimeType: .openclaw, status: .degraded, message: "Start the OpenClaw gateway outside Relay Console, then re-check. \(detail)", capabilities: ["openai-auth"], checkedAt: nowIso(), detail: [:])
        }
        return HarnessHealth(harnessId: harnessId, runtimeType: .openclaw, status: .healthy, message: "OpenClaw is ready.", version: stringValue(config["installedVersion"]), capabilities: ["chat", "agents", "workspace-binding", "openai-auth", "gateway-status"], checkedAt: nowIso(), detail: [:])
    }

    public func ensureHermesAgentProfile(_ agent: AgentWithBinding) async throws -> AgentWithBinding {
        guard agent.binding.runtimeType == .hermes else { return agent }
        var current = try data.getAgent(agent.id)
        let harnessPath = try harnessPath(for: current.harness)
        if let detectedVersion = await detectedHermesVersion(harnessPath: harnessPath),
           detectedVersion != stringValue(current.harness.config["installedVersion"]) {
            checkpointHermesProfile(current, reason: "runtime-version-change-detected")
            if (try? getRecord(.hermes)) != nil {
                _ = try saveRecord(
                    entry: catalogEntry(.hermes),
                    update: ["installedVersion": .string(detectedVersion)]
                )
                current = try data.getAgent(agent.id)
            }
        }
        let hermesRoot = hermesRoot(for: current.harness)
        if let slug = current.binding.hermesProfileSlug,
           let home = current.binding.hermesHomePath,
           let identity = current.binding.hermesIdentityFilePath,
           FileManager.default.fileExists(atPath: home) {
            let existingHome = URL(fileURLWithPath: home, isDirectory: true)
            if shouldMigrateLegacyHermesProfile(
                profileHome: existingHome,
                connectedHermesRoot: hermesRoot
            ) {
                return try await migrateLegacyHermesProfile(
                    current,
                    profileSlug: slug,
                    profileHome: existingHome,
                    harnessPath: harnessPath,
                    connectedHermesRoot: hermesRoot
                )
            }
            if slug.hasPrefix("relay-"),
               HermesRelayProfileService.isDirectProfile(existingHome, beneath: hermesRoot),
               stringValue(current.binding.config["relayProfileOwnershipNonce"]) == nil {
                let ownershipNonce = UUID().uuidString.lowercased()
                try HermesRelayProfileService.writeMarker(
                    profileHome: existingHome,
                    agentId: current.id,
                    profileSlug: slug,
                    ownershipNonce: ownershipNonce
                )
                current = try data.setRuntimeBindingHermesProfile(
                    agentId: current.id,
                    profileSlug: slug,
                    hermesHomePath: home,
                    identityFilePath: identity,
                    ownershipNonce: ownershipNonce
                )
            }
            if slug.hasPrefix("relay-"),
               HermesRelayProfileService.isDirectProfile(existingHome, beneath: hermesRoot),
               !HermesRelayProfileService.owns(
                   profileHome: existingHome,
                   agentId: current.id,
                   profileSlug: slug,
                   ownershipNonce: stringValue(
                       current.binding.config["relayProfileOwnershipNonce"]
                   )
               ) {
                throw RelayError(
                    .permissionDenied,
                    "The Hermes profile ownership marker does not match this Relay agent."
                )
            }
            try ensureRelayHermesSoul(agent: current, profileSlug: slug, identityFilePath: URL(fileURLWithPath: identity))
            let configured = try await ensureHermesProfileOpenAICodexProvider(
                agent: current,
                harnessPath: harnessPath,
                hermesHome: existingHome
            )
            await maintainHermesCronScheduler(for: configured, harnessPath: harnessPath)
            return configured
        }
        let existingSlug = current.binding.hermesProfileSlug?.trimmingCharacters(in: .whitespacesAndNewlines)
        let profileSlug = existingSlug?.hasPrefix("relay-") == true
            ? existingSlug!
            : hermesProfileSlug(for: current)
        return try await provisionHermesProfile(
            current,
            profileSlug: profileSlug,
            harnessPath: harnessPath,
            hermesRoot: hermesRoot,
            backupReason: "initial-profile"
        )
    }

    private func provisionHermesProfile(
        _ current: AgentWithBinding,
        profileSlug: String,
        harnessPath: URL,
        hermesRoot: URL,
        backupReason: String?
    ) async throws -> AgentWithBinding {
        guard let python = resolveHermesPython(harnessPath) else {
            throw RelayError(.harnessMissing, "Hermes Agent Python environment is not installed.")
        }
        let expectedHome = hermesRoot
            .appendingPathComponent("profiles", isDirectory: true)
            .appendingPathComponent(profileSlug, isDirectory: true)
        if FileManager.default.fileExists(atPath: expectedHome.path),
           !HermesRelayProfileService.owns(
               profileHome: expectedHome,
               agentId: current.id,
               profileSlug: profileSlug,
               ownershipNonce: stringValue(
                   current.binding.config["relayProfileOwnershipNonce"]
               )
           ) {
            throw RelayError(
                .invalidInput,
                "A Hermes profile named \(profileSlug) already exists and is not owned by this Relay agent."
            )
        }
        let soul = buildRelayHermesSoul(agent: current)
        let payload: JSONRecord = [
            "profileSlug": .string(profileSlug),
            "agentId": .string(current.id),
            "agentName": .string(current.name),
            "agentRole": current.description.map(JSONValue.string) ?? .null,
            "externalAgentId": current.binding.externalAgentId.map(JSONValue.string) ?? .null,
            "soul": .string(soul),
            "legacySouls": .array(knownGeneratedHermesSouls(agent: current, profileSlug: profileSlug).map(JSONValue.string))
        ]
        var env = hermesEnv(harnessPath: harnessPath, hermesHome: hermesRoot)
        env["RELAY_CONSOLE_HERMES_PROFILE_PAYLOAD"] = encodeJSONRecord(payload)
        let result = await runner.run(
            python.path,
            ["-c", hermesProfileProvisionScript],
            options: CommandOptions(
                cwd: harnessPath,
                env: env,
                timeoutMs: 120_000,
                executableAuthorization: .pythonVirtualEnvironment(
                    harnessRoot: harnessPath
                )
            )
        )
        guard result.code == 0, let parsed = parseJSONObject(from: result.stdout) else {
            throw RelayError(.internalError, trimForStorage(result.diagnosticTail))
        }
        guard let returnedSlug = stringValue(parsed["profileSlug"]) ?? Optional(profileSlug),
              let home = stringValue(parsed["profileHomePath"]),
              let identity = stringValue(parsed["identityFilePath"])
        else {
            throw RelayError(.internalError, "Hermes profile provisioning returned incomplete profile metadata.")
        }
        let returnedHome = URL(fileURLWithPath: home, isDirectory: true)
        guard returnedSlug == profileSlug,
              returnedHome.standardizedFileURL == expectedHome.standardizedFileURL,
              HermesRelayProfileService.isDirectProfile(returnedHome, beneath: hermesRoot)
        else {
            throw RelayError(.permissionDenied, "Hermes returned a profile outside the connected profile directory.")
        }
        let ownershipNonce =
            stringValue(current.binding.config["relayProfileOwnershipNonce"])
            ?? UUID().uuidString.lowercased()
        try HermesRelayProfileService.writeMarker(
            profileHome: returnedHome,
            agentId: current.id,
            profileSlug: returnedSlug,
            ownershipNonce: ownershipNonce
        )
        let updated = try data.setRuntimeBindingHermesProfile(
            agentId: current.id,
            profileSlug: returnedSlug,
            hermesHomePath: home,
            identityFilePath: identity,
            ownershipNonce: ownershipNonce
        )
        let configured = try await ensureHermesProfileOpenAICodexProvider(
            agent: updated,
            harnessPath: harnessPath,
            hermesHome: returnedHome
        )
        await maintainHermesCronScheduler(for: configured, harnessPath: harnessPath)
        if let backupReason {
            checkpointHermesProfile(configured, reason: backupReason)
        }
        _ = try? data.log(severity: "info", category: "agents", message: "Hermes agent profile ready.", harnessId: current.harness.id, detail: ["agentId": .string(current.id), "profileSlug": .string(returnedSlug), "soulLength": .number(Double(soul.count))])
        return configured
    }

    private func migrateLegacyHermesProfile(
        _ current: AgentWithBinding,
        profileSlug: String,
        profileHome: URL,
        harnessPath: URL,
        connectedHermesRoot: URL
    ) async throws -> AgentWithBinding {
        guard let migrationCheckpoint = checkpointHermesProfile(
            current,
            reason: "before-standard-profile-migration"
        ) else {
            throw RelayError(
                .databaseUnavailable,
                "Relay could not safely checkpoint the existing Hermes profile, so it was not migrated."
            )
        }
        restartHermesGatewayForProfile(homePath: profileHome.path)
        await hermesCronScheduler.uninstall(hermesHome: profileHome)

        let standardSlug = hermesProfileSlug(for: current)
        var migrated = try await provisionHermesProfile(
            current,
            profileSlug: standardSlug,
            harnessPath: harnessPath,
            hermesRoot: connectedHermesRoot,
            backupReason: nil
        )
        guard let migratedHomePath = migrated.binding.hermesHomePath else {
            throw RelayError(.internalError, "The migrated Hermes profile has no home directory.")
        }
        let migratedHome = URL(fileURLWithPath: migratedHomePath, isDirectory: true)
        let checkpointedProfile = migrationCheckpoint.checkpoint
            .appendingPathComponent("files/profile", isDirectory: true)
        do {
            try HermesRelayProfileService.copyDurableState(
                from: checkpointedProfile,
                to: migratedHome
            )
            let ownershipNonce =
                stringValue(migrated.binding.config["relayProfileOwnershipNonce"])
                ?? UUID().uuidString.lowercased()
            try HermesRelayProfileService.writeMarker(
                profileHome: migratedHome,
                agentId: current.id,
                profileSlug: standardSlug,
                ownershipNonce: ownershipNonce
            )
            migrated = try data.setRuntimeBindingHermesProfile(
                agentId: current.id,
                profileSlug: standardSlug,
                hermesHomePath: migratedHome.path,
                identityFilePath: migratedHome.appendingPathComponent("SOUL.md").path,
                ownershipNonce: ownershipNonce
            )
            try ensureRelayHermesSoul(
                agent: migrated,
                profileSlug: standardSlug,
                identityFilePath: migratedHome.appendingPathComponent("SOUL.md")
            )
        } catch {
            restartHermesGatewayForProfile(homePath: migratedHome.path)
            await hermesCronScheduler.uninstall(hermesHome: migratedHome)
            _ = try? data.setRuntimeBindingHermesProfile(
                agentId: current.id,
                profileSlug: profileSlug,
                hermesHomePath: profileHome.path,
                identityFilePath: current.binding.hermesIdentityFilePath
                    ?? profileHome.appendingPathComponent("SOUL.md").path,
                ownershipNonce: stringValue(
                    current.binding.config["relayProfileOwnershipNonce"]
                )
            )
            throw error
        }
        migrated = try data.setRuntimeBindingHermesProfile(
            agentId: current.id,
            profileSlug: standardSlug,
            hermesHomePath: migratedHome.path,
            identityFilePath: migratedHome.appendingPathComponent("SOUL.md").path,
            ownershipNonce: stringValue(
                migrated.binding.config["relayProfileOwnershipNonce"]
            )
        )
        migrated = try await ensureHermesProfileOpenAICodexProvider(
            agent: migrated,
            harnessPath: harnessPath,
            hermesHome: migratedHome
        )
        await maintainHermesCronScheduler(for: migrated, harnessPath: harnessPath)
        checkpointHermesProfile(migrated, reason: "after-standard-profile-migration")
        _ = try? data.log(
            severity: "info",
            category: "agents",
            message: "Hermes agent moved to a standard user-managed profile.",
            harnessId: current.harness.id,
            detail: [
                "agentId": .string(current.id),
                "previousProfileSlug": .string(profileSlug),
                "previousProfileRetained": .string(profileHome.path),
                "profileSlug": .string(standardSlug),
                "profileHome": .string(migratedHome.path),
            ]
        )
        return migrated
    }

    private func shouldMigrateLegacyHermesProfile(
        profileHome: URL,
        connectedHermesRoot: URL
    ) -> Bool {
        HermesRelayProfileService.isDirectProfile(profileHome, beneath: paths.hermesHomeDir)
            && paths.hermesHomeDir.standardizedFileURL != connectedHermesRoot.standardizedFileURL
    }

    private func hermesRoot(for harness: Harness) -> URL {
        if let configured = stringValue(harness.config["hermesHome"])?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !configured.isEmpty {
            return URL(fileURLWithPath: configured, isDirectory: true).standardizedFileURL
        }
        let source = HarnessInstallSource(
            rawValue: stringValue(harness.config["source"]) ?? ""
        ) ?? .missing
        return defaultHermesHome(source: source).standardizedFileURL
    }

    private func detectedHermesVersion(harnessPath: URL) async -> String? {
        guard let python = resolveHermesPython(harnessPath) else { return nil }
        let result = await runner.run(
            python.path,
            ["-c", "import importlib.metadata; print(importlib.metadata.version('hermes-agent'))"],
            options: CommandOptions(
                cwd: harnessPath,
                timeoutMs: 30_000,
                executableAuthorization: .pythonVirtualEnvironment(
                    harnessRoot: harnessPath
                )
            )
        )
        let version = result.stdout.trimmingCharacters(in: .whitespacesAndNewlines)
        return result.code == 0 && !version.isEmpty ? version : nil
    }

    @discardableResult
    private func checkpointHermesProfile(
        _ agent: AgentWithBinding,
        reason: String
    ) -> HermesProfileBackupResult? {
        guard let profileSlug = agent.binding.hermesProfileSlug,
              let home = agent.binding.hermesHomePath,
              FileManager.default.fileExists(atPath: home)
        else { return nil }
        do {
            return try hermesProfileBackups.checkpointNow(
                profileHome: URL(fileURLWithPath: home, isDirectory: true),
                profileSlug: profileSlug,
                agentId: agent.id,
                reason: reason,
                runtimeVersion: stringValue(agent.harness.config["installedVersion"]),
                workspaceHome: agent.binding.workspaceFolderPath.map {
                    URL(fileURLWithPath: $0, isDirectory: true)
                }
            )
        } catch {
            _ = try? data.log(
                severity: "warn",
                category: "agents",
                message: "Hermes profile backup failed.",
                harnessId: agent.harness.id,
                detail: [
                    "agentId": .string(agent.id),
                    "profileSlug": .string(profileSlug),
                    "reason": .string(reason),
                    "error": .string(redactedTechnicalError(error)),
                ]
            )
            return nil
        }
    }

    private func markHermesAuthRequiredIfRootUnavailable(
        harness: Harness,
        harnessPath: URL,
        message: String
    ) async {
        let auth = await checkOpenAIAuth(
            harnessKey: .hermes,
            harnessPath: harnessPath,
            hermesHome: hermesRoot(for: harness)
        )
        if auth.connected {
            _ = try? data.log(
                severity: "warn",
                category: "harness",
                message: "A Hermes profile reported an authentication error while shared Hermes authentication remained available.",
                harnessId: harness.id,
                detail: ["profileError": .string(message)]
            )
            return
        }
        markAuthRequired(harness: harness, message: message)
    }

    private func ensureHermesProfileOpenAICodexProvider(agent: AgentWithBinding, harnessPath: URL, hermesHome: URL) async throws -> AgentWithBinding {
        do {
            let model = try HarnessModelSelectionService.resolve(agent.model ?? stringValue(agent.binding.config["model"]), for: .hermes)
            let output = try await ensureHermesOpenAICodexProvider(
                harnessPath: harnessPath,
                hermesHome: hermesHome,
                model: model.selected
            )
            let runtimeModel =
                parseJSONObject(from: output).flatMap { stringValue($0["model"]) }
                ?? model.selected
            let reconciled = try HarnessModelSelectionService.resolve(runtimeModel, for: .hermes)
            var config = agent.binding.config
            config["model"] = .string(reconciled.selected)
            config["modelFallbackApplied"] = .bool(reconciled.fallbackApplied)
            config["modelCatalogSource"] = .string(
                HarnessModelSelectionService.catalog(for: .hermes).source)
            config["hermesGatewayCodexConfiguredAt"] = nil
            config["hermesGatewayRuntime"] = nil
            config["hermesGatewayProviderConfiguredAt"] = .string(nowIso())
            config["hermesGatewayProvider"] = .string("openai-codex")
            return try data.updateAgent(
                agentId: agent.id, model: reconciled.selected, config: config)
        } catch {
            _ = try? data.log(severity: "warn", category: "agents", message: "Hermes profile OpenAI Codex provider setup failed.", harnessId: agent.harness.id, detail: [
                "agentId": .string(agent.id),
                "hermesHome": .string(hermesHome.path),
                "error": .string(redactedTechnicalError(error))
            ])
            return agent
        }
    }

    public func ensureOpenClawAgentProvisioned(_ agent: AgentWithBinding) async throws -> AgentWithBinding {
        guard agent.binding.runtimeType == .openclaw else { return agent }
        let current = try data.getAgent(agent.id)
        let harnessPath = try harnessPath(for: current.harness)
        guard FileManager.default.fileExists(atPath: harnessPath.appendingPathComponent("openclaw.mjs").path) else {
            throw RelayError(.harnessMissing, "OpenClaw is not installed.")
        }
        let slug = openClawSlug(for: current)
        let workspacePath = URL(fileURLWithPath: current.binding.workspaceFolderPath ?? defaultOpenClawWorkspacePath(for: slug).path)
        let model = try HarnessModelSelectionService.resolve(current.model ?? stringValue(current.binding.config["model"]), for: .openclaw)
        try FileManager.default.createDirectory(at: workspacePath, withIntermediateDirectories: true)
        let node = resolveOpenClawNodePath()
        if !(await openClawAgentExists(harnessPath: harnessPath, slug: slug, nodePath: node)) {
            var args = ["openclaw.mjs", "agents", "add", slug, "--workspace", workspacePath.path, "--non-interactive", "--json"]
            args += ["--model", model.selected]
            let result = await runner.run(node.path, args, options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: node), timeoutMs: 180_000, executableAuthorization: .exact(node)))
            guard result.code == 0 else {
                throw RelayError(.internalError, trimForStorage(result.diagnosticTail))
            }
        }
        if current.name.trimmingCharacters(in: .whitespacesAndNewlines) != slug {
            _ = await runner.run(node.path, ["openclaw.mjs", "agents", "set-identity", "--agent", slug, "--name", current.name, "--json"], options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: node), timeoutMs: 120_000, executableAuthorization: .exact(node)))
        }
        try bootstrapOpenClawAuthFromMainAgent(slug: slug)
        guard await openClawAgentExists(harnessPath: harnessPath, slug: slug, nodePath: node) else {
            throw RelayError(.internalError, "OpenClaw agent \"\(slug)\" was not visible after provisioning.")
        }
        var config = current.binding.config
        config["model"] = .string(model.selected)
        config["modelFallbackApplied"] = .bool(model.fallbackApplied)
        config["openclawAgentId"] = .string(slug)
        config["openclawWorkspacePath"] = .string(workspacePath.path)
        config["openclawStateDir"] = .string(openClawStateDir().path)
        config["openclawAgentDir"] = .string(openClawAgentDir(slug: slug).path)
        config["provisionedAt"] = .string(nowIso())
        let updated = try data.updateAgent(agentId: current.id, model: model.selected, externalAgentId: slug, workspaceFolderPath: workspacePath.path, config: config)
        _ = try? data.log(severity: "info", category: "agents", message: "OpenClaw agent ready.", harnessId: current.harness.id, detail: ["agentId": .string(current.id), "openclawAgentId": .string(slug), "workspacePath": .string(workspacePath.path)])
        return updated
    }

    public func nativeCronJobs(for agent: AgentWithBinding) async throws -> [String: Any] {
        switch agent.binding.runtimeType {
        case .openclaw:
            let current = try data.getAgent(agent.id)
            let harnessPath = try harnessPath(for: current.harness)
            let node = resolveOpenClawNodePath()
            let slug = current.binding.externalAgentId ?? openClawSlug(for: current)
            let result = await runner.run(
                node.path,
                ["openclaw.mjs", "cron", "list", "--agent", slug, "--json"],
                options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: node), timeoutMs: 60_000, executableAuthorization: .exact(node))
            )
            guard result.code == 0,
                  let data = result.stdout.data(using: .utf8),
                  let root = try JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                throw RelayError(.internalError, trimForStorage(result.diagnosticTail))
            }
            var jobs = root["jobs"] as? [[String: Any]] ?? []
            let crontab = await runner.run(
                "/usr/bin/crontab",
                ["-l"],
                options: CommandOptions(timeoutMs: 15_000)
            )
            if crontab.code == 0 {
                let workspacePath = current.binding.workspaceFolderPath ?? ""
                for (index, line) in crontab.stdout.split(separator: "\n").map(String.init).enumerated() {
                    let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !trimmed.isEmpty, !trimmed.hasPrefix("#") else { continue }
                    let parts = trimmed.split(whereSeparator: \.isWhitespace).map(String.init)
                    guard parts.count >= 6,
                          (!workspacePath.isEmpty && trimmed.contains(workspacePath) || trimmed.contains(slug))
                    else { continue }
                    jobs.append([
                        "id": "system-crontab-\(slug)-\(index)",
                        "name": "System cron \(URL(fileURLWithPath: parts.last ?? "job").lastPathComponent)",
                        "enabled": true,
                        "status": "scheduled",
                        "schedule": ["kind": "cron", "expr": parts.prefix(5).joined(separator: " ")],
                        "payload": ["kind": "command", "message": parts.dropFirst(5).joined(separator: " ")],
                        "source": "system_crontab"
                    ])
                }
            }
            return [
                "runtimeType": RuntimeType.openclaw.rawValue,
                "jobs": jobs,
                "scheduler": [
                    "available": true,
                    "running": true,
                    "message": "OpenClaw Gateway scheduler"
                ]
            ]
        case .hermes:
            let homePath = agent.binding.hermesHomePath?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !homePath.isEmpty else {
                throw RelayError(.harnessMissing, "Hermes profile home is unavailable.")
            }
            let home = URL(fileURLWithPath: homePath, isDirectory: true)
            let jobsURL = home.appendingPathComponent("cron", isDirectory: true).appendingPathComponent("jobs.json")
            let jobs: [[String: Any]]
            if FileManager.default.fileExists(atPath: jobsURL.path) {
                let root = try JSONSerialization.jsonObject(with: Data(contentsOf: jobsURL))
                if let object = root as? [String: Any] {
                    jobs = object["jobs"] as? [[String: Any]] ?? []
                } else {
                    jobs = root as? [[String: Any]] ?? []
                }
            } else {
                jobs = []
            }
            let status = hermesCronScheduler.status(forHermesHome: home)
            return [
                "runtimeType": RuntimeType.hermes.rawValue,
                "jobs": jobs,
                "scheduler": [
                    "available": status.installed,
                    "running": status.running,
                    "message": status.message
                ]
            ]
        default:
            throw RelayError(.invalidInput, "Native cron management supports OpenClaw and Hermes agents.")
        }
    }

    func ensureHermesGatewaySession(
        client: HermesGatewayClient,
        runtimeSession: RuntimeSession,
        request: RuntimeDispatchRequest,
        workspaceRoot: URL,
        profileSlug: String,
        marketplaceMount: MarketplaceRuntimeCapabilitySnapshot
    ) async throws -> HermesGatewaySession {
        let storedSessionId = runtimeSession.externalSessionId?.trimmingCharacters(in: .whitespacesAndNewlines)
        if let storedSessionId, !storedSessionId.isEmpty {
            do {
                let resumed = try await client.resumeSession(storedSessionId: storedSessionId)
                if resumed.storedSessionId != runtimeSession.externalSessionId {
                    _ = try data.updateRuntimeSessionExternalSessionId(
                        runtimeSession.id,
                        externalSessionId: resumed.storedSessionId,
                        metadata: hermesRuntimeSessionMetadata(profileSlug: profileSlug, liveSessionId: resumed.liveSessionId, marketplaceMount: marketplaceMount)
                    )
                }
                return resumed
            } catch let error as HermesGatewayError {
                if case .rpcError(let code, _) = error, code == 4007 {
                    let created = try await createHermesGatewaySession(
                        client: client,
                        runtimeSession: runtimeSession,
                        request: request,
                        workspaceRoot: workspaceRoot,
                        profileSlug: profileSlug,
                        marketplaceMount: marketplaceMount
                    )
                    return created
                }
                throw error
            }
        }
        return try await createHermesGatewaySession(
            client: client,
            runtimeSession: runtimeSession,
            request: request,
            workspaceRoot: workspaceRoot,
            profileSlug: profileSlug,
            marketplaceMount: marketplaceMount
        )
    }

    private func createHermesGatewaySession(
        client: HermesGatewayClient,
        runtimeSession: RuntimeSession,
        request: RuntimeDispatchRequest,
        workspaceRoot: URL,
        profileSlug: String,
        marketplaceMount: MarketplaceRuntimeCapabilitySnapshot
    ) async throws -> HermesGatewaySession {
        let threadTitle = (try? data.getThread(request.threadId).title.trimmingCharacters(in: .whitespacesAndNewlines))
        let title = threadTitle?.isEmpty == false ? threadTitle! : "Relay \(request.threadId)"
        let created = try await client.createSession(title: title, cwd: workspaceRoot)
        _ = try data.updateRuntimeSessionExternalSessionId(
            runtimeSession.id,
            externalSessionId: created.storedSessionId,
            metadata: hermesRuntimeSessionMetadata(profileSlug: profileSlug, liveSessionId: created.liveSessionId, marketplaceMount: marketplaceMount)
        )
        return created
    }

    private func hermesRuntimeSessionMetadata(profileSlug: String, liveSessionId: String) -> JSONRecord {
        hermesRuntimeSessionMetadata(profileSlug: profileSlug, liveSessionId: liveSessionId, marketplaceMount: nil)
    }

    private func hermesRuntimeSessionMetadata(
        profileSlug: String,
        liveSessionId: String?,
        marketplaceMount: MarketplaceRuntimeCapabilitySnapshot?
    ) -> JSONRecord {
        var metadata: JSONRecord = [
            "harness": .string("hermes"),
            "hermesProfileSlug": .string(profileSlug),
            "updatedAt": .string(nowIso())
        ]
        if let liveSessionId {
            metadata["lastHermesLiveSessionId"] = .string(liveSessionId)
        }
        if let marketplaceMount {
            metadata.merge(MarketplaceRuntimeMountService.metadata(for: marketplaceMount)) { _, new in new }
        }
        return metadata
    }

    private func runtimeMountContext(
        for agent: AgentWithBinding,
        request: RuntimeDispatchRequest
    ) -> ServiceRequestContext {
        ServiceRequestContext(
            actorId: "relay-runtime",
            workspaceId: agent.workspaceId,
            roles: [.member],
            correlationId: request.correlationId
        )
    }

    private func compileMarketplaceRuntimeMount(
        for agent: AgentWithBinding,
        request: RuntimeDispatchRequest
    ) async throws -> MarketplaceRuntimeCapabilitySnapshot {
        var railwayTools = request.cloudMarketplaceTools
        if railwayTools.isEmpty, let cloudMarketplaceRuntimeToolProxy {
            do {
                railwayTools = try await cloudMarketplaceRuntimeToolProxy.prepareLocalDispatch(
                    localDispatchId: request.dispatchId,
                    workspaceId: agent.workspaceId,
                    localAgentId: agent.id
                )
            } catch {
                _ = try? data.log(
                    severity: "warning",
                    category: "marketplace",
                    message: "Railway Marketplace runtime context could not be loaded for local dispatch \(request.dispatchId): \(redactedTechnicalError(error))"
                )
            }
        }
        return try marketplaceRuntimeMounts.snapshot(
            context: runtimeMountContext(for: agent, request: request),
            agent: agent
        ).mergingCloudMarketplaceTools(railwayTools)
    }

    private func marketplaceMountFingerprint(in metadata: JSONRecord) -> String? {
        guard case .object(let mount)? = metadata["marketplaceRuntimeMount"] else {
            return nil
        }
        return stringValue(mount["fingerprint"])
    }

    private func runtimeSessionNeedsMarketplaceRefresh(
        _ runtimeSession: RuntimeSession,
        mount: MarketplaceRuntimeCapabilitySnapshot
    ) -> Bool {
        marketplaceMountFingerprint(in: runtimeSession.metadata) != mount.fingerprint
            || marketplaceMountBridgeVersion(in: runtimeSession.metadata) != MarketplaceRuntimeMountService.runtimeToolBridgeVersion
    }

    private func marketplaceMountBridgeVersion(in metadata: JSONRecord) -> String? {
        guard case .object(let mount)? = metadata["marketplaceRuntimeMount"] else {
            return nil
        }
        return stringValue(mount["runtimeToolBridgeVersion"])
    }

    private func shortMarketplaceMountFingerprint(_ mount: MarketplaceRuntimeCapabilitySnapshot) -> String {
        let raw = mount.fingerprint.replacingOccurrences(of: "sha256:", with: "")
        return String(raw.prefix(16))
    }

    private func openClawSessionKey(
        slug: String,
        threadId: RelayId,
        mount: MarketplaceRuntimeCapabilitySnapshot
    ) -> String {
        let suffix = "-mkt-\(shortMarketplaceMountFingerprint(mount))"
        let thread = sanitizeOpenClawSessionKey(threadId)
        let maxThreadLength = max(1, 120 - suffix.count)
        return "agent:\(slug):relay:\(String(thread.prefix(maxThreadLength)))\(suffix)"
    }

    private func emitHermesSessionUsage(
        client: HermesGatewayClient,
        liveSessionId: String,
        request: RuntimeDispatchRequest,
        sink: RuntimeEventSink
    ) async {
        let usage: JSONRecord
        do {
            usage = try await client.sessionUsage(sessionId: liveSessionId)
        } catch {
            return
        }
        guard let context = RuntimeContextUsageMapper.hermesContextUsage(
            from: usage,
            dispatchId: request.dispatchId,
            source: "hermes_gateway_session_usage"
        ) else { return }
        await sink.emit(bridgeEvent(request, .context, status: "Hermes context usage loaded", detail: context))
    }

    public func dispatchHermes(_ request: RuntimeDispatchRequest, sink: RuntimeEventSink) async -> RuntimeDispatchTerminalResult {
        var activeBackup: (
            profileHome: URL,
            workspaceHome: URL,
            profileSlug: String,
            agentId: String,
            runtimeVersion: String?
        )?
        var completedForBackup = false
        defer {
            cloudMarketplaceRuntimeToolProxy?.unregister(localDispatchId: request.dispatchId)
            if let activeBackup {
                hermesProfileBackups.endActiveProfile(
                    profileHome: activeBackup.profileHome,
                    profileSlug: activeBackup.profileSlug,
                    agentId: activeBackup.agentId,
                    runtimeVersion: activeBackup.runtimeVersion,
                    completed: completedForBackup,
                    workspaceHome: activeBackup.workspaceHome
                )
            }
        }
        do {
            let profiled = try await ensureHermesAgentProfile(try data.getAgent(request.agent.id))
            guard let profileSlug = profiled.binding.hermesProfileSlug,
                  let hermesHome = profiled.binding.hermesHomePath
            else {
                return failedResult("harness_missing", "Hermes agent profile is missing.")
            }
            let harnessPath = try harnessPath(for: request.harness)
            guard let python = resolveHermesPython(harnessPath) else {
                return failedResult("harness_missing", "Hermes Agent Python environment is not installed.")
            }
            let workspaceRoot = URL(fileURLWithPath: profiled.binding.workspaceFolderPath ?? paths.workspacesDir.appendingPathComponent(profileSlug, isDirectory: true).path)
            if profiled.binding.workspaceFolderPath == nil {
                try FileManager.default.createDirectory(at: workspaceRoot, withIntermediateDirectories: true)
            }
            let profileHome = URL(fileURLWithPath: hermesHome, isDirectory: true)
            activeBackup = (
                profileHome: profileHome,
                workspaceHome: workspaceRoot,
                profileSlug: profileSlug,
                agentId: profiled.id,
                runtimeVersion: stringValue(profiled.harness.config["installedVersion"])
            )
            hermesProfileBackups.beginActiveProfile(
                profileHome: profileHome,
                profileSlug: profileSlug,
                agentId: profiled.id,
                runtimeVersion: activeBackup?.runtimeVersion,
                workspaceHome: workspaceRoot
            )
            var env = hermesEnv(harnessPath: harnessPath, hermesHome: URL(fileURLWithPath: hermesHome))
            env["HERMES_TUI_PASS_SESSION_ID"] = "1"
            env["RELAY_CONSOLE_ARTIFACT_ROOT"] = paths.artifactsDir.path
            if let artifactContract = request.artifactContract {
                env["RELAY_CONSOLE_ARTIFACT_DIR"] = artifactContract.runDirectoryPath
                env["RELAY_CONSOLE_CRON_ARTIFACT_ROOT"] = artifactContract.cronDirectoryRootPath
            }
            let marketplaceMount = try await compileMarketplaceRuntimeMount(for: profiled, request: request)
            let bridgeInstall = try prepareMarketplaceRuntimeToolBridge(
                for: profiled,
                request: request,
                harnessPath: harnessPath,
                mount: marketplaceMount
            )
            let confirmedMarketplaceMount = marketplaceMount.confirmedRegisteredToolSnapshot(
                registeredToolNames: bridgeInstall.registeredToolNames
            )
            env.merge(bridgeInstall.env) { _, new in new }
            var runtimeSession = try data.getRuntimeSession(request.sessionId)
            if runtimeSessionNeedsMarketplaceRefresh(runtimeSession, mount: confirmedMarketplaceMount) {
                runtimeSession = try data.updateRuntimeSessionExternalSessionId(
                    runtimeSession.id,
                    externalSessionId: nil,
                    metadata: hermesRuntimeSessionMetadata(
                        profileSlug: profileSlug,
                        liveSessionId: nil,
                        marketplaceMount: confirmedMarketplaceMount
                    )
                )
                restartHermesGatewayForProfile(homePath: hermesHome)
            }
            let client = hermesGatewayClient(
                pythonPath: python.path,
                harnessPath: harnessPath,
                hermesHome: URL(fileURLWithPath: hermesHome),
                env: marketplaceRuntimeSanitizedEnvironment(env)
            )
            await sink.emit(bridgeEvent(request, .queued, status: "Queued for Hermes Agent", detail: [
                "hermesProfileSlug": .string(profileSlug),
                "workspacePath": .string(workspaceRoot.path),
                "marketplaceAppCount": .number(Double(confirmedMarketplaceMount.apps.count)),
                "marketplaceToolCount": .number(Double(confirmedMarketplaceMount.toolCount)),
                "marketplaceMountFingerprint": .string(confirmedMarketplaceMount.fingerprint)
            ]))

            let gatewaySession = try await ensureHermesGatewaySession(
                client: client,
                runtimeSession: runtimeSession,
                request: request,
                workspaceRoot: workspaceRoot,
                profileSlug: profileSlug,
                marketplaceMount: confirmedMarketplaceMount
            )
            _ = try data.updateRuntimeSessionExternalSessionId(
                runtimeSession.id,
                externalSessionId: gatewaySession.storedSessionId,
                metadata: hermesRuntimeSessionMetadata(
                    profileSlug: profileSlug,
                    liveSessionId: gatewaySession.liveSessionId,
                    marketplaceMount: confirmedMarketplaceMount
                )
            )
            try await client.setSessionYolo(
                sessionId: gatewaySession.liveSessionId,
                enabled: request.approvalMode == .fullAccess
            )
            registerHermesDispatch(client: client, liveSessionId: gatewaySession.liveSessionId, dispatchId: request.dispatchId)
            defer { clearHermesDispatch(request.dispatchId) }

            await sink.emit(bridgeEvent(request, .started, status: "Hermes Agent running", detail: [
                "hermesProfileSlug": .string(profileSlug),
                "hermesSessionId": .string(gatewaySession.storedSessionId),
                "hermesLiveSessionId": .string(gatewaySession.liveSessionId),
                "workspacePath": .string(workspaceRoot.path),
                "marketplaceAppCount": .number(Double(confirmedMarketplaceMount.apps.count)),
                "marketplaceToolCount": .number(Double(confirmedMarketplaceMount.toolCount)),
                "marketplaceMountFingerprint": .string(confirmedMarketplaceMount.fingerprint)
            ]))
            await emitHermesSessionUsage(
                client: client,
                liveSessionId: gatewaySession.liveSessionId,
                request: request,
                sink: sink
            )
            let turn = try await client.submitPrompt(
                sessionId: gatewaySession.liveSessionId,
                text: marketplaceRuntimeMounts.mountPrompt(
                    artifactContractPrompt(request.inputContent, contract: request.artifactContract),
                    snapshot: confirmedMarketplaceMount
                ),
                imagePaths: request.attachmentPaths,
                request: request,
                sink: sink,
                timeoutMs: request.timeoutMs + 60_000
            )
            if turn.status == "completed" {
                completedForBackup = true
                var metadata: JSONRecord = turn.metadata
                metadata.merge([
                    "harness": .string("hermes"),
                    "hermesProfileSlug": .string(profileSlug),
                    "hermesSessionId": .string(gatewaySession.storedSessionId),
                    "hermesLiveSessionId": .string(gatewaySession.liveSessionId),
                    "marketplaceMountFingerprint": .string(confirmedMarketplaceMount.fingerprint),
                    "marketplaceAppCount": .number(Double(confirmedMarketplaceMount.apps.count)),
                    "marketplaceToolCount": .number(Double(confirmedMarketplaceMount.toolCount))
                ].merging(MarketplaceRuntimeMountService.metadata(for: confirmedMarketplaceMount)) { _, new in new }) { _, new in new }
                return RuntimeDispatchTerminalResult(
                    status: "completed",
                    finalText: turn.text,
                    contentFormat: .markdown,
                    error: nil,
                    metadata: metadata
                )
            }
            let normalized = normalizeHermesRuntimeFailure(turn.text)
            if normalized.category == "auth_required" {
                await markHermesAuthRequiredIfRootUnavailable(
                    harness: request.harness,
                    harnessPath: harnessPath,
                    message: normalized.message
                )
            }
            return failedResult(normalized.category, normalized.message, detail: turn.metadata)
        } catch {
            if let gatewayError = error as? HermesGatewayError,
               case .rpcError(let code, let message) = gatewayError,
               code == 4009 {
                return failedResult(
                    "session_busy",
                    trimForStorage(CommandOutputRedactor.redact(message))
                )
            }
            let normalized = normalizeHermesRuntimeFailure(redactedTechnicalError(error))
            if normalized.category == "auth_required" {
                if let harnessPath = try? harnessPath(for: request.harness) {
                    await markHermesAuthRequiredIfRootUnavailable(
                        harness: request.harness,
                        harnessPath: harnessPath,
                        message: normalized.message
                    )
                }
            }
            return failedResult(normalized.category == "unknown" ? "transport_error" : normalized.category, normalized.message)
        }
    }

    public func dispatchOpenClaw(_ request: RuntimeDispatchRequest, sink: RuntimeEventSink) async -> RuntimeDispatchTerminalResult {
        defer {
            cloudMarketplaceRuntimeToolProxy?.unregister(localDispatchId: request.dispatchId)
        }
        do {
            let agent = try await ensureOpenClawAgentProvisioned(try data.getAgent(request.agent.id))
            let harnessPath = try harnessPath(for: agent.harness)
            let node = resolveOpenClawNodePath()
            let slug = agent.binding.externalAgentId ?? openClawSlug(for: agent)
            let workspacePath = URL(fileURLWithPath: agent.binding.workspaceFolderPath ?? defaultOpenClawWorkspacePath(for: slug).path)
            let marketplaceMount = try await compileMarketplaceRuntimeMount(for: agent, request: request)
            let bridgeInstall = try prepareMarketplaceRuntimeToolBridge(
                for: agent,
                request: request,
                harnessPath: harnessPath,
                mount: marketplaceMount
            )
            if bridgeInstall.requiresHarnessRefresh {
                await restartOpenClawGateway()
            }
            let confirmedMarketplaceMount = marketplaceMount.confirmedRegisteredToolSnapshot(
                registeredToolNames: bridgeInstall.registeredToolNames
            )
            let sessionKey = openClawSessionKey(slug: slug, threadId: request.threadId, mount: confirmedMarketplaceMount)
            let sessionMetadata: JSONRecord = [
                "harness": .string("openclaw"),
                "openclawAgentId": .string(slug),
                "sessionKey": .string(sessionKey),
                "updatedAt": .string(nowIso())
            ].merging(MarketplaceRuntimeMountService.metadata(for: confirmedMarketplaceMount)) { _, new in new }
            _ = try data.updateRuntimeSessionExternalSessionId(
                request.sessionId,
                externalSessionId: sessionKey,
                metadata: sessionMetadata
            )
            let body = marketplaceRuntimeMounts.mountPrompt(
                artifactContractPrompt(buildOpenClawDispatchBody(request), contract: request.artifactContract),
                snapshot: confirmedMarketplaceMount
            )
            var args = ["openclaw.mjs", "agent", "--agent", slug, "--session-key", sessionKey, "--message", body, "--json", "--timeout", String(max(30, request.timeoutMs / 1000))]
            let model = try HarnessModelSelectionService.resolve(agent.model ?? stringValue(agent.binding.config["model"]) ?? stringValue(request.harness.config["model"]), for: .openclaw)
            args += ["--model", model.selected]
            if model.fallbackApplied {
                var config = agent.binding.config
                config["model"] = .string(model.selected)
                config["modelFallbackApplied"] = .bool(true)
                _ = try? data.updateAgent(agentId: agent.id, model: model.selected, config: config)
            }
            var runtimeEnv = openClawEnv()
            runtimeEnv.merge(bridgeInstall.env) { _, new in new }
            runtimeEnv["RELAY_CONSOLE_ARTIFACT_ROOT"] = paths.artifactsDir.path
            if let artifactContract = request.artifactContract {
                runtimeEnv["RELAY_CONSOLE_ARTIFACT_DIR"] = artifactContract.runDirectoryPath
                runtimeEnv["RELAY_CONSOLE_CRON_ARTIFACT_ROOT"] = artifactContract.cronDirectoryRootPath
            }
            runtimeEnv = marketplaceRuntimeSanitizedEnvironment(runtimeEnv)
            await sink.emit(bridgeEvent(request, .queued, status: "Queued for OpenClaw", detail: [
                "openclawAgentId": .string(slug),
                "marketplaceAppCount": .number(Double(confirmedMarketplaceMount.apps.count)),
                "marketplaceToolCount": .number(Double(confirmedMarketplaceMount.toolCount)),
                "marketplaceMountFingerprint": .string(confirmedMarketplaceMount.fingerprint)
            ]))
            await sink.emit(bridgeEvent(request, .started, status: "OpenClaw agent running", detail: [
                "openclawAgentId": .string(slug),
                "workspacePath": .string(workspacePath.path),
                "marketplaceAppCount": .number(Double(confirmedMarketplaceMount.apps.count)),
                "marketplaceToolCount": .number(Double(confirmedMarketplaceMount.toolCount)),
                "marketplaceMountFingerprint": .string(confirmedMarketplaceMount.fingerprint)
            ]))
            var result = await runner.run(node.path, args, options: CommandOptions(cwd: harnessPath, env: runtimeEnv, timeoutMs: request.timeoutMs + 60_000, executableAuthorization: .exact(node)))
            if result.code != 0,
               isOpenClawAgentDatabaseOwnerMismatch(result.diagnosticTail),
               (try? repairOpenClawAgentDatabaseIfNeeded(slug: slug)) == true {
                result = await runner.run(node.path, args, options: CommandOptions(cwd: harnessPath, env: runtimeEnv, timeoutMs: request.timeoutMs + 60_000, executableAuthorization: .exact(node)))
            }
            if result.code != 0 {
                let normalized = normalizeOpenClawRuntimeFailure(result.diagnosticTail)
                if normalized.category == "auth_required" {
                    markAuthRequired(harness: request.harness, message: normalized.message)
                }
                await sink.emit(bridgeEvent(request, .failed, status: normalized.message, detail: ["category": .string(normalized.category)]))
                return failedResult(normalized.category, normalized.message)
            }
            let parsed = parseJSONObject(from: result.stdout)
            let finalText = extractOpenClawFinalText(parsed) ?? trimForStorage(result.stdout)
            guard !finalText.isEmpty else {
                return failedResult("protocol_error", "OpenClaw did not return a response.")
            }
            await sink.emit(bridgeEvent(request, .completed, text: finalText, status: "OpenClaw completed", detail: [
                "openclawAgentId": .string(slug),
                "marketplaceMountFingerprint": .string(confirmedMarketplaceMount.fingerprint),
                "marketplaceToolCount": .number(Double(confirmedMarketplaceMount.toolCount))
            ]))
            var metadata = extractOpenClawResultMetadata(parsed)
            metadata.merge([
                "harness": .string("openclaw"),
                "openclawAgentId": .string(slug),
                "workspacePath": .string(workspacePath.path),
                "sessionKey": .string(sessionKey),
                "marketplaceMountFingerprint": .string(confirmedMarketplaceMount.fingerprint),
                "marketplaceAppCount": .number(Double(confirmedMarketplaceMount.apps.count)),
                "marketplaceToolCount": .number(Double(confirmedMarketplaceMount.toolCount))
            ].merging(MarketplaceRuntimeMountService.metadata(for: confirmedMarketplaceMount)) { _, new in new }) { _, new in new }
            return RuntimeDispatchTerminalResult(status: "completed", finalText: finalText, contentFormat: .markdown, error: nil, metadata: metadata)
        } catch {
            return failedResult("transport_error", redactedTechnicalError(error))
        }
    }

    public func cancelHermes(dispatchId: String) async -> Bool {
        let dispatch = takeHermesDispatch(dispatchId)
        guard let dispatch else { return false }
        return await dispatch.client.interrupt(sessionId: dispatch.liveSessionId)
    }

    public func resolveHermesApproval(
        dispatchId: String,
        decision: RuntimeApprovalDecision
    ) async -> Bool {
        let dispatch = hermesDispatch(dispatchId)
        guard let dispatch else { return false }
        do {
            try await dispatch.client.respondToApproval(
                sessionId: dispatch.liveSessionId,
                decision: decision
            )
            return true
        } catch {
            return false
        }
    }
}
