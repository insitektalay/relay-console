import Foundation

struct XHermesRuntimeInstallResult: Sendable {
    var skillPath: String
    var legacyEnvCleanupPath: String?
}

struct XOpenClawRuntimeInstallResult: Sendable {
    var workspaceSkillPath: String
    var agentSkillPath: String
    var legacyEnvCleanupPaths: [String]
}

struct XRuntimeRemovalResult: Sendable {
    var removedPaths: [String]
    var envPaths: [String]
}

enum XHermesRuntimeInstaller {
    static let appSlug = "x"
    static let consumerKeyEnvKey = "X_CONSUMER_KEY"
    static let consumerSecretEnvKey = "X_CONSUMER_SECRET"
    static let accessTokenEnvKey = "X_ACCESS_TOKEN"
    static let accessTokenSecretEnvKey = "X_ACCESS_TOKEN_SECRET"
    static let bearerTokenEnvKey = "X_BEARER_TOKEN"
    static let requiredEnvKeys = [
        consumerKeyEnvKey,
        consumerSecretEnvKey,
        accessTokenEnvKey,
        accessTokenSecretEnvKey
    ]
    static let allEnvKeys = requiredEnvKeys + [bearerTokenEnvKey]
    static let skillRelativePath = "skills/social/x/SKILL.md"

    static func install(into agent: AgentWithBinding) throws -> XHermesRuntimeInstallResult {
        guard agent.binding.runtimeType == .hermes else {
            throw RelayError(.invalidInput, "X can only be installed into Hermes agent profiles.")
        }
        guard let homePath = agent.binding.hermesHomePath?.nilIfBlank else {
            throw RelayError(.invalidInput, "Hermes profile home is missing for \(agent.name).")
        }
        let homeURL = URL(fileURLWithPath: homePath, isDirectory: true)
        let skillURL = homeURL.appendingPathComponent(skillRelativePath)
        try writeXSkill(to: skillURL)

        let envURL = homeURL.appendingPathComponent(".env")
        let removedLegacyEnv = try removeXEnvKeys(envURL: envURL)
        return XHermesRuntimeInstallResult(
            skillPath: skillURL.path,
            legacyEnvCleanupPath: removedLegacyEnv ? envURL.path : nil
        )
    }

    @discardableResult
    static func repairSkillFile(in agent: AgentWithBinding) throws -> Bool {
        guard agent.binding.runtimeType == .hermes else {
            throw RelayError(.invalidInput, "X can only repair Hermes agent profiles.")
        }
        guard let homePath = agent.binding.hermesHomePath?.nilIfBlank else {
            throw RelayError(.invalidInput, "Hermes profile home is missing for \(agent.name).")
        }
        let skillURL = URL(fileURLWithPath: homePath, isDirectory: true).appendingPathComponent(skillRelativePath)
        return try writeXSkillIfNeeded(to: skillURL)
    }

    @discardableResult
    static func repairInstall(into agent: AgentWithBinding) throws -> Bool {
        guard agent.binding.runtimeType == .hermes else {
            throw RelayError(.invalidInput, "X can only repair Hermes agent profiles.")
        }
        guard let homePath = agent.binding.hermesHomePath?.nilIfBlank else {
            throw RelayError(.invalidInput, "Hermes profile home is missing for \(agent.name).")
        }
        let homeURL = URL(fileURLWithPath: homePath, isDirectory: true)
        let skillChanged = try writeXSkillIfNeeded(to: homeURL.appendingPathComponent(skillRelativePath))
        let envChanged = try removeXEnvKeys(envURL: homeURL.appendingPathComponent(".env"))
        return skillChanged || envChanged
    }

    static func uninstall(from agent: AgentWithBinding) throws -> XRuntimeRemovalResult {
        guard agent.binding.runtimeType == .hermes else {
            throw RelayError(.invalidInput, "X can only be removed from Hermes agent profiles.")
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
        let envChanged = try removeXEnvKeys(envURL: envURL)
        return XRuntimeRemovalResult(removedPaths: removedPaths, envPaths: envChanged ? [envURL.path] : [])
    }

    static let xSkillMarkdown = """
    ---
    name: x
    description: Use when the user asks to inspect the connected X account, list its recent original Posts, draft plain text, or intentionally publish through Relay's provider action broker.
    compatibility:
      requires_internet: true
      required_environment_variables: []
      optional_environment_variables: []
    ---

    # X

    Use X only through the four registered Relay wrapper tools. Relay-owned OAuth credentials stay behind the Railway/Keychain-backed provider connection and are resolved by the provider action broker, not by agent environment variables.

    ## Runtime Boundary

    Do not look for, request, print, reveal, summarize, or log X credentials. If a wrapper tool reports missing connection state, ask the user to reconnect X in Relay Console instead of asking them to paste credentials.

    ## What You Can Do

    - `relay_x_get_account`: read bounded identity for the connected account.
    - `relay_x_list_own_posts`: list at most ten recent original Posts, excluding replies and reposts.
    - `relay_x_draft_text_post`: prepare a local plain-text draft without an X API call.
    - `relay_x_publish_text_post`: publish one original plain-text Post with AI disclosure through Relay policy.

    ## Approval Gate

    Publishing is an external side effect. Use approval unless the user deliberately assigned Direct writes. Direct writes still routes through the Relay wrapper, broker, adapter, idempotency, and audit boundary.

    When approval is missing, draft the text or payload and ask for approval instead of calling the write endpoint.

    ## Cost Awareness

    X API usage consumes Relay-owned pay-per-use credits. Keep reads narrow, never poll or paginate, and avoid duplicate calls. V1 rejects URLs because X prices URL-bearing creation separately.

    ## API Notes

    Replies, mentions, search, arbitrary/home timelines, engagement, DMs, follows, likes/reposts, media, URLs, polls, geo, communities, edit/delete, bulk/scheduled publishing, raw API access, and browser automation are \
    unavailable. Do not ask for broader scopes or credentials and do not route X API traffic outside Relay's Railway-backed OAuth boundary.
    """
}

enum XOpenClawRuntimeInstaller {
    static let skillRelativePath = "skills/x/SKILL.md"

    static func install(into agent: AgentWithBinding) throws -> XOpenClawRuntimeInstallResult {
        guard agent.binding.runtimeType == .openclaw else {
            throw RelayError(.invalidInput, "X can only be installed into OpenClaw agents by the OpenClaw installer.")
        }
        guard let agentDirPath = agent.binding.config["openclawAgentDir"]?.string?.nilIfBlank else {
            throw RelayError(.invalidInput, "OpenClaw agent state is missing for \(agent.name). Provision the OpenClaw agent before installing X.")
        }
        let agentDir = URL(fileURLWithPath: agentDirPath, isDirectory: true)
        let agentSkillURL = agentDir.appendingPathComponent(skillRelativePath)
        try writeXSkill(to: agentSkillURL)

        let workspaceURL = openClawWorkspaceDir(for: agent, agentDir: agentDir)
        let workspaceSkillURL = workspaceURL.appendingPathComponent(skillRelativePath)
        try writeXSkill(to: workspaceSkillURL)

        let agentEnvURL = agentDir.appendingPathComponent(".env")
        let sharedEnvURL = openClawStateDir(for: agent, agentDir: agentDir).appendingPathComponent(".env")
        var cleanupPaths: [String] = []
        if try removeXEnvKeys(envURL: agentEnvURL) {
            cleanupPaths.append(agentEnvURL.path)
        }
        if try removeXEnvKeys(envURL: sharedEnvURL) {
            cleanupPaths.append(sharedEnvURL.path)
        }
        return XOpenClawRuntimeInstallResult(
            workspaceSkillPath: workspaceSkillURL.path,
            agentSkillPath: agentSkillURL.path,
            legacyEnvCleanupPaths: cleanupPaths
        )
    }

    @discardableResult
    static func repairSkillFiles(in agent: AgentWithBinding) throws -> Bool {
        guard agent.binding.runtimeType == .openclaw else {
            throw RelayError(.invalidInput, "X can only repair OpenClaw agents.")
        }
        guard let agentDirPath = agent.binding.config["openclawAgentDir"]?.string?.nilIfBlank else {
            throw RelayError(.invalidInput, "OpenClaw agent state is missing for \(agent.name).")
        }
        let agentDir = URL(fileURLWithPath: agentDirPath, isDirectory: true)
        let agentSkillURL = agentDir.appendingPathComponent(skillRelativePath)
        let workspaceSkillURL = openClawWorkspaceDir(for: agent, agentDir: agentDir).appendingPathComponent(skillRelativePath)
        let repairedAgentSkill = try writeXSkillIfNeeded(to: agentSkillURL)
        let repairedWorkspaceSkill = try writeXSkillIfNeeded(to: workspaceSkillURL)
        return repairedAgentSkill || repairedWorkspaceSkill
    }

    @discardableResult
    static func repairInstall(into agent: AgentWithBinding) throws -> Bool {
        guard agent.binding.runtimeType == .openclaw else {
            throw RelayError(.invalidInput, "X can only repair OpenClaw agents.")
        }
        guard let agentDirPath = agent.binding.config["openclawAgentDir"]?.string?.nilIfBlank else {
            throw RelayError(.invalidInput, "OpenClaw agent state is missing for \(agent.name).")
        }
        let agentDir = URL(fileURLWithPath: agentDirPath, isDirectory: true)
        let agentSkillChanged = try writeXSkillIfNeeded(to: agentDir.appendingPathComponent(skillRelativePath))
        let workspaceSkillChanged = try writeXSkillIfNeeded(
            to: openClawWorkspaceDir(for: agent, agentDir: agentDir).appendingPathComponent(skillRelativePath)
        )
        let agentEnvChanged = try removeXEnvKeys(envURL: agentDir.appendingPathComponent(".env"))
        let sharedEnvChanged = try removeXEnvKeys(
            envURL: openClawStateDir(for: agent, agentDir: agentDir).appendingPathComponent(".env")
        )
        return agentSkillChanged || workspaceSkillChanged || agentEnvChanged || sharedEnvChanged
    }

    static func uninstall(from agent: AgentWithBinding) throws -> XRuntimeRemovalResult {
        guard agent.binding.runtimeType == .openclaw else {
            throw RelayError(.invalidInput, "X can only be removed from OpenClaw agents.")
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
        if try removeXEnvKeys(envURL: agentEnvURL) {
            envPaths.append(agentEnvURL.path)
        }
        if try removeXEnvKeys(envURL: sharedEnvURL) {
            envPaths.append(sharedEnvURL.path)
        }
        return XRuntimeRemovalResult(removedPaths: removedPaths, envPaths: envPaths)
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

private func writeXSkill(to skillURL: URL) throws {
    try FileManager.default.createDirectory(at: skillURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    try XHermesRuntimeInstaller.xSkillMarkdown.write(to: skillURL, atomically: true, encoding: .utf8)
}

@discardableResult
private func writeXSkillIfNeeded(to skillURL: URL) throws -> Bool {
    if FileManager.default.fileExists(atPath: skillURL.path),
       let existing = try? String(contentsOf: skillURL, encoding: .utf8),
       existing == XHermesRuntimeInstaller.xSkillMarkdown {
        return false
    }
    try writeXSkill(to: skillURL)
    return true
}

private func removeXEnvKeys(envURL: URL) throws -> Bool {
    let fileManager = FileManager.default
    guard fileManager.fileExists(atPath: envURL.path) else {
        return false
    }
    let existing = try String(contentsOf: envURL, encoding: .utf8)
    let keys = Set(XHermesRuntimeInstaller.allEnvKeys)
    let lines = existing
        .split(separator: "\n", omittingEmptySubsequences: false)
        .map(String.init)
    let filtered = lines.filter { line in
        !keys.contains(where: { key in line.hasPrefix("\(key)=") })
    }
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
