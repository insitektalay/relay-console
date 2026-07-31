import Foundation
import Security

struct ModelAuthCheck {
    var connected: Bool
    var error: String?
}

struct NormalizedRuntimeFailure {
    var category: String
    var message: String
}

private struct OpenClawAuthProfileStoreRow {
    var key: String
    var json: String
    var updatedAt: Int64
}

private struct OpenClawAuthProfileStateRow {
    var key: String
    var json: String
    var updatedAt: Int64
}

private struct OpenClawAuthProfileSnapshot {
    var storeRows: [OpenClawAuthProfileStoreRow]
    var stateRows: [OpenClawAuthProfileStateRow]

    var isEmpty: Bool {
        storeRows.isEmpty && stateRows.isEmpty
    }
}

private let openClawPortableAuthFilenames = [
    "auth-profiles.json",
    "auth-state.json",
    "auth.json"
]

private let openClawAgentDatabaseFilenames = [
    "openclaw-agent.sqlite",
    "openclaw-agent.sqlite-wal",
    "openclaw-agent.sqlite-shm"
]

private let marketplaceProviderRuntimeSecretEnvironmentKeys: Set<String> = [
    "EXA_API_KEY",
    "X_ACCESS_TOKEN",
    "X_ACCESS_TOKEN_SECRET",
    "X_BEARER_TOKEN",
    "X_CONSUMER_KEY",
    "X_CONSUMER_SECRET",
    "TWITTER_ACCESS_TOKEN",
    "TWITTER_ACCESS_TOKEN_SECRET",
    "TWITTER_BEARER_TOKEN",
    "TWITTER_CONSUMER_KEY",
    "TWITTER_CONSUMER_SECRET",
    "LINKEDIN_ACCESS_TOKEN",
    "LINKEDIN_REFRESH_TOKEN",
    "LINKEDIN_CLIENT_SECRET"
]

private let marketplaceProviderRuntimeSecretEnvironmentPrefixes = [
    "EXA_",
    "TWITTER_",
    "LINKEDIN_",
    "XMCP_",
    "X_MCP_",
    "EXA_MCP_",
    "LINKEDIN_MCP_"
]

extension HarnessInstallManager {
    public func refreshRuntimeModelCatalog(
        for runtimeType: RuntimeType
    ) async -> HarnessRuntimeModelCatalog {
        if runtimeType != .hermes {
            let fallback = HarnessModelSelectionService.catalog(for: runtimeType)
            HarnessModelSelectionService.updateObservedCatalog(fallback)
            return fallback
        }

        let cacheURL = paths.cacheDir.appendingPathComponent(
            "runtime-model-catalog-hermes.json")
        do {
            let record = try getRecord(.hermes)
            guard let installPath = record.installPath?.trimmingCharacters(
                in: .whitespacesAndNewlines),
                !installPath.isEmpty
            else {
                throw RelayError(.harnessMissing, "Hermes Agent is not connected.")
            }
            let harnessPath = URL(fileURLWithPath: installPath, isDirectory: true)
            guard let python = resolveHermesPython(harnessPath) else {
                throw RelayError(
                    .harnessMissing, "Hermes Agent Python environment is not installed.")
            }
            let source = record.source
            let hermesHome = defaultHermesHome(source: source)
            var environment = hermesEnv(harnessPath: harnessPath, hermesHome: hermesHome)
            // Hermes Desktop and Codex use this user-level catalogue. It is
            // intentionally separate from each Relay-owned Hermes profile.
            environment["CODEX_HOME"] = FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent(".codex", isDirectory: true).path
            let script = """
            import json
            from hermes_cli.codex_models import get_codex_model_ids
            models = get_codex_model_ids()
            preferred = "gpt-5.5" if "gpt-5.5" in models else (models[0] if models else None)
            print(json.dumps({"models": models, "defaultModel": preferred}))
            """
            let result = await runner.run(
                python.path,
                ["-c", script],
                options: CommandOptions(
                    cwd: harnessPath,
                    env: environment,
                    timeoutMs: 30_000,
                    executableAuthorization: .pythonVirtualEnvironment(
                        harnessRoot: harnessPath
                    )
                )
            )
            guard result.code == 0,
                  let payload = parseJSONObject(from: result.stdout),
                  case .array(let values)? = payload["models"]
            else {
                throw RelayError(
                    .internalError,
                    trimForStorage(result.diagnosticTail)
                )
            }
            let models = values.compactMap { value -> String? in
                guard case .string(let model) = value else { return nil }
                return model
            }
            guard let first = models.first else {
                throw RelayError(.unsupported, "Hermes did not report any Codex models.")
            }
            let catalog = HarnessRuntimeModelCatalog(
                runtimeType: .hermes,
                defaultModel: stringValue(payload["defaultModel"]) ?? first,
                models: models,
                source: "hermes-codex-discovery",
                observedAt: nowIso()
            )
            HarnessModelSelectionService.updateObservedCatalog(catalog)
            reconcileHermesAgentModelsFromProfiles(catalog: catalog)
            if let data = try? JSONEncoder().encode(catalog) {
                try? data.write(to: cacheURL, options: .atomic)
            }
            return catalog
        } catch {
            if let data = try? Data(contentsOf: cacheURL),
               var cached = try? JSONDecoder().decode(
                HarnessRuntimeModelCatalog.self, from: data)
            {
                cached.source = "cached-hermes-codex-discovery"
                cached.isFallback = false
                HarnessModelSelectionService.updateObservedCatalog(cached)
                reconcileHermesAgentModelsFromProfiles(catalog: cached)
                return cached
            }
            let fallback = HarnessModelSelectionService.catalog(for: .hermes)
            HarnessModelSelectionService.updateObservedCatalog(fallback)
            return fallback
        }
    }

    private func reconcileHermesAgentModelsFromProfiles(
        catalog: HarnessRuntimeModelCatalog
    ) {
        guard let workspaceId = try? data.getAppState().activeWorkspace?.id,
              let agents = try? data.listAgents(workspaceId: workspaceId)
        else { return }
        for agent in agents where agent.binding.runtimeType == .hermes {
            guard let home = agent.binding.hermesHomePath,
                  let runtimeModel = configuredHermesModel(
                    at: URL(fileURLWithPath: home, isDirectory: true)),
                  catalog.models.contains(runtimeModel),
                  runtimeModel != agent.model
            else { continue }
            var config = agent.binding.config
            config["model"] = .string(runtimeModel)
            config["modelFallbackApplied"] = .bool(false)
            config["modelCatalogSource"] = .string(catalog.source)
            config["modelReconciledAt"] = .string(nowIso())
            _ = try? data.updateAgent(
                agentId: agent.id,
                model: runtimeModel,
                config: config
            )
        }
    }

    private func configuredHermesModel(at profileHome: URL) -> String? {
        let configURL = profileHome.appendingPathComponent("config.yaml")
        guard let text = try? String(contentsOf: configURL, encoding: .utf8) else {
            return nil
        }
        var insideModel = false
        var modelIndent = 0
        for rawLine in text.components(separatedBy: .newlines) {
            let trimmed = rawLine.trimmingCharacters(in: .whitespaces)
            guard !trimmed.isEmpty, !trimmed.hasPrefix("#") else { continue }
            let indentation = rawLine.prefix { $0 == " " || $0 == "\t" }.count
            if trimmed == "model:" {
                insideModel = true
                modelIndent = indentation
                continue
            }
            if insideModel, indentation <= modelIndent {
                insideModel = false
            }
            guard insideModel, trimmed.hasPrefix("default:") else { continue }
            let value = String(trimmed.dropFirst("default:".count))
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
            return value.isEmpty ? nil : value
        }
        return nil
    }

    func catalogEntry(_ harnessKey: HarnessKey) -> HarnessCatalogEntry {
        catalog[harnessKey]!
    }

    func runHermesLegacyRuntimeOverrideMigrationIfNeeded() {
        let entry = catalogEntry(.hermes)
        let currentConfig = (try? data.getHarnessByRuntimeType(.hermes)?.config) ?? [:]
        guard stringValue(currentConfig[hermesRuntimeOverrideCleanupMarkerKey]) == nil else {
            return
        }

        let result = cleanLegacyHermesRuntimeOverrides(in: paths.hermesHomeDir)
        if result.failures.isEmpty {
            _ = try? saveRecord(entry: entry, update: [
                hermesRuntimeOverrideCleanupMarkerKey: .string(nowIso()),
                "hermesRuntimeOverrideCleanupFileCount": .number(Double(result.fileCount)),
                "hermesRuntimeOverrideCleanupRemovedCount": .number(Double(result.removedCount))
            ])
            _ = try? data.log(
                severity: "info",
                category: "harness",
                message: "Hermes legacy runtime override migration completed.",
                detail: [
                    "fileCount": .number(Double(result.fileCount)),
                    "removedCount": .number(Double(result.removedCount))
                ]
            )
        } else {
            _ = try? data.log(
                severity: "warn",
                category: "harness",
                message: "Hermes legacy runtime override migration could not complete.",
                detail: [
                    "fileCount": .number(Double(result.fileCount)),
                    "removedCount": .number(Double(result.removedCount)),
                    "failures": .array(result.failures.map(JSONValue.string))
                ]
            )
        }
    }

    private func cleanLegacyHermesRuntimeOverrides(in hermesHome: URL) -> (fileCount: Int, removedCount: Int, failures: [String]) {
        let configFiles = hermesManagedConfigFiles(in: hermesHome)
        var removedCount = 0
        var failures: [String] = []
        for file in configFiles {
            do {
                let original = try String(contentsOf: file, encoding: .utf8)
                let cleaned = removeLegacyHermesRuntimeOverrideKeys(from: original)
                removedCount += cleaned.removedCount
                if cleaned.text != original {
                    try cleaned.text.write(to: file, atomically: true, encoding: .utf8)
                }
            } catch {
                failures.append(
                    "\(file.lastPathComponent): \(redactedTechnicalError(error))"
                )
            }
        }
        return (configFiles.count, removedCount, failures)
    }

    private func hermesManagedConfigFiles(in hermesHome: URL) -> [URL] {
        let fileManager = FileManager.default
        var files: [URL] = []
        let rootConfig = hermesHome.appendingPathComponent("config.yaml")
        if fileManager.fileExists(atPath: rootConfig.path) {
            files.append(rootConfig)
        }
        let profiles = hermesHome.appendingPathComponent("profiles", isDirectory: true)
        guard let profileDirs = try? fileManager.contentsOfDirectory(at: profiles, includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsHiddenFiles]) else {
            return files
        }
        for profileDir in profileDirs.sorted(by: { $0.path < $1.path }) {
            let values = try? profileDir.resourceValues(forKeys: [.isDirectoryKey])
            guard values?.isDirectory == true else { continue }
            let config = profileDir.appendingPathComponent("config.yaml")
            if fileManager.fileExists(atPath: config.path) {
                files.append(config)
            }
        }
        return files
    }

    func readGitCommit(cwd: URL) async throws -> String? {
        let result = await runner.run("/usr/bin/git", ["rev-parse", "HEAD"], options: CommandOptions(cwd: cwd, timeoutMs: 30_000))
        return result.code == 0 ? result.stdout.trimmingCharacters(in: .whitespacesAndNewlines) : nil
    }

    func checkOpenAIAuth(
        harnessKey: HarnessKey,
        harnessPath: URL,
        hermesHome: URL? = nil
    ) async -> ModelAuthCheck {
        if harnessKey == .hermes {
            guard let python = resolveHermesPython(harnessPath) else {
                return ModelAuthCheck(connected: false, error: "Hermes Agent Python environment is not installed.")
            }
            let source = (try? getRecord(.hermes).source) ?? .missing
            let authHome = hermesHome ?? defaultHermesHome(source: source)
            let result = await runner.run(
                python.path,
                ["-c", hermesCodexAuthStatusScript],
                options: CommandOptions(
                    cwd: harnessPath,
                    env: hermesEnv(harnessPath: harnessPath, hermesHome: authHome),
                    timeoutMs: 30_000,
                    executableAuthorization: .pythonVirtualEnvironment(
                        harnessRoot: harnessPath
                    )
                )
            )
            guard result.code == 0,
                  let parsed = parseJSONObject(from: result.stdout),
                  boolValue(parsed["logged_in"]) == true
            else {
                return ModelAuthCheck(connected: false, error: trimForStorage(result.diagnosticTail))
            }
            return ModelAuthCheck(connected: true, error: nil)
        }
        let node = resolveOpenClawNodePath()
        let result = await runner.run(node.path, ["openclaw.mjs", "models", "auth", "list", "--provider", "openai", "--json"], options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: node), timeoutMs: 45_000, executableAuthorization: .exact(node)))
        guard result.code == 0 else {
            return ModelAuthCheck(connected: false, error: trimForStorage(result.diagnosticTail))
        }
        let output = result.stdout
        if let parsed = parseJSONObject(from: output) {
            let values = [parsed["profiles"], parsed["items"], parsed["data"], parsed["authProfiles"]]
            var sawStructuredProfiles = false
            var expiredProfileMessage: String?
            for value in values {
                if case .array(let array)? = value {
                    sawStructuredProfiles = true
                    for item in array {
                        if case .object(let profile) = item,
                           stringValue(profile["provider"]) == "openai",
                           stringValue(profile["type"]) == "oauth",
                           openClawAuthProfileIsUsable(profile),
                           profile["disabledUntil"] == nil,
                           profile["cooldownUntil"] == nil {
                            return ModelAuthCheck(connected: true, error: nil)
                        }
                        if case .object(let profile) = item,
                           expiredProfileMessage == nil,
                           stringValue(profile["provider"]) == "openai",
                           stringValue(profile["type"]) == "oauth" {
                            expiredProfileMessage = openClawExpiredAuthProfileMessage(profile)
                        }
                    }
                }
            }
            if sawStructuredProfiles {
                return ModelAuthCheck(connected: false, error: expiredProfileMessage)
            }
        }
        return ModelAuthCheck(connected: output.localizedCaseInsensitiveContains("openai") && output.localizedCaseInsensitiveContains("oauth"), error: nil)
    }

    private func openClawAuthProfileIsUsable(_ profile: JSONRecord) -> Bool {
        guard let expiresAt = stringValue(profile["expiresAt"])?.trimmingCharacters(in: .whitespacesAndNewlines),
              !expiresAt.isEmpty
        else { return true }
        guard let expiry = ISO8601DateFormatter.relayConsole.date(from: expiresAt) ?? ISO8601DateFormatter().date(from: expiresAt) else {
            return true
        }
        return expiry > Date()
    }

    private func openClawExpiredAuthProfileMessage(_ profile: JSONRecord) -> String? {
        guard let expiresAt = stringValue(profile["expiresAt"])?.trimmingCharacters(in: .whitespacesAndNewlines),
              !expiresAt.isEmpty,
              let expiry = ISO8601DateFormatter.relayConsole.date(from: expiresAt) ?? ISO8601DateFormatter().date(from: expiresAt),
              expiry <= Date()
        else { return nil }
        let email = stringValue(profile["email"])?.trimmingCharacters(in: .whitespacesAndNewlines)
        let account = email?.isEmpty == false ? " for \(email!)" : ""
        return "OpenClaw's saved OpenAI auth profile\(account) expired at \(expiresAt). Authenticate in OpenClaw, then re-check Relay Console."
    }

    func ensureHermesOpenAICodexProvider(harnessPath: URL, hermesHome: URL, model: String? = nil) async throws -> String {
        guard let python = resolveHermesPython(harnessPath) else {
            throw RelayError(.harnessMissing, "Hermes Agent Python environment is not installed.")
        }
        var env = hermesEnv(harnessPath: harnessPath, hermesHome: hermesHome)
        env["RELAY_CONSOLE_HERMES_DEFAULT_MODEL"] = try HarnessModelSelectionService.resolve(model, for: .hermes).selected
        let result = await runner.run(
            python.path,
            ["-c", hermesCodexModelSetupScript],
            options: CommandOptions(
                cwd: harnessPath,
                env: env,
                timeoutMs: 120_000,
                executableAuthorization: .pythonVirtualEnvironment(
                    harnessRoot: harnessPath
                )
            )
        )
        try requireSuccess(result, fallback: "Hermes OpenAI Codex provider setup failed.")
        return result.stdout
    }

    func modelAuthCommand(harnessKey: HarnessKey, harnessPath: URL) -> HarnessCommandSpec {
        if harnessKey == .hermes {
            let python = resolveHermesPython(harnessPath) ?? hermesPythonPath(harnessPath)
            return HarnessCommandSpec(command: python.path, args: ["-m", "hermes_cli.main", "auth", "add", "openai-codex", "--type", "oauth"], cwd: harnessPath.path)
        }
        return HarnessCommandSpec(command: resolveOpenClawNodePath().path, args: ["openclaw.mjs", "models", "auth", "login", "--provider", "openai"], cwd: harnessPath.path)
    }

    func openClawAuthHelperCommand(harnessPath: URL) -> HarnessCommandSpec {
        HarnessCommandSpec(command: resolveOpenClawNodePath().path, args: ["--input-type=module", "--eval", openClawAuthHelperScript], cwd: harnessPath.path)
    }

    func runtimeCommand(harnessKey: HarnessKey, harnessPath: URL) -> HarnessCommandSpec? {
        if harnessKey == .hermes, let python = resolveHermesPython(harnessPath) {
            return HarnessCommandSpec(command: python.path, args: ["-c", "import run_agent"], cwd: harnessPath.path)
        }
        if harnessKey == .openclaw {
            return HarnessCommandSpec(command: resolveOpenClawNodePath().path, args: ["openclaw.mjs", "gateway", "start"], cwd: harnessPath.path)
        }
        return nil
    }

    func healthCommand(harnessKey: HarnessKey, harnessPath: URL) -> HarnessCommandSpec? {
        if harnessKey == .hermes, let python = resolveHermesPython(harnessPath) {
            return HarnessCommandSpec(command: python.path, args: ["-c", "import run_agent; print('ok')"], cwd: harnessPath.path)
        }
        if harnessKey == .openclaw {
            return HarnessCommandSpec(command: resolveOpenClawNodePath().path, args: ["openclaw.mjs", "gateway", "status", "--json"], cwd: harnessPath.path)
        }
        return nil
    }

    func harnessPath(for harness: Harness) throws -> URL {
        guard let value = stringValue(harness.config["installPath"]) else {
            throw RelayError(.harnessMissing, "\(harness.displayName) is not configured.")
        }
        return URL(fileURLWithPath: value)
    }

    func openSupportedAuthURL(_ value: String) {
        guard let url = URL(string: value), url.scheme == "https", url.host == "auth.openai.com" else {
            return
        }
        openExternal(url.absoluteString)
    }

    func markAuthRequired(harness: Harness, message: String) {
        let entry = catalogEntry(harness.runtimeType == .openclaw ? .openclaw : .hermes)
        _ = try? saveRecord(entry: entry, update: [
            "lifecycleState": .string(HarnessLifecycleState.authRequired.rawValue),
            "modelAuthStatus": .string(HarnessModelAuthStatus.failed.rawValue),
            "modelAuthLastError": .string(message),
            "lastError": .string(message),
            "lastCheckedAt": .string(nowIso())
        ])
    }

    func emitInstallProgress(_ harnessKey: HarnessKey, stage: String, message: String, status: String = "running", detail: JSONRecord = [:]) {
        let event = HarnessInstallProgressEvent(harnessKey: harnessKey, stage: stage, message: message, status: status, checkedAt: nowIso(), detail: detail)
        eventBus.emit(.harnessInstallProgress, event)
        _ = try? data.log(severity: status == "failed" ? "error" : "info", category: "harness-install", message: message, detail: ["harnessKey": .string(harnessKey.rawValue), "stage": .string(stage)])
    }

    func hermesEnv(harnessPath: URL, hermesHome: URL) -> [String: String] {
        var env = withToolPath(CommandExecutionEnvironment.minimal)
        env.merge(readEnvironmentFile(hermesHome.appendingPathComponent(".env"))) { _, profileValue in profileValue }
        env["HERMES_HOME"] = hermesHome.path
        env["CODEX_HOME"] = paths.codexHomeDir.path
        env["PYTHONPATH"] = harnessPath.path
        env["PATH"] = mergePath(
            [
                harnessPath.appendingPathComponent(".venv/bin", isDirectory: true).path,
                harnessPath.appendingPathComponent("venv/bin", isDirectory: true).path
            ],
            existing: withToolPath(CommandExecutionEnvironment.minimal)["PATH"] ?? ""
        )
        return env
    }

    private func readEnvironmentFile(_ envURL: URL) -> [String: String] {
        guard let text = try? String(contentsOf: envURL, encoding: .utf8) else {
            return [:]
        }
        var values: [String: String] = [:]
        for rawLine in text.components(separatedBy: .newlines) {
            var line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !line.isEmpty, !line.hasPrefix("#") else { continue }
            if line.hasPrefix("export ") {
                line = String(line.dropFirst("export ".count)).trimmingCharacters(in: .whitespacesAndNewlines)
            }
            guard let equals = line.firstIndex(of: "=") else { continue }
            let key = String(line[..<equals]).trimmingCharacters(in: .whitespacesAndNewlines)
            guard isValidEnvironmentKey(key) else { continue }
            var value = String(line[line.index(after: equals)...]).trimmingCharacters(in: .whitespacesAndNewlines)
            if value.count >= 2,
               let first = value.first,
               let last = value.last,
               (first == "\"" && last == "\"") || (first == "'" && last == "'") {
                value = String(value.dropFirst().dropLast())
            }
            values[key] = value
        }
        return values
    }

    private func isValidEnvironmentKey(_ key: String) -> Bool {
        guard let first = key.unicodeScalars.first,
              CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_").contains(first)
        else {
            return false
        }
        return key.unicodeScalars.allSatisfy {
            CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_").contains($0)
        }
    }

    func openClawEnv(nodePath: URL? = nil) -> [String: String] {
        var env = withToolPath(CommandExecutionEnvironment.minimal)
        env.merge(readEnvironmentFile(openClawStateDir().appendingPathComponent(".env"))) { _, profileValue in profileValue }
        env.merge(readOpenClawAgentEnvironmentFiles()) { _, profileValue in profileValue }
        let nodeBin = (nodePath ?? resolveOpenClawNodePath()).deletingLastPathComponent().path
        let userManaged = (try? getRecord(.openclaw).source) == .located
        if !userManaged {
            env["HOME"] = paths.root.path
            env["OPENCLAW_HOME"] = paths.root.path
        }
        env["OPENCLAW_STATE_DIR"] = openClawStateDir().path
        env["OPENCLAW_CONFIG_PATH"] = openClawConfigPath().path
        if let token = openClawGatewayTokenFromConfig() {
            env["OPENCLAW_GATEWAY_TOKEN"] = token
        }
        env["PATH"] = mergePath(
            [nodeBin, managedOpenClawPnpmShimPath().deletingLastPathComponent().path],
            existing: withToolPath(CommandExecutionEnvironment.minimal)["PATH"] ?? ""
        )
        return env
    }

    func marketplaceRuntimeSanitizedEnvironment(_ env: [String: String]) -> [String: String] {
        env.filter { key, _ in
            !Self.isMarketplaceProviderRuntimeSecretEnvironmentKey(key)
        }
    }

    private static func isMarketplaceProviderRuntimeSecretEnvironmentKey(_ key: String) -> Bool {
        let normalized = key.uppercased()
        if marketplaceProviderRuntimeSecretEnvironmentKeys.contains(normalized) {
            return true
        }
        return marketplaceProviderRuntimeSecretEnvironmentPrefixes.contains { normalized.hasPrefix($0) }
    }

    private func readOpenClawAgentEnvironmentFiles() -> [String: String] {
        let agentsDir = openClawStateDir().appendingPathComponent("agents", isDirectory: true)
        guard let slugs = try? FileManager.default.contentsOfDirectory(
            at: agentsDir,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return [:]
        }
        var values: [String: String] = [:]
        for slugURL in slugs.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
            var isDirectory: ObjCBool = false
            guard FileManager.default.fileExists(atPath: slugURL.path, isDirectory: &isDirectory), isDirectory.boolValue else {
                continue
            }
            let envURL = slugURL.appendingPathComponent("agent/.env")
            values.merge(readEnvironmentFile(envURL)) { _, profileValue in profileValue }
        }
        return values
    }

    func openClawToolchainEnv(nodePath: URL) -> [String: String] {
        var env = openClawEnv(nodePath: nodePath)
        env["COREPACK_ENABLE_DOWNLOAD_PROMPT"] = "0"
        env["COREPACK_HOME"] = managedOpenClawCorepackHome().path
        env["PNPM_HOME"] = managedOpenClawPnpmHome().path
        env["npm_config_store_dir"] = managedOpenClawPnpmStoreDir().path
        return env
    }

    func openClawPackageManagerEnv(nodePath: URL) -> [String: String] {
        var env = openClawToolchainEnv(nodePath: nodePath)
        env["npm_config_network_concurrency"] = "4"
        env["npm_config_child_concurrency"] = "2"
        env["npm_config_fetch_retries"] = "10"
        env["npm_config_fetch_retry_mintimeout"] = "10000"
        env["npm_config_fetch_retry_maxtimeout"] = "180000"
        env["npm_config_fetch_timeout"] = "600000"
        return env
    }

    func runOpenClawPnpm(toolchain: OpenClawToolchain, args: [String], cwd: URL, timeoutMs: Int) async -> CommandResult {
        await runner.run(toolchain.pnpmCommand.command, toolchain.pnpmCommand.args + args, options: CommandOptions(cwd: cwd, env: openClawPackageManagerEnv(nodePath: toolchain.nodePath), timeoutMs: timeoutMs, executableAuthorization: .exact(URL(fileURLWithPath: toolchain.pnpmCommand.command))))
    }

    func runOpenClawPnpmCommand(toolchain: OpenClawToolchain, args: [String], cwd: URL, timeoutMs: Int) async -> CommandResult {
        await runner.run(toolchain.pnpmCommand.command, toolchain.pnpmCommand.args + args, options: CommandOptions(cwd: cwd, env: openClawPackageManagerEnv(nodePath: toolchain.nodePath), timeoutMs: timeoutMs, executableAuthorization: .exact(URL(fileURLWithPath: toolchain.pnpmCommand.command))))
    }

    func runOpenClaw(harnessPath: URL, args: [String], timeoutMs: Int, nodePath: URL? = nil) async -> CommandResult {
        let node = nodePath ?? resolveOpenClawNodePath()
        return await runner.run(node.path, ["openclaw.mjs"] + args, options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: node), timeoutMs: timeoutMs, executableAuthorization: .exact(node)))
    }

    func ensureOpenClawGatewayAuthConfigured(harnessPath: URL, nodePath: URL? = nil) async throws -> String {
        let existingToken = openClawGatewayTokenFromConfig()
        let existingMode = openClawGatewayAuthModeFromConfig()
        if let token = existingToken, existingMode == "token" {
            return token
        }

        let token = existingToken ?? generateOpenClawGatewayToken()
        let node = nodePath ?? resolveOpenClawNodePath()
        if existingMode != "token" {
            let modeResult = await runner.run(
                node.path,
                ["openclaw.mjs", "config", "set", "gateway.auth.mode", "token"],
                options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: node), timeoutMs: 30_000, executableAuthorization: .exact(node))
            )
            guard modeResult.code == 0 else {
                throw RelayError(.internalError, "Relay Console could not configure OpenClaw gateway auth mode.")
            }
        }
        if existingToken == nil {
            let tokenResult = await runner.run(
                node.path,
                ["openclaw.mjs", "config", "set", "gateway.auth.token", token],
                options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: node), timeoutMs: 30_000, executableAuthorization: .exact(node))
            )
            guard tokenResult.code == 0 else {
                throw RelayError(.internalError, "Relay Console could not configure OpenClaw gateway auth token.")
            }
        }
        return token
    }

    func openClawGatewayStatus(harnessPath: URL) async -> CommandResult {
        let node = resolveOpenClawNodePath()
        return await runner.run(node.path, ["openclaw.mjs", "gateway", "status", "--json"], options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: node), timeoutMs: 10_000, executableAuthorization: .exact(node)))
    }

    func ensureOpenClawGatewayServiceStarted(harnessPath: URL, nodePath: URL? = nil) async throws {
        let node = nodePath ?? resolveOpenClawNodePath()
        let token = try await ensureOpenClawGatewayAuthConfigured(harnessPath: harnessPath, nodePath: node)
        let status = await openClawGatewayStatus(harnessPath: harnessPath)
        if openClawGatewayStatusIsReady(status) {
            return
        }
        let install = await runner.run(
            node.path,
            ["openclaw.mjs", "gateway", "install", "--port", openClawGatewayPort, "--force", "--token", token],
            options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: node), timeoutMs: 60_000, executableAuthorization: .exact(node))
        )
        guard install.code == 0 else {
            let message = trimForStorage(install.diagnosticTail)
            throw RelayError(.harnessUnhealthy, message.isEmpty ? "OpenClaw gateway service install failed." : message)
        }
        let start = await runner.run(
            node.path,
            ["openclaw.mjs", "gateway", "start"],
            options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: node), timeoutMs: 60_000, executableAuthorization: .exact(node))
        )
        guard start.code == 0 else {
            let message = trimForStorage(start.diagnosticTail)
            throw RelayError(.harnessUnhealthy, message.isEmpty ? "OpenClaw gateway service start failed." : message)
        }
    }

    func restartOpenClawGatewayService(harnessPath: URL, nodePath: URL? = nil) async throws {
        let node = nodePath ?? resolveOpenClawNodePath()
        _ = try await ensureOpenClawGatewayAuthConfigured(harnessPath: harnessPath, nodePath: node)
        let restart = await runner.run(
            node.path,
            ["openclaw.mjs", "gateway", "restart"],
            options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: node), timeoutMs: 60_000, executableAuthorization: .exact(node))
        )
        guard restart.code == 0 else {
            let message = trimForStorage(restart.diagnosticTail)
            throw RelayError(.harnessUnhealthy, message.isEmpty ? "OpenClaw gateway service restart failed." : message)
        }
    }

    func waitForOpenClawGateway(harnessPath: URL) async throws {
        let deadline = Date().addingTimeInterval(45)
        var last = ""
        while Date() < deadline {
            let result = await openClawGatewayStatus(harnessPath: harnessPath)
            last = result.diagnosticTail
            if openClawGatewayStatusIsReady(result) { return }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
        }
        throw RelayError(.harnessUnhealthy, openClawGatewayNotReadyMessage(last))
    }

    func openClawAgentExists(harnessPath: URL, slug: String, nodePath: URL) async -> Bool {
        let result = await runner.run(nodePath.path, ["openclaw.mjs", "agents", "list", "--json"], options: CommandOptions(cwd: harnessPath, env: openClawEnv(nodePath: nodePath), timeoutMs: 30_000, executableAuthorization: .exact(nodePath)))
        guard result.code == 0 else { return false }
        return openClawAgentsListIncludes(result.stdout, slug: slug)
    }

    func bootstrapOpenClawAuthFromMainAgent(slug: String) throws {
        guard normalizeOpenClawAgentId(slug) != "main" else { return }
        let source = openClawAgentDir(slug: "main")
        let dest = openClawAgentDir(slug: slug)
        try? FileManager.default.createDirectory(at: dest, withIntermediateDirectories: true)
        for filename in openClawPortableAuthFilenames {
            let from = source.appendingPathComponent(filename)
            let to = dest.appendingPathComponent(filename)
            if FileManager.default.fileExists(atPath: from.path), !FileManager.default.fileExists(atPath: to.path) {
                try? FileManager.default.copyItem(at: from, to: to)
            }
        }
        _ = try repairOpenClawAgentDatabaseIfNeeded(slug: slug)
        guard !openClawAuthProfileStoreHasRows(slug: slug) else { return }
        let snapshot = try readOpenClawAuthProfileSnapshot(from: source.appendingPathComponent("openclaw-agent.sqlite"))
        guard !snapshot.isEmpty else { return }
        try ensureOpenClawAgentDatabaseShell(slug: slug)
        try writeOpenClawAuthProfileSnapshot(snapshot, to: openClawAgentDatabasePath(slug: slug))
    }

    @discardableResult
    func repairOpenClawAgentDatabaseIfNeeded(slug: String) throws -> Bool {
        let expected = normalizeOpenClawAgentId(slug)
        guard expected != "main" else { return false }
        let databasePath = openClawAgentDatabasePath(slug: slug)
        guard FileManager.default.fileExists(atPath: databasePath.path),
              let owner = try readOpenClawAgentDatabaseOwner(at: databasePath),
              normalizeOpenClawAgentId(owner) != expected
        else {
            return false
        }

        let localSnapshot = try readOpenClawAuthProfileSnapshot(from: databasePath)
        let mainSnapshot = try readOpenClawAuthProfileSnapshot(from: openClawAgentDatabasePath(slug: "main"))
        let snapshot = localSnapshot.isEmpty ? mainSnapshot : localSnapshot
        try backupOpenClawAgentDatabaseFiles(slug: slug)
        try ensureOpenClawAgentDatabaseShell(slug: slug)
        if !snapshot.isEmpty {
            try writeOpenClawAuthProfileSnapshot(snapshot, to: databasePath)
        }
        _ = try? data.log(severity: "warn", category: "harness", message: "Repaired OpenClaw agent database owner.", detail: [
            "openclawAgentId": .string(expected),
            "previousOwner": .string(owner)
        ])
        return true
    }

    private func openClawAgentDatabasePath(slug: String) -> URL {
        openClawAgentDir(slug: slug).appendingPathComponent("openclaw-agent.sqlite")
    }

    private func readOpenClawAgentDatabaseOwner(at databasePath: URL) throws -> String? {
        guard FileManager.default.fileExists(atPath: databasePath.path) else { return nil }
        let database = DatabaseService(databasePath: databasePath)
        try database.open()
        defer { database.close() }
        let row = try database.get("SELECT agent_id FROM schema_meta WHERE meta_key = 'primary' LIMIT 1")
        guard case .text(let owner)? = row?["agent_id"] else { return nil }
        let trimmed = owner.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func openClawAuthProfileStoreHasRows(slug: String) -> Bool {
        let databasePath = openClawAgentDatabasePath(slug: slug)
        guard FileManager.default.fileExists(atPath: databasePath.path) else { return false }
        guard let snapshot = try? readOpenClawAuthProfileSnapshot(from: databasePath) else { return false }
        return !snapshot.storeRows.isEmpty
    }

    private func readOpenClawAuthProfileSnapshot(from databasePath: URL) throws -> OpenClawAuthProfileSnapshot {
        guard FileManager.default.fileExists(atPath: databasePath.path) else {
            return OpenClawAuthProfileSnapshot(storeRows: [], stateRows: [])
        }
        let database = DatabaseService(databasePath: databasePath)
        try database.open()
        defer { database.close() }
        let storeRows = (try? database.all("SELECT store_key, store_json, updated_at FROM auth_profile_store")) ?? []
        let stateRows = (try? database.all("SELECT state_key, state_json, updated_at FROM auth_profile_state")) ?? []
        return OpenClawAuthProfileSnapshot(
            storeRows: storeRows.compactMap { row in
                guard case .text(let key)? = row["store_key"],
                      case .text(let json)? = row["store_json"]
                else { return nil }
                return OpenClawAuthProfileStoreRow(key: key, json: json, updatedAt: sqliteInt64(row["updated_at"]) ?? 0)
            },
            stateRows: stateRows.compactMap { row in
                guard case .text(let key)? = row["state_key"],
                      case .text(let json)? = row["state_json"]
                else { return nil }
                return OpenClawAuthProfileStateRow(key: key, json: json, updatedAt: sqliteInt64(row["updated_at"]) ?? 0)
            }
        )
    }

    private func ensureOpenClawAgentDatabaseShell(slug: String) throws {
        let databasePath = openClawAgentDatabasePath(slug: slug)
        try FileManager.default.createDirectory(at: databasePath.deletingLastPathComponent(), withIntermediateDirectories: true)
        let database = DatabaseService(databasePath: databasePath)
        try database.open()
        defer { database.close() }
        try database.exec("""
        CREATE TABLE IF NOT EXISTS schema_meta (
          meta_key TEXT NOT NULL PRIMARY KEY,
          role TEXT NOT NULL,
          schema_version INTEGER NOT NULL,
          agent_id TEXT,
          app_version TEXT,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS auth_profile_state (
          state_key TEXT NOT NULL PRIMARY KEY,
          state_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS auth_profile_store (
          store_key TEXT NOT NULL PRIMARY KEY,
          store_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        """)
        let now = Int64(Date().timeIntervalSince1970 * 1000)
        try database.run("DELETE FROM schema_meta WHERE meta_key = 'primary'")
        try database.run(
            "INSERT INTO schema_meta (meta_key, role, schema_version, agent_id, app_version, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, ?, ?)",
            [.text("primary"), .text("agent"), .integer(1), .text(normalizeOpenClawAgentId(slug)), .integer(now), .integer(now)]
        )
        try database.exec("PRAGMA user_version = 1;")
    }

    private func writeOpenClawAuthProfileSnapshot(_ snapshot: OpenClawAuthProfileSnapshot, to databasePath: URL) throws {
        let database = DatabaseService(databasePath: databasePath)
        try database.open()
        defer { database.close() }
        try database.transaction {
            for row in snapshot.storeRows {
                try database.run(
                    "INSERT INTO auth_profile_store (store_key, store_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(store_key) DO UPDATE SET store_json = excluded.store_json, updated_at = excluded.updated_at",
                    [.text(row.key), .text(row.json), .integer(row.updatedAt)]
                )
            }
            for row in snapshot.stateRows {
                try database.run(
                    "INSERT INTO auth_profile_state (state_key, state_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(state_key) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at",
                    [.text(row.key), .text(row.json), .integer(row.updatedAt)]
                )
            }
        }
    }

    private func backupOpenClawAgentDatabaseFiles(slug: String) throws {
        let agentDir = openClawAgentDir(slug: slug)
        let suffix = ".relay-backup-\(Int64(Date().timeIntervalSince1970 * 1000))-\(UUID().uuidString)"
        for filename in openClawAgentDatabaseFilenames {
            let source = agentDir.appendingPathComponent(filename)
            guard FileManager.default.fileExists(atPath: source.path) else { continue }
            try FileManager.default.moveItem(at: source, to: agentDir.appendingPathComponent(filename + suffix))
        }
    }

    func openClawManagedHome() -> URL { paths.root }
    func openClawStateDir() -> URL {
        if let config = try? data.getHarnessByRuntimeType(.openclaw)?.config,
           HarnessInstallSource(rawValue: stringValue(config["source"]) ?? "") == .located {
            if let configured = stringValue(config["openClawStateDir"]), !configured.isEmpty {
                return URL(fileURLWithPath: configured, isDirectory: true)
            }
            return FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".openclaw", isDirectory: true)
        }
        return paths.openClawHomeDir
    }
    func openClawConfigPath() -> URL { openClawStateDir().appendingPathComponent("openclaw.json") }
    func openClawInstallLogPath() -> URL { openClawStateDir().appendingPathComponent("logs/relay-console-install.log") }
    func defaultOpenClawWorkspacePath() -> URL { openClawStateDir().appendingPathComponent("workspace", isDirectory: true) }
    func defaultOpenClawWorkspacePath(for slug: String) -> URL { openClawStateDir().appendingPathComponent("workspace-\(slug)", isDirectory: true) }
    func openClawAgentDir(slug: String) -> URL { openClawStateDir().appendingPathComponent("agents/\(slug)/agent", isDirectory: true) }
    func managedOpenClawNodeDir() -> URL { paths.openClawToolchainDir.appendingPathComponent("node", isDirectory: true) }
    func managedOpenClawNodePath() -> URL { managedOpenClawNodeDir().appendingPathComponent("bin/node") }
    func managedOpenClawCorepackPath() -> URL { managedOpenClawNodeDir().appendingPathComponent("bin/corepack") }
    func managedOpenClawNpmPath() -> URL { managedOpenClawNodeDir().appendingPathComponent("bin/npm") }
    func managedOpenClawPnpmDir() -> URL { paths.openClawToolchainDir.appendingPathComponent("pnpm", isDirectory: true) }
    func managedOpenClawCorepackHome() -> URL { paths.openClawToolchainDir.appendingPathComponent("corepack", isDirectory: true) }
    func managedOpenClawPnpmHome() -> URL { paths.openClawToolchainDir.appendingPathComponent("pnpm-home", isDirectory: true) }
    func managedOpenClawPnpmStoreDir() -> URL { paths.openClawToolchainDir.appendingPathComponent("pnpm-store", isDirectory: true) }
    func managedOpenClawPnpmCjsPath() -> URL { managedOpenClawPnpmDir().appendingPathComponent("node_modules/pnpm/bin/pnpm.cjs") }
    func managedOpenClawPnpmShimPath() -> URL { managedOpenClawNodeDir().appendingPathComponent("bin/pnpm") }

    func resolveOpenClawNodePath() -> URL {
        if let config = try? data.getHarnessByRuntimeType(.openclaw)?.config,
           let configured = stringValue(config["openClawNodePath"]),
           isApprovedOpenClawNodePath(configured) {
            return URL(fileURLWithPath: configured)
        }
        if let userManaged = try? resolveUserManagedNodePath() {
            return userManaged
        }
        return managedOpenClawNodePath()
    }

    func resolveUserManagedNodePath() throws -> URL {
        let candidates = [
            URL(fileURLWithPath: "/opt/homebrew/bin/node"),
            URL(fileURLWithPath: "/opt/homebrew/opt/node/bin/node"),
            URL(fileURLWithPath: "/usr/local/bin/node"),
            URL(fileURLWithPath: "/usr/local/opt/node/bin/node"),
            URL(fileURLWithPath: "/usr/bin/node")
        ]
        if let node = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0.path) }) {
            return node
        }
        throw RelayError(.harnessMissing, "OpenClaw requires Node at an approved system installation path.")
    }

    private func isApprovedOpenClawNodePath(_ value: String) -> Bool {
        let candidate = URL(fileURLWithPath: value).standardizedFileURL
        guard candidate.path == value,
              FileManager.default.isExecutableFile(atPath: candidate.path)
        else { return false }
        let managedRoot = paths.openClawToolchainDir.standardizedFileURL.path
        if candidate.path.hasPrefix(managedRoot + "/") {
            return true
        }
        return Set([
            "/opt/homebrew/bin/node",
            "/opt/homebrew/opt/node/bin/node",
            "/usr/local/bin/node",
            "/usr/local/opt/node/bin/node",
            "/usr/bin/node"
        ]).contains(candidate.path)
    }

    func openClawGatewayTokenFromConfig() -> String? {
        guard let text = try? String(contentsOf: openClawConfigPath(), encoding: .utf8),
              let config = parseJSONObject(from: text),
              let token = stringValue(nestedJSONValue(config, "gateway", "auth", "token"))?.trimmingCharacters(in: .whitespacesAndNewlines),
              !token.isEmpty
        else { return nil }
        return token
    }

    func openClawGatewayAuthModeFromConfig() -> String? {
        guard let text = try? String(contentsOf: openClawConfigPath(), encoding: .utf8),
              let config = parseJSONObject(from: text),
              let mode = stringValue(nestedJSONValue(config, "gateway", "auth", "mode"))?.trimmingCharacters(in: .whitespacesAndNewlines),
              !mode.isEmpty
        else { return nil }
        return mode.lowercased()
    }

    func generateOpenClawGatewayToken() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = bytes.withUnsafeMutableBytes { buffer in
            SecRandomCopyBytes(kSecRandomDefault, buffer.count, buffer.baseAddress!)
        }
        if status == errSecSuccess {
            return "relay_" + bytes.map { String(format: "%02x", $0) }.joined()
        }
        return "relay_" + UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
            + UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
    }

    func resolveManagedOpenClawPnpmCommand(nodePath: URL) -> HarnessCommandSpec? {
        let shim = managedOpenClawPnpmShimPath()
        if FileManager.default.fileExists(atPath: shim.path) {
            return HarnessCommandSpec(command: shim.path, args: [], cwd: nil)
        }
        let cjs = managedOpenClawPnpmCjsPath()
        if FileManager.default.fileExists(atPath: cjs.path) {
            return HarnessCommandSpec(command: nodePath.path, args: [cjs.path], cwd: nil)
        }
        return nil
    }

    func resolveHermesPython(_ installPath: URL) -> URL? {
        for relativePath in [".venv/bin/python", "venv/bin/python"] {
            let python = installPath.appendingPathComponent(relativePath)
            if FileManager.default.fileExists(atPath: python.path) {
                return python
            }
        }
        return nil
    }

    func hermesPythonPath(_ installPath: URL) -> URL {
        installPath.appendingPathComponent(".venv/bin/python")
    }

    func defaultHermesHome(source: HarnessInstallSource) -> URL {
        if source == .located {
            let user = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".hermes", isDirectory: true)
            if FileManager.default.fileExists(atPath: user.path) { return user }
        }
        return paths.hermesHomeDir
    }

    func requireSuccess(_ result: CommandResult, fallback: String) throws {
        guard result.code == 0 else {
            throw RelayError(
                .internalError,
                result.diagnosticTail.isEmpty ? fallback : trimForStorage(result.diagnosticTail)
            )
        }
    }

    func ensureCommandAvailable(_ command: String, message: String) async throws {
        let result = await runner.run(command, ["--version"], options: CommandOptions(timeoutMs: 20_000))
        guard result.code == 0 else {
            throw RelayError(.internalError, message)
        }
    }

    func assertHarnessFolder(entry: HarnessCatalogEntry, _ path: URL) throws {
        if entry.harnessKey == .hermes {
            guard FileManager.default.fileExists(atPath: path.appendingPathComponent("run_agent.py").path) else {
                throw RelayError(.harnessMissing, "Selected folder is not a Hermes Agent checkout.")
            }
        } else {
            guard FileManager.default.fileExists(atPath: path.appendingPathComponent("openclaw.mjs").path),
                  FileManager.default.fileExists(atPath: path.appendingPathComponent("package.json").path)
            else {
                throw RelayError(.harnessMissing, "Selected folder is not an OpenClaw checkout.")
            }
        }
    }

    func assertManagedInstallLocation(_ path: URL, entry: HarnessCatalogEntry) throws {
        let expected = paths.harnessesDir.appendingPathComponent(entry.managedDirName, isDirectory: true).standardizedFileURL.path
        guard path.standardizedFileURL.path == expected else {
            throw RelayError(.permissionDenied, "Relay Console will only repair managed harness folders inside app support.")
        }
    }
}

func encodeSession(_ session: HarnessModelAuthSession) -> JSONValue {
    .object([
        "provider": .string(session.provider),
        "status": .string(session.status),
        "message": .string(session.message),
        "userCode": session.userCode.map(JSONValue.string) ?? .null,
        "verificationUrl": session.verificationUrl.map(JSONValue.string) ?? .null,
        "startedAt": .string(session.startedAt),
        "expiresAt": session.expiresAt.map(JSONValue.string) ?? .null
    ])
}

func sessionValue(_ value: JSONValue?) -> HarnessModelAuthSession? {
    guard case .object(let object)? = value else { return nil }
    guard let provider = stringValue(object["provider"]),
          let status = stringValue(object["status"]),
          let message = stringValue(object["message"]),
          let startedAt = stringValue(object["startedAt"])
    else { return nil }
    return HarnessModelAuthSession(provider: provider, status: status, message: message, userCode: stringValue(object["userCode"]), verificationUrl: stringValue(object["verificationUrl"]), startedAt: startedAt, expiresAt: stringValue(object["expiresAt"]))
}

func commandSpecValue(_ value: JSONValue?) -> HarnessCommandSpec? {
    guard case .object(let object)? = value,
          let command = stringValue(object["command"])
    else { return nil }
    return HarnessCommandSpec(command: command, args: arrayStrings(object["args"]), cwd: stringValue(object["cwd"]))
}

func arrayStrings(_ value: JSONValue?) -> [String] {
    guard case .array(let values)? = value else { return [] }
    return values.compactMap { stringValue($0) }
}

func parseJSONValue(from text: String) -> JSONValue? {
    let candidates = [
        text,
        text.components(separatedBy: "\n").last(where: { line in
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.hasPrefix("{") || trimmed.hasPrefix("[")
        }) ?? ""
    ]
    for candidate in candidates {
        guard let data = candidate.trimmingCharacters(in: .whitespacesAndNewlines).data(using: .utf8),
              let value = try? JSONSerialization.jsonObject(with: data)
        else { continue }
        return jsonValue(from: value)
    }
    return nil
}

func parseJSONObject(from text: String) -> JSONRecord? {
    guard case .object(let object)? = parseJSONValue(from: text) else { return nil }
    return object
}

func openClawGatewayStatusIsReady(_ result: CommandResult) -> Bool {
    result.code == 0 && openClawGatewayStatusIsReady(result.stdout)
}

func openClawGatewayStatusIsReady(_ output: String) -> Bool {
    guard let status = parseJSONObject(from: output) else { return false }
    if let rpcOK = boolValue(nestedJSONValue(status, "rpc", "ok")) {
        return rpcOK
    }
    if let topLevelStatus = stringValue(status["status"])?.lowercased(),
       ["ready", "ok", "running"].contains(topLevelStatus) {
        return true
    }
    return false
}

func openClawGatewayNotReadyMessage(_ output: String) -> String {
    guard let status = parseJSONObject(from: output) else {
        let fallback = trimForStorage(output)
        return fallback.isEmpty ? "OpenClaw gateway did not become ready." : fallback
    }
    if let error = stringValue(nestedJSONValue(status, "rpc", "error")), !error.isEmpty {
        return "OpenClaw gateway is not reachable: \(error)"
    }
    if let port = stringValue(nestedJSONValue(status, "port", "status")), !port.isEmpty {
        return "OpenClaw gateway is not ready; port status is \(port)."
    }
    if let detail = stringValue(nestedJSONValue(status, "service", "runtime", "detail")), !detail.isEmpty {
        return "OpenClaw gateway is not ready: \(trimForStorage(detail))"
    }
    return "OpenClaw gateway did not become ready."
}

private func nestedJSONValue(_ object: JSONRecord, _ path: String...) -> JSONValue? {
    var current: JSONValue? = .object(object)
    for key in path {
        guard case .object(let nested)? = current else { return nil }
        current = nested[key]
    }
    return current
}

let openClawAuthHelperScript = #"""
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EVENT_PREFIX = "__relay_openclaw_auth__:";
const FALLBACK_OPENAI_CODEX_DEFAULT_MODEL = "openai/gpt-5.5";

function emit(event) {
  process.stdout.write(EVENT_PREFIX + JSON.stringify(event) + "\n");
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolveOpenAIIdentity(identityResolver, access) {
  try {
    return identityResolver({ access });
  } catch (sdkError) {
    try {
      return identityResolver({ accessToken: access });
    } catch {
      throw sdkError;
    }
  }
}

async function importOpenClaw(relativePath) {
  return import(pathToFileURL(path.join(process.cwd(), relativePath)).href);
}

async function readConfig(configPath) {
  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8"));
    return isRecord(parsed) ? parsed : {};
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function patchOpenClawConfig(defaultModel) {
  const stateDir = process.env.OPENCLAW_STATE_DIR || process.env.OPENCLAW_HOME || process.env.HOME;
  if (!stateDir) {
    throw new Error("OPENCLAW_STATE_DIR is not configured.");
  }
  const configPath = process.env.OPENCLAW_CONFIG_PATH || path.join(stateDir, "openclaw.json");
  const current = await readConfig(configPath);
  const agents = isRecord(current.agents) ? current.agents : {};
  const defaults = isRecord(agents.defaults) ? agents.defaults : {};
  const models = isRecord(defaults.models) ? { ...defaults.models } : {};
  models[defaultModel] = isRecord(models[defaultModel]) ? models[defaultModel] : {};
  const meta = isRecord(current.meta) ? current.meta : {};
  const next = {
    ...current,
    agents: {
      ...agents,
      defaults: {
        ...defaults,
        models
      }
    },
    meta: {
      ...meta,
      lastTouchedAt: new Date().toISOString(),
      ...(process.env.OPENCLAW_VERSION ? { lastTouchedVersion: process.env.OPENCLAW_VERSION } : {})
    }
  };
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(next, null, 2) + "\n");
}

async function main() {
  const stateDir = process.env.OPENCLAW_STATE_DIR || process.env.OPENCLAW_HOME || process.env.HOME;
  if (!stateDir) {
    throw new Error("OPENCLAW_STATE_DIR is not configured.");
  }
  const agentDir = path.join(stateDir, "agents", "main", "agent");
  await mkdir(agentDir, { recursive: true });

  const [{ loginOpenAICodexDeviceCode }, authSdk, defaultModels] = await Promise.all([
    importOpenClaw("dist/extensions/openai/openai-chatgpt-device-code.js"),
    importOpenClaw("dist/plugin-sdk/provider-auth.js"),
    importOpenClaw("dist/extensions/openai/default-models.js").catch(() => ({}))
  ]);
  const defaultModel =
    typeof defaultModels.OPENAI_CODEX_DEFAULT_MODEL === "string"
      ? defaultModels.OPENAI_CODEX_DEFAULT_MODEL
      : FALLBACK_OPENAI_CODEX_DEFAULT_MODEL;
  const identityResolver =
    typeof authSdk.resolveOpenAICodexAuthIdentity === "function"
      ? authSdk.resolveOpenAICodexAuthIdentity
      : null;
  if (typeof loginOpenAICodexDeviceCode !== "function") {
    throw new Error("OpenClaw device-code auth is unavailable in this install.");
  }
  if (typeof authSdk.buildOauthProviderAuthResult !== "function" || typeof authSdk.upsertAuthProfileWithLock !== "function") {
    throw new Error("OpenClaw auth profile helpers are unavailable in this install.");
  }
  if (!identityResolver) {
    throw new Error("OpenClaw OpenAI identity helper is unavailable in this install.");
  }

  const creds = await loginOpenAICodexDeviceCode({
    onProgress: (message) => emit({ type: "progress", message }),
    onVerification: ({ verificationUrl, userCode, expiresInMs }) =>
      emit({ type: "verification", verificationUrl, userCode, expiresInMs })
  });
  const identity = resolveOpenAIIdentity(identityResolver, creds.access);
  const credentialExtra = {
    ...(identity && identity.accountId ? { accountId: identity.accountId } : {}),
    ...(identity && identity.chatgptPlanType ? { chatgptPlanType: identity.chatgptPlanType } : {})
  };
  const result = authSdk.buildOauthProviderAuthResult({
    providerId: "openai",
    defaultModel,
    configPatch: { agents: { defaults: { models: { [defaultModel]: {} } } } },
    access: creds.access,
    refresh: creds.refresh,
    expires: creds.expires,
    email: identity && identity.email ? identity.email : undefined,
    profileName: identity && identity.profileName ? identity.profileName : undefined,
    credentialExtra: Object.keys(credentialExtra).length > 0 ? credentialExtra : undefined
  });

  for (const profile of result.profiles || []) {
    const updated = await authSdk.upsertAuthProfileWithLock({
      profileId: profile.profileId,
      credential: profile.credential,
      agentDir
    });
    if (!updated) {
      throw new Error("OpenClaw auth profile store was busy. Try again.");
    }
  }

  await patchOpenClawConfig(defaultModel);
  emit({ type: "complete" });
}

main().catch((error) => {
  emit({ type: "error", message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
});
"""#

func jsonRecord(from object: [String: Any]) -> JSONRecord {
    object.mapValues(jsonValue(from:))
}

func jsonValue(from value: Any) -> JSONValue {
    if value is NSNull { return .null }
    if let string = value as? String { return .string(string) }
    if let bool = value as? Bool { return .bool(bool) }
    if let number = value as? NSNumber { return .number(number.doubleValue) }
    if let object = value as? [String: Any] { return .object(jsonRecord(from: object)) }
    if let array = value as? [Any] { return .array(array.map(jsonValue(from:))) }
    return .string(String(describing: value))
}

func removeLegacyHermesRuntimeOverrideKeys(from text: String) -> (text: String, removedCount: Int) {
    let hasTrailingNewline = text.hasSuffix("\n")
    let lines = text.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
    var cleaned: [String] = []
    var removedCount = 0
    var inTopLevelModelBlock = false

    for line in lines {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        let isBlank = trimmed.isEmpty
        let isComment = trimmed.hasPrefix("#")
        let isTopLevel = line.first.map { $0 != " " && $0 != "\t" } ?? true

        if isTopLevel && !isBlank && !isComment {
            inTopLevelModelBlock = trimmed == "model:" || trimmed.hasPrefix("model: ")
        }

        let isLegacyRuntimeKey = trimmed.hasPrefix("openai_runtime:") || trimmed.hasPrefix("api_mode:")
        let shouldRemove = isLegacyRuntimeKey && (isTopLevel || inTopLevelModelBlock)
        if shouldRemove {
            removedCount += 1
            continue
        }
        cleaned.append(line)
    }

    var output = cleaned.joined(separator: "\n")
    if hasTrailingNewline && !output.hasSuffix("\n") {
        output += "\n"
    }
    return (output, removedCount)
}

func parseDeviceAuthOutput(_ output: String) -> (url: String, code: String)? {
    let stripped = stripAnsi(output)
    let url = stripped.range(of: #"https://auth\.openai\.com/[A-Za-z0-9/_?.=&%-]+"#, options: .regularExpression).map { String(stripped[$0]) } ?? ""
    let code = stripped.range(of: #"\b[A-Z]{4}-[A-Z0-9]{4,8}\b"#, options: .regularExpression).map { String(stripped[$0]) }
        ?? stripped.range(of: #"\b[A-Z0-9]{4}-[A-Z0-9]{4,8}\b"#, options: .regularExpression).map { String(stripped[$0]) }
        ?? ""
    guard !url.isEmpty || !code.isEmpty else { return nil }
    return (url, code)
}

func parseOpenClawAuthEvent(_ output: String) -> JSONRecord? {
    let trimmed = output.trimmingCharacters(in: .whitespacesAndNewlines)
    guard trimmed.hasPrefix(openClawAuthEventPrefix) else { return nil }
    let payload = String(trimmed.dropFirst(openClawAuthEventPrefix.count))
    guard let event = parseJSONObject(from: payload),
          let type = stringValue(event["type"]),
          ["progress", "verification", "complete", "error"].contains(type)
    else {
        return nil
    }
    return event
}

func openClawAuthExpiresAt(_ event: JSONRecord) -> String {
    let defaultExpiresInMs = 15.0 * 60.0 * 1000.0
    let expiresInMs: Double
    if case .number(let value)? = event["expiresInMs"], value.isFinite, value > 0 {
        expiresInMs = value
    } else {
        expiresInMs = defaultExpiresInMs
    }
    return ISO8601DateFormatter.relayConsole.string(from: Date().addingTimeInterval(expiresInMs / 1000.0))
}

func stripAnsi(_ value: String) -> String {
    value.replacingOccurrences(of: #"\u001B\[[0-?]*[ -/]*[@-~]"#, with: "", options: .regularExpression)
}

func trimForStorage(_ value: String) -> String {
    String(value.trimmingCharacters(in: .whitespacesAndNewlines).prefix(4000))
}

func redactedTechnicalError(_ error: Error) -> String {
    trimForStorage(CommandOutputRedactor.redact(error.localizedDescription))
}

public func userFacingRuntimeFailureMessage(_ value: String, runtimeName: String) -> String {
    let trimmed = trimForStorage(CommandOutputRedactor.redact(value))
    let lowercased = trimmed.lowercased()
    let looksLikeHTML = lowercased.hasPrefix("<!doctype html")
        || lowercased.hasPrefix("<html")
        || (lowercased.contains("<head") && lowercased.contains("<body"))
    if looksLikeHTML {
        return "\(runtimeName) returned an unexpected web page instead of a runtime response. Check the runtime connection and try again."
    }
    return trimmed
}

func sqliteInt64(_ value: SQLiteValue?) -> Int64? {
    switch value {
    case .integer(let int): return int
    case .real(let double): return Int64(double)
    case .text(let text): return Int64(text)
    case .null, nil: return nil
    }
}

func humanizeHarnessError(_ value: String) -> String {
    let lower = value.lowercased()
    if lower.contains("permission") { return "Relay Console does not have permission to prepare the harness." }
    if lower.contains("network") || lower.contains("could not resolve") || lower.contains("timed out") { return "Relay Console could not download the harness. Check the network and try again." }
    return trimForStorage(value.isEmpty ? "Harness setup failed." : value)
}

func withToolPath(_ env: [String: String]) -> [String: String] {
    var copy = env
    copy["PATH"] = mergePath([
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/Applications/Codex.app/Contents/Resources",
        URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".local/bin").path,
        URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".cargo/bin").path
    ], existing: env["PATH"] ?? "")
    return copy
}

func mergePath(_ prefixes: [String], existing: String) -> String {
    var seen = Set<String>()
    var output: [String] = []
    for part in prefixes.filter({ !$0.isEmpty }) + existing.split(separator: ":").map(String.init) {
        if seen.insert(part).inserted {
            output.append(part)
        }
    }
    return output.joined(separator: ":")
}

func nodePlatformSpec() -> String? {
    #if arch(arm64)
    return "darwin-arm64"
    #elseif arch(x86_64)
    return "darwin-x64"
    #else
    return nil
    #endif
}

func uvPlatformSpec() -> String? {
    #if arch(arm64)
    return "aarch64-apple-darwin"
    #elseif arch(x86_64)
    return "x86_64-apple-darwin"
    #else
    return nil
    #endif
}

func openClawPnpmInstallArgs() -> [String] {
    [
        "install",
        "--frozen-lockfile",
        "--prefer-offline",
        "--reporter=append-only",
        "--network-concurrency=4",
        "--child-concurrency=2",
        "--fetch-retries=10",
        "--fetch-retry-mintimeout=10000",
        "--fetch-retry-maxtimeout=180000",
        "--fetch-timeout=600000"
    ]
}

func isRecoverableOpenClawDependencyInstallError(_ message: String) -> Bool {
    message.range(of: "ECONNRESET|ETIMEDOUT|ENOTFOUND|fetch failed|network|timeout|socket", options: [.regularExpression, .caseInsensitive]) != nil
}

func openClawAgentsListIncludes(_ output: String, slug: String) -> Bool {
    if let parsed = parseJSONValue(from: output),
       openClawAgentsListValueIncludes(parsed, slug: slug) {
        return true
    }
    let escaped = NSRegularExpression.escapedPattern(for: slug)
    return output.range(of: "(^|\\s)\(escaped)(\\s|$)", options: .regularExpression) != nil
}

private func openClawAgentsListValueIncludes(_ value: JSONValue, slug: String) -> Bool {
    switch value {
    case .array(let array):
        return array.contains { openClawAgentsListValueIncludes($0, slug: slug) }
    case .object(let object):
        let candidates = ["id", "agentId", "name", "slug"].compactMap { stringValue(object[$0]) }
        if candidates.contains(slug) { return true }
        for key in ["agents", "list", "items", "data"] {
            if let nested = object[key],
               openClawAgentsListValueIncludes(nested, slug: slug) {
                return true
            }
        }
        return false
    case .string(let value):
        return value == slug
    default:
        return false
    }
}

func hermesProfileSlug(for agent: AgentWithBinding) -> String {
    let raw = agent.binding.externalAgentId ?? agent.name
    let base = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
        .replacingOccurrences(of: #"[^a-z0-9_-]+"#, with: "-", options: .regularExpression)
        .replacingOccurrences(of: #"^[^a-z0-9]+"#, with: "", options: .regularExpression)
        .replacingOccurrences(of: #"[^a-z0-9]+$"#, with: "", options: .regularExpression)
    let safeBase = String((base.isEmpty ? "agent" : base).prefix(36))
    let suffix = String(agent.id.replacingOccurrences(of: #"[^a-z0-9]"#, with: "", options: .regularExpression).suffix(12))
    return String("relay-\(safeBase)-\(suffix.isEmpty ? "profile" : suffix)".prefix(63))
}

func openClawSlug(for agent: AgentWithBinding) -> String {
    let raw = agent.binding.externalAgentId ?? agent.name
    let slug = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
        .replacingOccurrences(of: #"[^a-z0-9_-]+"#, with: "-", options: .regularExpression)
        .replacingOccurrences(of: #"^[^a-z0-9]+"#, with: "", options: .regularExpression)
        .replacingOccurrences(of: #"[^a-z0-9]+$"#, with: "", options: .regularExpression)
    return String((slug.isEmpty ? "relay-agent" : slug).prefix(63))
}

func normalizeOpenClawAgentId(_ value: String) -> String {
    let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
        .replacingOccurrences(of: #"[^a-z0-9_-]+"#, with: "-", options: .regularExpression)
        .replacingOccurrences(of: #"^[^a-z0-9]+"#, with: "", options: .regularExpression)
        .replacingOccurrences(of: #"[^a-z0-9]+$"#, with: "", options: .regularExpression)
    return String((normalized.isEmpty ? "main" : normalized).prefix(64))
}

func sanitizeOpenClawSessionKey(_ value: String) -> String {
    let sanitized = value.replacingOccurrences(of: #"[^a-zA-Z0-9_.-]+"#, with: "-", options: .regularExpression)
    return String((sanitized.isEmpty ? "thread" : sanitized).prefix(120))
}

func buildOpenClawDispatchBody(_ input: RuntimeDispatchRequest) -> String {
    let prior = input.recentMessages.filter { $0.id != input.messageId }.suffix(20)
    if prior.isEmpty { return input.inputContent }
    let context = prior.map { message -> String in
        let speaker = message.senderType == .agent ? (message.senderName.isEmpty ? "Agent" : message.senderName) : (message.senderType == .user ? "User" : "System")
        return "\(speaker): \(message.content)"
    }.joined(separator: "\n\n")
    return ["[Relay Console thread context]", context, "", "[New user message]", input.inputContent].joined(separator: "\n")
}

let relayWorkflowDispatchInstruction = "Default to Relay Console workflow assistance across apps, files, messages, calendars, projects, and workspaces. Do not infer that the task is coding unless the user frames it that way."

func buildRelayHermesSoul(agent: AgentWithBinding) -> String {
    if isRelayConsoleResidentAgent(agent) {
        return buildRelayConsoleResidentSoul(agent: agent)
    }
    let role = agent.description?.trimmingCharacters(in: .whitespacesAndNewlines)
    let clause = role.map { ", with the role \"\($0)\"" } ?? ""
    return [
        "# \(agent.name)",
        "",
        "You are \(agent.name)\(clause), a Relay Console agent for moving personal, business, creative, operational, and technical work forward across apps, files, messages, calendars, projects, and workspaces.",
        "",
        "Do not assume the task is coding unless the user frames it that way; when a conversation starts, ask what outcome the user wants to move forward."
    ].joined(separator: "\n")
}

func buildLegacyRelayHermesSoul(agent: AgentWithBinding, profileSlug: String) -> String {
    let role = agent.description?.trimmingCharacters(in: .whitespacesAndNewlines) ?? "Relay Console Hermes agent."
    let external = agent.binding.externalAgentId ?? "not set"
    return [
        "# \(agent.name)",
        "",
        "You are \(agent.name).",
        "",
        "You are a Hermes agent running inside Relay Console. Treat this file as your persistent identity.",
        "",
        "## Identity",
        "",
        "- Name: \(agent.name)",
        "- Relay agent id: \(agent.id)",
        "- Hermes profile: \(profileSlug)",
        "- External agent id: \(external)",
        "- Role: \(role)"
    ].joined(separator: "\n")
}

func knownGeneratedHermesSouls(agent: AgentWithBinding, profileSlug: String) -> [String] {
    let values = [
        buildLegacyRelayHermesSoul(agent: agent, profileSlug: profileSlug),
        "You are a Relay Console Hermes agent. Use this profile as your persistent identity."
    ]
    return Array(Set(values.flatMap { [$0, "\($0)\n"] }))
}

func ensureRelayHermesSoul(agent: AgentWithBinding, profileSlug: String, identityFilePath: URL) throws {
    let next = buildRelayHermesSoul(agent: agent)
    if !FileManager.default.fileExists(atPath: identityFilePath.path) {
        try "\(next)\n".write(to: identityFilePath, atomically: true, encoding: .utf8)
        return
    }
    let current = (try? String(contentsOf: identityFilePath, encoding: .utf8)) ?? ""
    if knownGeneratedHermesSouls(agent: agent, profileSlug: profileSlug).contains(current) {
        try "\(next)\n".write(to: identityFilePath, atomically: true, encoding: .utf8)
    }
}

func buildHermesDispatchSystemMessage(agent: AgentWithBinding) -> String {
    [
        "You are \(agent.name).",
        agent.description.map { "Your role is: \($0)" },
        relayWorkflowDispatchInstruction,
        "Use your Relay Console agent identity, memories, sessions, skills, and state as context for this turn."
    ].compactMap { $0 }.joined(separator: "\n")
}

func normalizeHermesRuntimeFailure(_ message: String) -> NormalizedRuntimeFailure {
    let trimmed = userFacingRuntimeFailureMessage(
        message.isEmpty ? "Hermes Agent run failed." : message,
        runtimeName: "Hermes Agent"
    )
    if trimmed.range(of: "No LLM provider configured|provider configured|model configured", options: [.regularExpression, .caseInsensitive]) != nil {
        return NormalizedRuntimeFailure(category: "auth_required", message: "Sign in to OpenAI through Hermes Agent before it can reply.")
    }
    if isAuthError(trimmed) {
        return NormalizedRuntimeFailure(category: "auth_required", message: "Sign in to OpenAI through Hermes Agent again before it can reply.")
    }
    return NormalizedRuntimeFailure(category: "transport_error", message: trimmed.isEmpty ? "Hermes Agent stopped before replying." : trimmed)
}

func normalizeOpenClawRuntimeFailure(_ message: String) -> NormalizedRuntimeFailure {
    let trimmed = userFacingRuntimeFailureMessage(
        message.isEmpty ? "OpenClaw run failed." : message,
        runtimeName: "OpenClaw"
    )
    if isAuthError(trimmed) || trimmed.range(of: "no usable profile|not configured|models auth login|provider.*openai", options: [.regularExpression, .caseInsensitive]) != nil {
        return NormalizedRuntimeFailure(category: "auth_required", message: "Authenticate in OpenClaw, then re-check Relay Console before trying again.")
    }
    if trimmed.range(of: "timed out|timeout", options: [.regularExpression, .caseInsensitive]) != nil {
        return NormalizedRuntimeFailure(category: "dispatch_timeout", message: "OpenClaw took too long to respond.")
    }
    if isOpenClawAgentDatabaseOwnerMismatch(trimmed) {
        return NormalizedRuntimeFailure(category: "agent_state_mismatch", message: "OpenClaw agent state belongs to the wrong agent. Relay Console could not repair it automatically; retry after reopening Relay Console.")
    }
    if trimmed.range(of: "gateway|ECONNREFUSED|connection|socket|transport", options: [.regularExpression, .caseInsensitive]) != nil {
        return NormalizedRuntimeFailure(category: "transport_error", message: "OpenClaw gateway is not reachable. Start OpenClaw and try again.")
    }
    return NormalizedRuntimeFailure(category: "transport_error", message: trimmed.isEmpty ? "OpenClaw stopped before replying." : trimmed)
}

func isOpenClawAgentDatabaseOwnerMismatch(_ message: String) -> Bool {
    message.range(
        of: #"OpenClaw agent database .* belongs to agent .*; requested agent .*"#,
        options: [.regularExpression, .caseInsensitive]
    ) != nil
}

public enum RuntimeFailureClassifier {
    public static func isAuthenticationFailure(_ message: String) -> Bool {
        message.range(
            of: #"\b(?:auth|authentication|credentials?|tokens?|login|unauthorized|forbidden)\b|not\s+logged\s+in|sign[ -]?in"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil
    }
}

func isAuthError(_ message: String) -> Bool {
    RuntimeFailureClassifier.isAuthenticationFailure(message)
}

func extractOpenClawFinalText(_ value: JSONRecord?) -> String? {
    guard let value else { return nil }
    if case .object(let result)? = value["result"],
       case .array(let payloads)? = result["payloads"] {
        let text = payloads.compactMap { item -> String? in
            guard case .object(let object) = item else { return nil }
            return stringValue(object["text"])?.trimmingCharacters(in: .whitespacesAndNewlines)
        }.filter { !$0.isEmpty }.joined(separator: "\n\n")
        if !text.isEmpty { return text }
    }
    return stringValue(value["summary"])?.trimmingCharacters(in: .whitespacesAndNewlines)
}

func extractOpenClawResultMetadata(_ value: JSONRecord?) -> JSONRecord {
    guard let value else { return [:] }
    var metadata: JSONRecord = [:]
    if case .object(let explicit)? = value["metadata"] {
        metadata.merge(explicit) { _, new in new }
    }
    if case .object(let result)? = value["result"],
       case .object(let explicit)? = result["metadata"] {
        metadata.merge(explicit) { _, new in new }
    }
    if let references = value["documentReferences"] ?? value["references"] {
        metadata["documentReferences"] = references
    } else if case .object(let result)? = value["result"],
              let references = result["documentReferences"] ?? result["references"] {
        metadata["documentReferences"] = references
    }
    return metadata
}

func parseHermesRunnerEvent(_ line: String) -> JSONRecord? {
    let prefix = "RC_EVENT "
    guard line.hasPrefix(prefix) else { return nil }
    return parseJSONObject(from: String(line.dropFirst(prefix.count)))
}

func mapHermesRunnerType(_ raw: String?) -> RuntimeEventType {
    switch raw {
    case "dispatch.accepted": return .started
    case "run.started": return .started
    case "run.delta": return .delta
    case "run.tool": return .tool
    case "run.completed": return .completed
    case "run.failed": return .failed
    default: return .status
    }
}

final class HermesTerminalState: @unchecked Sendable {
    private let lock = NSLock()
    private(set) var terminal: RuntimeDispatchTerminalResult?

    func consume(_ event: JSONRecord) {
        lock.lock()
        defer { lock.unlock() }
        let type = stringValue(event["type"])
        if type == "run.completed" {
            var metadata: JSONRecord = ["harness": .string("hermes")]
            if case .object(let explicit)? = event["metadata"] {
                metadata.merge(explicit) { _, new in new }
            }
            if let references = event["documentReferences"] ?? event["references"] {
                metadata["documentReferences"] = references
            }
            terminal = RuntimeDispatchTerminalResult(status: "completed", finalText: stringValue(event["finalText"]) ?? "", contentFormat: .markdown, error: nil, metadata: metadata)
        } else if type == "run.failed" {
            let normalized = normalizeHermesRuntimeFailure(stringValue(event["message"]) ?? "Hermes Agent run failed.")
            terminal = failedResult(normalized.category, normalized.message)
        }
    }
}

let hermesCodexAuthStatusScript = """
import json
try:
    from hermes_cli.auth import get_codex_auth_status
    status = get_codex_auth_status()
    print(json.dumps(status if isinstance(status, dict) else {"logged_in": False}, ensure_ascii=True))
except Exception as error:
    print(json.dumps({"logged_in": False, "error": str(error)}, ensure_ascii=True))
    raise
"""

let hermesCodexModelSetupScript = """
import json
try:
    from hermes_cli.config import load_config, save_config
    from hermes_cli.auth import DEFAULT_CODEX_BASE_URL, _update_config_for_provider, get_codex_auth_status
    from hermes_cli.codex_models import get_codex_model_ids
    config = load_config()
    model_cfg = config.get("model") if isinstance(config.get("model"), dict) else {}
    current_model = str(model_cfg.get("default") or model_cfg.get("model") or "").strip()
    current_provider = str(model_cfg.get("provider") or "").strip()
    if current_model and current_provider == "openai-codex":
        selected = current_model
        config_path = None
    else:
        selected = ""
        try:
            status = get_codex_auth_status()
            token = status.get("api_key") if isinstance(status, dict) and status.get("logged_in") else None
            models = get_codex_model_ids(access_token=token)
            if models:
                selected = str(models[0]).strip()
        except Exception:
            selected = ""
        if not selected:
            import os
            selected = os.environ.get("RELAY_CONSOLE_HERMES_DEFAULT_MODEL", "").strip() or "gpt-5.5"
        config_path = _update_config_for_provider("openai-codex", DEFAULT_CODEX_BASE_URL, default_model=selected)
        config = load_config()
    model_cfg = config.get("model") if isinstance(config.get("model"), dict) else {}
    changed = False
    if isinstance(model_cfg, dict) and "openai_runtime" in model_cfg:
        model_cfg.pop("openai_runtime", None)
        changed = True
    if isinstance(model_cfg, dict) and "api_mode" in model_cfg:
        model_cfg.pop("api_mode", None)
        changed = True
    if "openai_runtime" in config:
        config.pop("openai_runtime", None)
        changed = True
    if changed:
        save_config(config)
    print(json.dumps({"configured": True, "provider": "openai-codex", "model": selected}, ensure_ascii=True))
except Exception as error:
    print(json.dumps({"configured": False, "error": str(error)}, ensure_ascii=True))
    raise
"""

let hermesProfileProvisionScript = """
import json, os, sys, traceback
payload = json.loads(os.environ.get("RELAY_CONSOLE_HERMES_PROFILE_PAYLOAD") or "{}")
try:
    profile_slug = str(payload["profileSlug"]).strip()
    soul = str(payload.get("soul") or "").strip()
    legacy_souls = [str(item) for item in (payload.get("legacySouls") or []) if isinstance(item, str)]
    description = str(payload.get("agentRole") or payload.get("agentName") or "").strip()
    from hermes_cli.profiles import create_profile, get_profile_dir, profile_exists, write_profile_meta
    existing_profile = profile_exists(profile_slug)
    if existing_profile:
        profile_dir = get_profile_dir(profile_slug)
    else:
        profile_dir = create_profile(profile_slug, no_alias=True, description=description or None)
    for subdir in ("memories", "sessions", "skills", "skins", "logs", "plans", "workspace", "cron", "home"):
        (profile_dir / subdir).mkdir(parents=True, exist_ok=True)
    if description:
        try:
            write_profile_meta(profile_dir, description=description, description_auto=False)
        except Exception:
            pass
    identity_path = profile_dir / "SOUL.md"
    if soul:
        should_write = not existing_profile or not identity_path.exists()
        if identity_path.exists() and not should_write:
            should_write = identity_path.read_text(encoding="utf-8") in legacy_souls
        if should_write:
            identity_path.write_text(soul + "\\n", encoding="utf-8")
    elif not identity_path.exists():
        identity_path.write_text("You are a Relay Console Hermes agent. Use this profile as your persistent identity.\\n", encoding="utf-8")
    marker_path = profile_dir / ".relay-console-profile.json"
    marker_path.write_text(json.dumps({
        "schemaVersion": 1,
        "agentId": str(payload.get("agentId") or ""),
        "profileSlug": profile_slug,
        "managedBy": "Relay Console"
    }, indent=2, sort_keys=True) + "\\n", encoding="utf-8")
    print(json.dumps({"profileSlug": profile_slug, "profileHomePath": str(profile_dir), "identityFilePath": str(identity_path), "stateDbPath": str(profile_dir / "state.db")}, ensure_ascii=True))
except Exception as error:
    print(json.dumps({"error": str(error), "trace": traceback.format_exc(limit=4)}, ensure_ascii=True))
    sys.exit(1)
"""

let hermesRunnerScript = """
import json, os, sys, traceback
PREFIX = "RC_EVENT "
def emit(payload):
    print(PREFIX + json.dumps(payload, ensure_ascii=True), flush=True)
payload = json.loads(sys.stdin.read() or "{}")
hermes_agent_path = payload["hermesAgentPath"]
sys.path.insert(0, hermes_agent_path)
os.environ["HERMES_HOME"] = payload["hermesHome"]
workspace_root = payload.get("workspaceRoot")
old_cwd = os.getcwd()
try:
    if workspace_root:
        os.chdir(workspace_root)
    from run_agent import AIAgent
    try:
        from hermes_state import SessionDB
        session_db = SessionDB()
    except Exception:
        session_db = None
    emit({"type": "dispatch.accepted", "dispatchId": payload["dispatchId"]})
    emit({"type": "run.started", "dispatchId": payload["dispatchId"]})
    def emit_delta(text):
        if text:
            emit({"type": "run.delta", "dispatchId": payload["dispatchId"], "text": text})
    def emit_tool(name, preview, _args=None):
        emit({"type": "run.tool", "dispatchId": payload["dispatchId"], "status": str(name or ""), "text": str(preview or "")})
    agent = AIAgent(model=payload.get("model") or None, api_mode=payload.get("apiMode") or None, quiet_mode=True, verbose_logging=False, session_id=payload["runtimeSessionId"], stream_delta_callback=emit_delta, \
    tool_progress_callback=emit_tool, disabled_toolsets=payload.get("disabledToolsets") or [], platform="relay_console", skip_memory=False, session_db=session_db, thread_id=payload.get("threadId") or None, \
    gateway_session_key=payload.get("runtimeSessionId") or None, load_soul_identity=True, pass_session_id=True)
    result = agent.run_conversation(user_message=payload["inputText"], system_message=payload.get("systemMessage") or None, conversation_history=payload.get("conversationHistory") or [])
    if result.get("interrupted"):
        emit({"type": "run.failed", "dispatchId": payload["dispatchId"], "message": "Hermes Agent run was interrupted."})
    elif result.get("completed"):
        emit({"type": "run.completed", "dispatchId": payload["dispatchId"], "finalText": result.get("final_response") or ""})
    else:
        emit({"type": "run.failed", "dispatchId": payload["dispatchId"], "message": result.get("error") or result.get("final_response") or "Hermes Agent run failed."})
except Exception as error:
    emit({"type": "run.failed", "dispatchId": payload.get("dispatchId"), "message": str(error), "trace": traceback.format_exc(limit=4)})
    sys.exit(1)
finally:
    os.chdir(old_cwd)
"""
