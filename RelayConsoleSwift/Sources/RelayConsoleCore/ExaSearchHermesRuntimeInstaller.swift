import Foundation

struct ExaSearchHermesRuntimeInstallResult: Sendable {
    var skillPath: String
    var legacyEnvCleanupPath: String?
}

struct ExaSearchOpenClawRuntimeInstallResult: Sendable {
    var workspaceSkillPath: String
    var agentSkillPath: String
    var legacyEnvCleanupPaths: [String]
}

struct ExaSearchRuntimeRemovalResult: Sendable {
    var removedPaths: [String]
    var envPaths: [String]
}

enum ExaSearchHermesRuntimeInstaller {
    static let appSlug = "exa-search"
    static let envKey = "EXA_API_KEY"
    static let skillRelativePath = "skills/research/exa-search/SKILL.md"

    static func install(apiKey: String, into agent: AgentWithBinding) throws -> ExaSearchHermesRuntimeInstallResult {
        guard agent.binding.runtimeType == .hermes else {
            throw RelayError(.invalidInput, "Exa Search can only be installed into Hermes agent profiles.")
        }
        guard let homePath = agent.binding.hermesHomePath?.nilIfBlank else {
            throw RelayError(.invalidInput, "Hermes profile home is missing for \(agent.name).")
        }
        let trimmedKey = try requireNonEmptyString(apiKey, field: "Exa API key", maxLength: 10000)
        let homeURL = URL(fileURLWithPath: homePath, isDirectory: true)
        let skillURL = homeURL.appendingPathComponent(skillRelativePath)
        try writeExaSearchSkill(to: skillURL)
        let envURL = homeURL.appendingPathComponent(".env")
        _ = trimmedKey
        let envChanged = try removeExaSearchEnvKey(envURL: envURL, key: envKey)
        return ExaSearchHermesRuntimeInstallResult(
            skillPath: skillURL.path,
            legacyEnvCleanupPath: envChanged ? envURL.path : nil
        )
    }

    @discardableResult
    static func repairSkillFile(in agent: AgentWithBinding) throws -> Bool {
        guard agent.binding.runtimeType == .hermes else {
            throw RelayError(.invalidInput, "Exa Search can only repair Hermes agent profiles.")
        }
        guard let homePath = agent.binding.hermesHomePath?.nilIfBlank else {
            throw RelayError(.invalidInput, "Hermes profile home is missing for \(agent.name).")
        }
        let homeURL = URL(fileURLWithPath: homePath, isDirectory: true)
        let skillChanged = try writeExaSearchSkillIfNeeded(to: homeURL.appendingPathComponent(skillRelativePath))
        let envChanged = try removeExaSearchEnvKey(envURL: homeURL.appendingPathComponent(".env"), key: envKey)
        return skillChanged || envChanged
    }

    static func uninstall(from agent: AgentWithBinding) throws -> ExaSearchRuntimeRemovalResult {
        guard agent.binding.runtimeType == .hermes else {
            throw RelayError(.invalidInput, "Exa Search can only be removed from Hermes agent profiles.")
        }
        guard let homePath = agent.binding.hermesHomePath?.nilIfBlank else {
            throw RelayError(.invalidInput, "Hermes profile home is missing for \(agent.name).")
        }
        let fileManager = FileManager.default
        let homeURL = URL(fileURLWithPath: homePath, isDirectory: true)
        let skillURL = homeURL.appendingPathComponent(skillRelativePath)
        let envURL = homeURL.appendingPathComponent(".env")
        var removedPaths: [String] = []
        if fileManager.fileExists(atPath: skillURL.path) {
            try fileManager.removeItem(at: skillURL)
            removedPaths.append(skillURL.path)
        }
        let envChanged = try removeExaSearchEnvKey(envURL: envURL, key: envKey)
        return ExaSearchRuntimeRemovalResult(
            removedPaths: removedPaths,
            envPaths: envChanged ? [envURL.path] : []
        )
    }

    static let exaSearchSkillMarkdown = """
    ---
    name: exa-search
    description: Use when the user asks for web search, recent information, source-backed research, or page-content extraction through Exa Search.
    compatibility:
      requires_internet: true
      required_environment_variables: []
    ---

    # Exa Search

    Use Exa Search only through Relay provider wrapper tools. The user's Exa API key stays in Relay's Keychain-backed provider connection and is resolved by the provider action broker, not by agent environment variables.

    ## Search

    Prefer Relay wrapper tools for focused web searches. Request a small number of results first and cite the source URLs you use.

    ## Contents

    Use Relay wrapper tools for page-content lookup when the user gives specific URLs or when search results need deeper extraction. Always report which URLs were used.

    ## Rules

    - If a wrapper tool reports missing connection state, ask the user to reconnect Exa Search in Relay Console.
    - Do not ask the user to paste the key into chat.
    - Do not look for, request, print, reveal, summarize, or log Exa credentials.
    - Keep requests narrow and include source URLs in the answer.
    - For news, prices, legal, medical, financial, product, or other changeable topics, verify current information before answering.
    """
}

enum ExaSearchOpenClawRuntimeInstaller {
    static let skillRelativePath = "skills/exa-search/SKILL.md"

    static func install(apiKey: String, into agent: AgentWithBinding) throws -> ExaSearchOpenClawRuntimeInstallResult {
        guard agent.binding.runtimeType == .openclaw else {
            throw RelayError(.invalidInput, "Exa Search can only be installed into OpenClaw agents by the OpenClaw installer.")
        }
        guard let agentDirPath = agent.binding.config["openclawAgentDir"]?.string?.nilIfBlank else {
            throw RelayError(.invalidInput, "OpenClaw agent state is missing for \(agent.name). Provision the OpenClaw agent before installing Exa Search.")
        }
        let trimmedKey = try requireNonEmptyString(apiKey, field: "Exa API key", maxLength: 10000)
        let agentDir = URL(fileURLWithPath: agentDirPath, isDirectory: true)
        let agentSkillURL = agentDir.appendingPathComponent(skillRelativePath)
        try writeExaSearchSkill(to: agentSkillURL)

        let workspaceURL = openClawWorkspaceDir(for: agent, agentDir: agentDir)
        let workspaceSkillURL = workspaceURL.appendingPathComponent(skillRelativePath)
        try writeExaSearchSkill(to: workspaceSkillURL)

        let agentEnvURL = agentDir.appendingPathComponent(".env")
        let sharedEnvURL = openClawStateDir(for: agent, agentDir: agentDir).appendingPathComponent(".env")
        _ = trimmedKey
        var cleanupPaths: [String] = []
        if try removeExaSearchEnvKey(envURL: agentEnvURL, key: ExaSearchHermesRuntimeInstaller.envKey) {
            cleanupPaths.append(agentEnvURL.path)
        }
        if try removeExaSearchEnvKey(envURL: sharedEnvURL, key: ExaSearchHermesRuntimeInstaller.envKey) {
            cleanupPaths.append(sharedEnvURL.path)
        }
        return ExaSearchOpenClawRuntimeInstallResult(
            workspaceSkillPath: workspaceSkillURL.path,
            agentSkillPath: agentSkillURL.path,
            legacyEnvCleanupPaths: cleanupPaths
        )
    }

    @discardableResult
    static func repairSkillFiles(in agent: AgentWithBinding) throws -> Bool {
        guard agent.binding.runtimeType == .openclaw else {
            throw RelayError(.invalidInput, "Exa Search can only repair OpenClaw agents.")
        }
        guard let agentDirPath = agent.binding.config["openclawAgentDir"]?.string?.nilIfBlank else {
            throw RelayError(.invalidInput, "OpenClaw agent state is missing for \(agent.name).")
        }
        let agentDir = URL(fileURLWithPath: agentDirPath, isDirectory: true)
        let agentSkillURL = agentDir.appendingPathComponent(skillRelativePath)
        let workspaceSkillURL = openClawWorkspaceDir(for: agent, agentDir: agentDir).appendingPathComponent(skillRelativePath)
        let repairedAgentSkill = try writeExaSearchSkillIfNeeded(to: agentSkillURL)
        let repairedWorkspaceSkill = try writeExaSearchSkillIfNeeded(to: workspaceSkillURL)
        let agentEnvChanged = try removeExaSearchEnvKey(envURL: agentDir.appendingPathComponent(".env"), key: ExaSearchHermesRuntimeInstaller.envKey)
        let sharedEnvChanged = try removeExaSearchEnvKey(
            envURL: openClawStateDir(for: agent, agentDir: agentDir).appendingPathComponent(".env"),
            key: ExaSearchHermesRuntimeInstaller.envKey
        )
        return repairedAgentSkill || repairedWorkspaceSkill || agentEnvChanged || sharedEnvChanged
    }

    static func uninstall(from agent: AgentWithBinding) throws -> ExaSearchRuntimeRemovalResult {
        guard agent.binding.runtimeType == .openclaw else {
            throw RelayError(.invalidInput, "Exa Search can only be removed from OpenClaw agents.")
        }
        guard let agentDirPath = agent.binding.config["openclawAgentDir"]?.string?.nilIfBlank else {
            throw RelayError(.invalidInput, "OpenClaw agent state is missing for \(agent.name).")
        }
        let fileManager = FileManager.default
        let agentDir = URL(fileURLWithPath: agentDirPath, isDirectory: true)
        let agentSkillURL = agentDir.appendingPathComponent(skillRelativePath)
        let workspaceSkillURL = openClawWorkspaceDir(for: agent, agentDir: agentDir).appendingPathComponent(skillRelativePath)
        let agentEnvURL = agentDir.appendingPathComponent(".env")
        let sharedEnvURL = openClawStateDir(for: agent, agentDir: agentDir).appendingPathComponent(".env")
        var removedPaths: [String] = []
        for skillURL in [agentSkillURL, workspaceSkillURL] where fileManager.fileExists(atPath: skillURL.path) {
            try fileManager.removeItem(at: skillURL)
            removedPaths.append(skillURL.path)
        }
        var envPaths: [String] = []
        if try removeExaSearchEnvKey(envURL: agentEnvURL, key: ExaSearchHermesRuntimeInstaller.envKey) {
            envPaths.append(agentEnvURL.path)
        }
        if try removeExaSearchEnvKey(envURL: sharedEnvURL, key: ExaSearchHermesRuntimeInstaller.envKey) {
            envPaths.append(sharedEnvURL.path)
        }
        return ExaSearchRuntimeRemovalResult(removedPaths: removedPaths, envPaths: envPaths)
    }

    private static func openClawWorkspaceDir(for agent: AgentWithBinding, agentDir: URL) -> URL {
        if let workspacePath = agent.binding.workspaceFolderPath?.nilIfBlank {
            return URL(fileURLWithPath: workspacePath, isDirectory: true)
        }
        if let configuredWorkspacePath = agent.binding.config["openclawWorkspacePath"]?.string?.nilIfBlank {
            return URL(fileURLWithPath: configuredWorkspacePath, isDirectory: true)
        }
        return openClawStateDir(for: agent, agentDir: agentDir)
            .appendingPathComponent("workspace-\(openClawSlug(for: agent))", isDirectory: true)
    }

    private static func openClawStateDir(for agent: AgentWithBinding, agentDir: URL) -> URL {
        if let stateDir = agent.binding.config["openclawStateDir"]?.string?.nilIfBlank {
            return URL(fileURLWithPath: stateDir, isDirectory: true)
        }
        return agentDir
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
    }
}

private func writeExaSearchSkill(to skillURL: URL) throws {
    try FileManager.default.createDirectory(at: skillURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    try ExaSearchHermesRuntimeInstaller.exaSearchSkillMarkdown.write(to: skillURL, atomically: true, encoding: .utf8)
}

@discardableResult
private func writeExaSearchSkillIfNeeded(to skillURL: URL) throws -> Bool {
    if FileManager.default.fileExists(atPath: skillURL.path),
       let existing = try? String(contentsOf: skillURL, encoding: .utf8),
       existing == ExaSearchHermesRuntimeInstaller.exaSearchSkillMarkdown {
        return false
    }
    try writeExaSearchSkill(to: skillURL)
    return true
}

private func updateExaSearchEnvFile(envURL: URL, key: String, value: String) throws {
    let fileManager = FileManager.default
    try fileManager.createDirectory(at: envURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    let existing: String
    if fileManager.fileExists(atPath: envURL.path) {
        existing = try String(contentsOf: envURL, encoding: .utf8)
    } else {
        existing = ""
    }
    var lines = existing
        .split(separator: "\n", omittingEmptySubsequences: false)
        .map(String.init)
        .filter { !$0.hasPrefix("\(key)=") }
    if lines.last == "" {
        lines.removeLast()
    }
    lines.append("\(key)=\(value)")
    let updated = lines.joined(separator: "\n") + "\n"
    try updated.write(to: envURL, atomically: true, encoding: .utf8)
    try fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: envURL.path)
}

private func removeExaSearchEnvKey(envURL: URL, key: String) throws -> Bool {
    let fileManager = FileManager.default
    guard fileManager.fileExists(atPath: envURL.path) else {
        return false
    }
    let existing = try String(contentsOf: envURL, encoding: .utf8)
    let lines = existing
        .split(separator: "\n", omittingEmptySubsequences: false)
        .map(String.init)
    let filtered = lines.filter { !$0.hasPrefix("\(key)=") }
    guard filtered.count != lines.count else {
        return false
    }
    let updated = filtered.joined(separator: "\n")
    try (updated.isEmpty ? "" : updated + "\n").write(to: envURL, atomically: true, encoding: .utf8)
    try fileManager.setAttributes([.posixPermissions: 0o600], ofItemAtPath: envURL.path)
    return true
}

private extension String {
    var nilIfBlank: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
