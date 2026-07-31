import Foundation

extension HarnessInstallManager {
    func getRecord(_ harnessKey: HarnessKey) throws -> HarnessInstallRecord {
        let entry = catalogEntry(harnessKey)
        guard let harness = try data.getHarnessByRuntimeType(entry.runtimeType) else {
            return defaultRecord(entry)
        }
        let record = storedToRecord(entry: entry, harness: harness)
        activateSecurityScopedRuntimeLocation(harnessKey: harnessKey, config: harness.config)
        return record
    }

    func activateSecurityScopedRuntimeLocation(harnessKey: HarnessKey, config: JSONRecord) {
        guard let encoded = stringValue(config["securityScopedBookmark"]),
              let bookmark = Data(base64Encoded: encoded)
        else { return }
        var stale = false
        guard let url = try? URL(
            resolvingBookmarkData: bookmark,
            options: [.withSecurityScope],
            relativeTo: nil,
            bookmarkDataIsStale: &stale
        ), !stale else { return }

        lock.lock()
        if securityScopedRuntimeURLs[harnessKey]?.path == url.path {
            lock.unlock()
            return
        }
        let previous = securityScopedRuntimeURLs.removeValue(forKey: harnessKey)
        let accessed = url.startAccessingSecurityScopedResource()
        if accessed { securityScopedRuntimeURLs[harnessKey] = url }
        lock.unlock()
        previous?.stopAccessingSecurityScopedResource()
    }

    func saveRecord(entry: HarnessCatalogEntry, update: JSONRecord) throws -> HarnessInstallRecord {
        let currentHarness = try data.getHarnessByRuntimeType(entry.runtimeType)
        var config = repairManagedHarnessConfig(entry: entry, config: currentHarness?.config ?? [:])
        config["kind"] = .string("external_harness_install")
        config["harnessKey"] = .string(entry.harnessKey.rawValue)
        config["officialRepoSlug"] = .string(entry.officialRepoSlug)
        config["repoUrl"] = .string(entry.repoUrl)
        for (key, value) in update {
            config[key] = value
        }
        let source = HarnessInstallSource(rawValue: stringValue(config["source"]) ?? "") ?? .missing
        if entry.harnessKey == .openclaw, source != .located {
            config["openClawHome"] = .string(openClawManagedHome().path)
            config["openClawStateDir"] = .string(openClawStateDir().path)
            config["openClawConfigPath"] = .string(openClawConfigPath().path)
            config["openClawNodePath"] = .string(resolveOpenClawNodePath().path)
            config["openClawInstallLogPath"] = .string(openClawInstallLogPath().path)
        }
        let mode: HarnessMode = source == .managed ? .appManaged : .userManaged
        let harness = try data.upsertHarness(runtimeType: entry.runtimeType, displayName: entry.displayName, mode: mode, config: config)
        return storedToRecord(entry: entry, harness: harness)
    }

    func recordToConfig(_ record: HarnessInstallRecord) -> JSONRecord {
        var config: JSONRecord = [
            "kind": .string("external_harness_install"),
            "harnessKey": .string(record.harnessKey.rawValue),
            "source": .string(record.source.rawValue),
            "lifecycleState": .string(record.lifecycleState.rawValue),
            "dependencyStatus": .string(record.dependencyStatus),
            "modelAuthStatus": .string(record.modelAuthStatus.rawValue),
            "officialRepoSlug": .string(record.officialRepoSlug),
            "repoUrl": .string(record.repoUrl)
        ]
        config["installPath"] = record.installPath.map(JSONValue.string) ?? .null
        config["selectedLocalPath"] = record.selectedLocalPath.map(JSONValue.string) ?? .null
        config["installedCommit"] = record.installedCommit.map(JSONValue.string) ?? .null
        config["installedVersion"] = record.installedVersion.map(JSONValue.string) ?? .null
        config["modelAuthProvider"] = record.modelAuthProvider.map(JSONValue.string) ?? .null
        config["modelAuthCommand"] = record.modelAuthCommand?.jsonValue ?? .null
        config["modelAuthSession"] = record.modelAuthSession.map(encodeSession) ?? .null
        config["modelAuthLastError"] = record.modelAuthLastError.map(JSONValue.string) ?? .null
        config["modelAuthCheckedAt"] = record.modelAuthCheckedAt.map(JSONValue.string) ?? .null
        config["runtimeCommand"] = record.runtimeCommand?.jsonValue ?? .null
        config["healthCheckCommand"] = record.healthCheckCommand?.jsonValue ?? .null
        config["lastError"] = record.lastError.map(JSONValue.string) ?? .null
        config["lastTechnicalError"] = record.lastTechnicalError.map(JSONValue.string) ?? .null
        config["lastCheckedAt"] = record.lastCheckedAt.map(JSONValue.string) ?? .null
        config["setupNotes"] = .array(record.setupNotes.map(JSONValue.string))
        return config
    }

    func storedToRecord(entry: HarnessCatalogEntry, harness: Harness) -> HarnessInstallRecord {
        let config = repairManagedHarnessConfig(entry: entry, config: harness.config)
        let installPath = stringValue(config["installPath"])
        let target = try? HarnessCompatibilityManifest.loadCurrent().pin(for: entry.harnessKey)
        let installedCommit = stringValue(config["installedCommit"])
        let rollbackRoot = stringValue(config["rollbackBackupRoot"])
        let rollbackSourceExists = rollbackRoot.map {
            FileManager.default.fileExists(atPath: URL(fileURLWithPath: $0, isDirectory: true).appendingPathComponent("source", isDirectory: true).path)
        } ?? false
        return HarnessInstallRecord(
            harnessKey: entry.harnessKey,
            runtimeType: entry.runtimeType,
            displayName: entry.displayName,
            officialRepoSlug: entry.officialRepoSlug,
            repoUrl: entry.repoUrl,
            source: HarnessInstallSource(rawValue: stringValue(config["source"]) ?? "") ?? (installPath == nil ? .missing : .managed),
            lifecycleState: HarnessLifecycleState(rawValue: stringValue(config["lifecycleState"]) ?? "") ?? (installPath == nil ? .notInstalled : .installed),
            installPath: installPath,
            selectedLocalPath: stringValue(config["selectedLocalPath"]),
            installedCommit: installedCommit,
            installedVersion: stringValue(config["installedVersion"]),
            targetVersion: target?.version,
            targetCommit: target?.commit,
            updateAvailable: installPath != nil && target.map { installedCommit != $0.commit } == true,
            rollbackVersion: stringValue(config["rollbackPreviousVersion"]),
            rollbackAvailable: rollbackSourceExists,
            dependencyStatus: stringValue(config["dependencyStatus"]) ?? (installPath == nil ? "missing" : "installed"),
            modelAuthStatus: HarnessModelAuthStatus(rawValue: stringValue(config["modelAuthStatus"]) ?? "") ?? .unknown,
            modelAuthProvider: stringValue(config["modelAuthProvider"]),
            modelAuthCommand: commandSpecValue(config["modelAuthCommand"]),
            modelAuthSession: sessionValue(config["modelAuthSession"]),
            modelAuthLastError: stringValue(config["modelAuthLastError"]),
            modelAuthCheckedAt: stringValue(config["modelAuthCheckedAt"]),
            runtimeCommand: commandSpecValue(config["runtimeCommand"]),
            healthCheckCommand: commandSpecValue(config["healthCheckCommand"]),
            health: nil,
            lastError: stringValue(config["lastError"]),
            lastTechnicalError: stringValue(config["lastTechnicalError"]),
            lastCheckedAt: stringValue(config["lastCheckedAt"]),
            setupNotes: arrayStrings(config["setupNotes"]).isEmpty ? entry.setupNotes : arrayStrings(config["setupNotes"]),
            harnessId: harness.id,
            openClawHome: stringValue(config["openClawHome"]),
            openClawStateDir: stringValue(config["openClawStateDir"]),
            openClawConfigPath: stringValue(config["openClawConfigPath"]),
            openClawNodePath: stringValue(config["openClawNodePath"]),
            openClawPnpmPath: stringValue(config["openClawPnpmPath"]),
            openClawInstallLogPath: stringValue(config["openClawInstallLogPath"])
        )
    }

    func defaultRecord(_ entry: HarnessCatalogEntry) -> HarnessInstallRecord {
        HarnessInstallRecord(
            harnessKey: entry.harnessKey,
            runtimeType: entry.runtimeType,
            displayName: entry.displayName,
            officialRepoSlug: entry.officialRepoSlug,
            repoUrl: entry.repoUrl,
            source: .missing,
            lifecycleState: .notInstalled,
            installPath: nil,
            selectedLocalPath: nil,
            installedCommit: nil,
            installedVersion: nil,
            targetVersion: (try? HarnessCompatibilityManifest.loadCurrent().pin(for: entry.harnessKey))?.version,
            targetCommit: (try? HarnessCompatibilityManifest.loadCurrent().pin(for: entry.harnessKey))?.commit,
            updateAvailable: false,
            rollbackVersion: nil,
            rollbackAvailable: false,
            dependencyStatus: "missing",
            modelAuthStatus: .unknown,
            modelAuthProvider: "openai_chatgpt",
            modelAuthCommand: nil,
            modelAuthSession: nil,
            modelAuthLastError: nil,
            modelAuthCheckedAt: nil,
            runtimeCommand: nil,
            healthCheckCommand: nil,
            health: nil,
            lastError: nil,
            lastTechnicalError: nil,
            lastCheckedAt: nil,
            setupNotes: entry.setupNotes,
            harnessId: nil
        )
    }

    func repairManagedHarnessConfig(entry: HarnessCatalogEntry, config: JSONRecord) -> JSONRecord {
        var repaired = config
        if let installPath = stringValue(repaired["installPath"]),
           isRedactedStoredPath(installPath) {
            repaired["installPath"] = .string(paths.harnessesDir.appendingPathComponent(entry.managedDirName, isDirectory: true).path)
        }
        if entry.harnessKey == .hermes,
           let hermesHome = stringValue(repaired["hermesHome"]),
           isRedactedStoredPath(hermesHome) {
            repaired["hermesHome"] = .string(paths.hermesHomeDir.path)
        }
        guard let installPath = stringValue(repaired["installPath"]) else {
            return repaired
        }
        let harnessPath = URL(fileURLWithPath: installPath)
        if commandSpecValue(repaired["modelAuthCommand"]) == nil, isRedactedCommandSpec(repaired["modelAuthCommand"]) {
            repaired["modelAuthCommand"] = .object(modelAuthCommand(harnessKey: entry.harnessKey, harnessPath: harnessPath).json)
        }
        if commandSpecValue(repaired["runtimeCommand"]) == nil, isRedactedCommandSpec(repaired["runtimeCommand"]) {
            repaired["runtimeCommand"] = runtimeCommand(harnessKey: entry.harnessKey, harnessPath: harnessPath)?.jsonValue ?? .null
        }
        if commandSpecValue(repaired["healthCheckCommand"]) == nil, isRedactedCommandSpec(repaired["healthCheckCommand"]) {
            repaired["healthCheckCommand"] = healthCommand(harnessKey: entry.harnessKey, harnessPath: harnessPath)?.jsonValue ?? .null
        }
        return repaired
    }

    func isRedactedStoredPath(_ value: String) -> Bool {
        value.hasPrefix("[REDACTED]")
    }

    func isRedactedCommandSpec(_ value: JSONValue?) -> Bool {
        guard let value else { return false }
        if case .string(let string) = value {
            return string == "[REDACTED]"
        }
        return false
    }

    func installHermes(entry: HarnessCatalogEntry, installPath: URL) async throws {
        let pin = try HarnessCompatibilityManifest.loadCurrent().pin(for: .hermes)
        try await ensureCommandAvailable("/usr/bin/git", message: "Git is required to install Hermes Agent.")
        let uv = try await ensureUvForHermesInstall()
        try FileManager.default.createDirectory(at: paths.harnessesDir, withIntermediateDirectories: true)
        if FileManager.default.fileExists(atPath: installPath.path), !FileManager.default.fileExists(atPath: installPath.appendingPathComponent("run_agent.py").path) {
            try assertManagedInstallLocation(installPath, entry: entry)
            try FileManager.default.removeItem(at: installPath)
        }
        if !FileManager.default.fileExists(atPath: installPath.path) {
            let clone = await runner.run("/usr/bin/git", ["clone", "--depth", "1", "--branch", pin.version, "--single-branch", pin.repositoryURL, installPath.path], options: CommandOptions(timeoutMs: 300_000))
            try requireSuccess(clone, fallback: "Hermes Agent clone failed.")
        }
        try assertHarnessFolder(entry: entry, installPath)
        guard try await readGitCommit(cwd: installPath) == pin.commit else {
            throw RelayError(.internalError, "Hermes Agent source does not match Relay Console's tested commit.")
        }
        let python = hermesPythonPath(installPath)
        try requireSuccess(await runner.run(uv.path, ["sync", "--locked", "--all-extras", "--python", "3.11"], options: CommandOptions(cwd: installPath, timeoutMs: 600_000, executableAuthorization: .exact(uv))), fallback: "Hermes locked dependencies could not be installed.")
        guard FileManager.default.fileExists(atPath: python.path) else {
            throw RelayError(.internalError, "Hermes locked environment did not create its expected Python executable.")
        }
        let health = await runner.run(
            python.path,
            ["-c", "import run_agent, tui_gateway.entry; print('ok')"],
            options: CommandOptions(
                cwd: installPath,
                env: hermesEnv(harnessPath: installPath, hermesHome: paths.hermesHomeDir),
                timeoutMs: 30_000,
                executableAuthorization: .pythonVirtualEnvironment(
                    harnessRoot: installPath
                )
            )
        )
        try requireSuccess(health, fallback: "Hermes health check failed.")
    }

    func ensureUvForHermesInstall() async throws -> URL {
        let managed = paths.uvBinDir.appendingPathComponent("uv")
        if FileManager.default.fileExists(atPath: managed.path) {
            let expected = try HarnessCompatibilityManifest.loadCurrent().toolchains.uvVersion
            let check = await runner.run(managed.path, ["--version"], options: CommandOptions(timeoutMs: 20_000, executableAuthorization: .exact(managed)))
            if check.code == 0, check.stdout.trimmingCharacters(in: .whitespacesAndNewlines) == "uv \(expected)" {
                return managed
            }
        }
        return try await installManagedUv()
    }

    func installManagedUv() async throws -> URL {
        let pins = try HarnessCompatibilityManifest.loadCurrent().toolchains
        guard let platform = uvPlatformSpec(), let artifact = pins.uvArtifacts[platform] else {
            throw RelayError(.unsupported, "Relay Console has no verified uv artifact for this Mac architecture.")
        }
        try FileManager.default.createDirectory(at: paths.uvBinDir, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: paths.cacheDir, withIntermediateDirectories: true)
        let archive = paths.cacheDir.appendingPathComponent("uv-\(pins.uvVersion)-\(platform).tar.gz")
        try requireSuccess(await runner.run("/usr/bin/curl", ["-L", "--fail", "--show-error", "-o", archive.path, artifact.url], options: CommandOptions(timeoutMs: 300_000)), fallback: "Verified uv archive could not be downloaded.")
        try RelayArtifactIntegrity.verify(archive, expectedSHA256: artifact.sha256, label: "uv \(pins.uvVersion) for \(platform)")
        let extraction = paths.cacheDir.appendingPathComponent("uv-\(pins.uvVersion)-\(platform)-extract", isDirectory: true)
        try? FileManager.default.removeItem(at: extraction)
        try FileManager.default.createDirectory(at: extraction, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: extraction) }
        try requireSuccess(await runner.run("/usr/bin/tar", ["-xzf", archive.path, "-C", extraction.path, "--strip-components", "1"], options: CommandOptions(timeoutMs: 120_000)), fallback: "Verified uv archive could not be extracted.")
        let extractedUv = extraction.appendingPathComponent("uv")
        let uv = paths.uvBinDir.appendingPathComponent("uv")
        guard FileManager.default.fileExists(atPath: extractedUv.path) else {
            throw RelayError(.internalError, "Verified uv archive did not contain the expected executable.")
        }
        try? FileManager.default.removeItem(at: uv)
        try FileManager.default.copyItem(at: extractedUv, to: uv)
        try FileManager.default.setAttributes([.posixPermissions: 0o755], ofItemAtPath: uv.path)
        let check = await runner.run(uv.path, ["--version"], options: CommandOptions(timeoutMs: 20_000, executableAuthorization: .exact(uv)))
        guard check.code == 0, check.stdout.trimmingCharacters(in: .whitespacesAndNewlines) == "uv \(pins.uvVersion)" else {
            try? FileManager.default.removeItem(at: uv)
            throw RelayError(.internalError, "Verified uv executable did not report the pinned version.")
        }
        return uv
    }

    func installManagedOpenClaw(installPath: URL) async throws {
        emitInstallProgress(.openclaw, stage: "preparing_toolchain", message: "Preparing OpenClaw managed toolchain.")
        try FileManager.default.createDirectory(at: paths.cacheDir, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: paths.openClawToolchainDir, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: openClawManagedHome(), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: openClawStateDir(), withIntermediateDirectories: true)
        let toolchain = try await ensureManagedOpenClawToolchain()
        emitInstallProgress(.openclaw, stage: "fetching_source", message: "Downloading OpenClaw source.")
        try await downloadOpenClawSourceArchive(installPath: installPath)
        emitInstallProgress(.openclaw, stage: "installing_dependencies", message: "Installing OpenClaw dependencies.")
        try await installOpenClawDependencies(installPath: installPath, toolchain: toolchain)
        emitInstallProgress(.openclaw, stage: "building", message: "Building OpenClaw.")
        try requireSuccess(await runOpenClawPnpm(toolchain: toolchain, args: ["build"], cwd: installPath, timeoutMs: openClawPnpmBuildTimeoutMs), fallback: "OpenClaw build failed.")
        emitInstallProgress(.openclaw, stage: "initializing_home", message: "Initializing Relay-managed OpenClaw state.")
        try requireSuccess(await runOpenClaw(harnessPath: installPath, args: ["setup", "--workspace", defaultOpenClawWorkspacePath().path], timeoutMs: 120_000, nodePath: toolchain.nodePath), fallback: "OpenClaw home initialization failed.")
        _ = try await ensureOpenClawGatewayAuthConfigured(harnessPath: installPath, nodePath: toolchain.nodePath)
        emitInstallProgress(.openclaw, stage: "verifying", message: "Verifying OpenClaw readiness.")
        try requireSuccess(await runOpenClaw(harnessPath: installPath, args: ["--version"], timeoutMs: 30_000, nodePath: toolchain.nodePath), fallback: "OpenClaw version check failed.")
        try requireSuccess(await runOpenClaw(harnessPath: installPath, args: ["agents", "list", "--json"], timeoutMs: 60_000, nodePath: toolchain.nodePath), fallback: "OpenClaw agent listing failed.")
        emitInstallProgress(.openclaw, stage: "installed", message: "OpenClaw installed.", status: "completed")
    }

    func ensureManagedOpenClawToolchain() async throws -> OpenClawToolchain {
        let node = try await ensureManagedOpenClawNode()
        let pnpm = try await ensureManagedOpenClawPnpm(nodePath: node)
        return OpenClawToolchain(nodePath: node, pnpmCommand: pnpm)
    }

    func ensureManagedOpenClawNode() async throws -> URL {
        let openClawNodeVersion = try HarnessCompatibilityManifest.loadCurrent().toolchains.openClawNodeVersion
        let node = managedOpenClawNodePath()
        if FileManager.default.fileExists(atPath: node.path) {
            let check = await runner.run(node.path, ["--version"], options: CommandOptions(env: openClawToolchainEnv(nodePath: node), timeoutMs: 20_000, executableAuthorization: .exact(node)))
            if check.code == 0, check.stdout.trimmingCharacters(in: .whitespacesAndNewlines) == "v\(openClawNodeVersion)" {
                return node
            }
        }
        guard let platform = nodePlatformSpec() else {
            throw RelayError(.unsupported, "OpenClaw managed install is not available on this platform.")
        }
        let nodeDir = managedOpenClawNodeDir()
        let archive = paths.cacheDir.appendingPathComponent("node-v\(openClawNodeVersion)-\(platform).tar.gz")
        let pins = try HarnessCompatibilityManifest.loadCurrent().toolchains
        guard let artifact = pins.nodeArtifacts[platform] else {
            throw RelayError(.unsupported, "Relay Console has no verified Node artifact for this Mac architecture.")
        }
        try requireSuccess(await runner.run("/usr/bin/curl", ["-L", "--fail", "--show-error", "-o", archive.path, artifact.url], options: CommandOptions(timeoutMs: 300_000)), fallback: "Verified Node download failed.")
        try RelayArtifactIntegrity.verify(archive, expectedSHA256: artifact.sha256, label: "Node \(openClawNodeVersion) for \(platform)")
        try? FileManager.default.removeItem(at: nodeDir)
        try FileManager.default.createDirectory(at: nodeDir, withIntermediateDirectories: true)
        try requireSuccess(await runner.run("/usr/bin/tar", ["-xzf", archive.path, "-C", nodeDir.path, "--strip-components", "1"], options: CommandOptions(timeoutMs: 300_000)), fallback: "Managed Node extraction failed.")
        guard FileManager.default.fileExists(atPath: node.path) else {
            throw RelayError(.internalError, "Relay Console could not prepare the managed OpenClaw Node runtime.")
        }
        let check = await runner.run(node.path, ["--version"], options: CommandOptions(env: openClawToolchainEnv(nodePath: node), timeoutMs: 20_000, executableAuthorization: .exact(node)))
        guard check.code == 0, check.stdout.trimmingCharacters(in: .whitespacesAndNewlines) == "v\(openClawNodeVersion)" else {
            try? FileManager.default.removeItem(at: nodeDir)
            throw RelayError(.internalError, "Verified Node executable did not report the pinned version.")
        }
        return node
    }

    func ensureManagedOpenClawPnpm(nodePath: URL) async throws -> HarnessCommandSpec {
        let openClawPnpmVersion = try HarnessCompatibilityManifest.loadCurrent().toolchains.openClawPnpmVersion
        if let existing = resolveManagedOpenClawPnpmCommand(nodePath: nodePath) {
            let check = await runner.run(
                existing.command,
                existing.args + ["--version"],
                options: CommandOptions(
                    cwd: existing.cwd.map(URL.init(fileURLWithPath:)),
                    env: openClawToolchainEnv(nodePath: nodePath),
                    timeoutMs: 20_000,
                    executableAuthorization: .exact(URL(fileURLWithPath: existing.command))
                )
            )
            if check.code == 0, check.stdout.trimmingCharacters(in: .whitespacesAndNewlines) == openClawPnpmVersion {
                return existing
            }
        }
        let corepack = managedOpenClawCorepackPath()
        let nodeBin = nodePath.deletingLastPathComponent()
        if FileManager.default.fileExists(atPath: corepack.path) {
            let enable = await runner.run(corepack.path, ["enable", "--install-directory", nodeBin.path], options: CommandOptions(env: openClawToolchainEnv(nodePath: nodePath), timeoutMs: 120_000, executableAuthorization: .exact(corepack)))
            if enable.code == 0 {
                let prepare = await runner.run(corepack.path, ["prepare", "pnpm@\(openClawPnpmVersion)", "--activate"], options: CommandOptions(env: openClawToolchainEnv(nodePath: nodePath), timeoutMs: 180_000, executableAuthorization: .exact(corepack)))
                if prepare.code == 0, let command = resolveManagedOpenClawPnpmCommand(nodePath: nodePath) {
                    let check = await runner.run(
                        command.command,
                        command.args + ["--version"],
                        options: CommandOptions(
                            cwd: command.cwd.map(URL.init(fileURLWithPath:)),
                            env: openClawToolchainEnv(nodePath: nodePath),
                            timeoutMs: 20_000,
                            executableAuthorization: .exact(URL(fileURLWithPath: command.command))
                        )
                    )
                    if check.code == 0, check.stdout.trimmingCharacters(in: .whitespacesAndNewlines) == openClawPnpmVersion { return command }
                }
            }
        }
        let npm = managedOpenClawNpmPath()
        try FileManager.default.createDirectory(at: managedOpenClawPnpmDir(), withIntermediateDirectories: true)
        let install = await runner.run(
            npm.path,
            ["install", "--prefix", managedOpenClawPnpmDir().path, "pnpm@\(openClawPnpmVersion)"],
            options: CommandOptions(
                env: openClawToolchainEnv(nodePath: nodePath),
                timeoutMs: 300_000,
                executableAuthorization: .exact(npm)
            )
        )
        try requireSuccess(install, fallback: "Managed pnpm install failed.")
        guard let fallback = resolveManagedOpenClawPnpmCommand(nodePath: nodePath) else {
            throw RelayError(.internalError, "Relay Console could not prepare the managed OpenClaw package manager.")
        }
        let fallbackCheck = await runner.run(
            fallback.command,
            fallback.args + ["--version"],
            options: CommandOptions(
                cwd: fallback.cwd.map(URL.init(fileURLWithPath:)),
                env: openClawToolchainEnv(nodePath: nodePath),
                timeoutMs: 20_000,
                executableAuthorization: .exact(URL(fileURLWithPath: fallback.command))
            )
        )
        guard fallbackCheck.code == 0, fallbackCheck.stdout.trimmingCharacters(in: .whitespacesAndNewlines) == openClawPnpmVersion else {
            throw RelayError(.internalError, "Managed pnpm did not report the pinned version.")
        }
        return fallback
    }

    func downloadOpenClawSourceArchive(installPath: URL) async throws {
        let pin = try HarnessCompatibilityManifest.loadCurrent().pin(for: .openclaw)
        try await ensureCommandAvailable("/usr/bin/git", message: "Git is required to install OpenClaw.")
        if FileManager.default.fileExists(atPath: installPath.path) {
            if !FileManager.default.fileExists(atPath: installPath.appendingPathComponent("openclaw.mjs").path) {
                try assertManagedInstallLocation(installPath, entry: catalogEntry(.openclaw))
                try FileManager.default.removeItem(at: installPath)
            }
        }
        if !FileManager.default.fileExists(atPath: installPath.path) {
            let clone = await runner.run("/usr/bin/git", ["clone", "--depth", "1", "--branch", pin.version, "--single-branch", pin.repositoryURL, installPath.path], options: CommandOptions(timeoutMs: 600_000))
            try requireSuccess(clone, fallback: "OpenClaw source clone failed.")
        }
        try assertHarnessFolder(entry: catalogEntry(.openclaw), installPath)
        guard try await readGitCommit(cwd: installPath) == pin.commit else {
            throw RelayError(.internalError, "OpenClaw source does not match Relay Console's tested commit.")
        }
    }

    func installOpenClawDependencies(installPath: URL, toolchain: OpenClawToolchain) async throws {
        var last: CommandResult?
        for attempt in 1...openClawPnpmInstallAttempts {
            let result = await runOpenClawPnpmCommand(toolchain: toolchain, args: openClawPnpmInstallArgs(), cwd: installPath, timeoutMs: openClawPnpmInstallTimeoutMs)
            if result.code == 0 { return }
            last = result
            if attempt >= openClawPnpmInstallAttempts || !isRecoverableOpenClawDependencyInstallError(result.stderr + result.stdout) {
                break
            }
            emitInstallProgress(.openclaw, stage: "installing_dependencies_retry_\(attempt + 1)", message: "OpenClaw dependency downloads slowed down. Retrying with the managed package cache (\(attempt + 1)/\(openClawPnpmInstallAttempts)).")
        }
        throw RelayError(
            .internalError,
            trimForStorage(last?.diagnosticTail ?? "OpenClaw dependency install failed.")
        )
    }
}

struct OpenClawToolchain {
    var nodePath: URL
    var pnpmCommand: HarnessCommandSpec
}

extension HarnessCommandSpec {
    var json: JSONRecord {
        var object: JSONRecord = [
            "command": .string(command),
            "args": .array(args.map(JSONValue.string))
        ]
        object["cwd"] = cwd.map(JSONValue.string) ?? .null
        return object
    }

    var jsonValue: JSONValue { .object(json) }
}
