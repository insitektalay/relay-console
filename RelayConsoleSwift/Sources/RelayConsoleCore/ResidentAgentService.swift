import Foundation

public struct ResidentAgentBootstrapResult: Sendable, Equatable {
    public var agent: AgentWithBinding?
    public var thread: ThreadDetail?
    public var status: String
    public var message: String
}

public final class ResidentAgentService {
    public static let displayName = "Relay Console"
    public static let externalAgentId = "relay_console"
    public static let metadataKey = "residentAgent"

    private let data: LocalDataService
    private let chat: ChatService
    private let provisioning: AgentProvisioningService
    private let harnessInstall: HarnessInstallManager
    private let runtimeWorkspace: RuntimeWorkspaceService

    public init(
        data: LocalDataService,
        chat: ChatService,
        provisioning: AgentProvisioningService,
        harnessInstall: HarnessInstallManager,
        runtimeWorkspace: RuntimeWorkspaceService
    ) {
        self.data = data
        self.chat = chat
        self.provisioning = provisioning
        self.harnessInstall = harnessInstall
        self.runtimeWorkspace = runtimeWorkspace
    }

    @discardableResult
    public func ensureDefaultResidentAgent(
        workspaceId: RelayId,
        requestedByProfileId: RelayId?
    ) async throws -> ResidentAgentBootstrapResult {
        if let existing = try existingResidentAgent(workspaceId: workspaceId) {
            try seedResidentFilesIfNeeded(for: existing)
            let thread = try chat.createOrReuseDirectThread(
                context: context(workspaceId: workspaceId, profileId: requestedByProfileId),
                selectedAgentId: existing.id,
                title: Self.displayName
            )
            try remember(status: "ready", message: "Resident Relay Console agent is ready.", agentId: existing.id, threadId: thread.id)
            return ResidentAgentBootstrapResult(agent: existing, thread: thread, status: "ready", message: "Resident Relay Console agent is ready.")
        }

        guard let record = try harnessInstall.listRecords().first(where: {
            $0.harnessKey == .hermes
                && $0.lifecycleState == .connected
                && $0.modelAuthStatus == .connected
                && $0.harnessId != nil
        }), let harnessId = record.harnessId else {
            try remember(status: "pending_harness", message: "Resident Relay Console agent is waiting for a connected Hermes Agent harness.")
            return ResidentAgentBootstrapResult(agent: nil, thread: nil, status: "pending_harness", message: "Resident Relay Console agent is waiting for a connected Hermes Agent harness.")
        }

        let result = try await provisioning.createProvisionedAgent(CreateProvisionedAgentRequest(
            workspaceId: workspaceId,
            requestedByProfileId: requestedByProfileId,
            harnessId: harnessId,
            runtimeType: .hermes,
            name: Self.displayName,
            role: residentRole,
            externalAgentId: Self.externalAgentId,
            workspaceFolderPath: nil,
            config: residentConfig,
            filesMetadata: [
                "seededInstructionFiles": .array(["soul.md", "agents.md", "tools.md"].map(JSONValue.string)),
                "seededMemoryFiles": .array(["memories/memory.md"].map(JSONValue.string)),
                "seededSkillPackages": .array(["agent-markdown-editor", "agent-team-builder", "relay-console-onboarding", "connect-google-docs"].map(JSONValue.string))
            ]
        ))
        let agent = result.agent
        try seedResidentFilesIfNeeded(for: agent)
        let thread = try chat.createOrReuseDirectThread(
            context: context(workspaceId: workspaceId, profileId: requestedByProfileId),
            selectedAgentId: agent.id,
            title: Self.displayName
        )
        try remember(status: "ready", message: "Resident Relay Console agent was created.", agentId: agent.id, threadId: thread.id)
        return ResidentAgentBootstrapResult(agent: agent, thread: thread, status: "ready", message: "Resident Relay Console agent was created.")
    }

    public func existingResidentAgent(workspaceId: RelayId) throws -> AgentWithBinding? {
        try data.listAgents(workspaceId: workspaceId).first { agent in
            agent.binding.runtimeType == .hermes
                && agent.binding.externalAgentId == Self.externalAgentId
                && agent.binding.config[Self.metadataKey] == .bool(true)
        }
    }

    private var residentConfig: JSONRecord {
        [
            Self.metadataKey: .bool(true),
            "residentAgentKind": .string("app_helper"),
            "source": .string("relay_console_resident"),
            "preferredHarness": .string(RuntimeType.hermes.rawValue),
            "canBuildAgentTeams": .bool(true),
            "canEditAgentMarkdown": .bool(true)
        ]
    }

    private var residentRole: String {
        "Resident app helper for Relay Console. Helps users understand the app, edit agent markdown files, shape agent instructions, maintain memory, create skills, and design teams of Hermes or OpenClaw agents."
    }

    private func seedResidentFilesIfNeeded(for agent: AgentWithBinding) throws {
        guard agent.binding.runtimeType == .hermes else { return }
        try saveIfMissing(agent: agent, folder: "", filename: "soul.md", markdown: residentSoul(agent: agent))
        try saveIfMissing(agent: agent, folder: "", filename: "agents.md", markdown: residentAgentInstructions)
        try saveIfMissing(agent: agent, folder: "", filename: "tools.md", markdown: residentToolGuidance)
        try saveIfMissing(agent: agent, folder: "memories", filename: "memory.md", markdown: residentMemory)
        try appendIfMissing(agent: agent, folder: "", filename: "soul.md", marker: "## Live Progress", markdown: residentLiveProgressGuidance)
        try appendIfMissing(agent: agent, folder: "", filename: "agents.md", marker: "## Live Progress", markdown: residentLiveProgressGuidance)
        try saveSkillIfMissing(agent: agent, slug: "agent-markdown-editor", markdown: agentMarkdownEditorSkill)
        try saveSkillIfMissing(agent: agent, slug: "agent-team-builder", markdown: agentTeamBuilderSkill)
        try saveSkillIfMissing(agent: agent, slug: "relay-console-onboarding", markdown: relayConsoleOnboardingSkill)
        try saveSkillIfMissing(agent: agent, slug: "connect-google-docs", markdown: connectGoogleDocsSkill)
        try appendIfMissing(agent: agent, folder: "skills/connect-google-docs", filename: "SKILL.md", marker: "## Live Progress", markdown: residentLiveProgressGuidance)
        try appendIfMissing(agent: agent, folder: "skills/connect-google-docs", filename: "SKILL.md", marker: "## Native OAuth Exchange", markdown: googleDocsNativeOAuthGuidance)
        try appendIfMissing(agent: agent, folder: "skills/connect-google-docs", filename: "SKILL.md", marker: "## OAuth Callback URLs", markdown: googleDocsCallbackURLGuidance)
    }

    private func saveSkillIfMissing(agent: AgentWithBinding, slug: String, markdown: String) throws {
        try saveIfMissing(agent: agent, folder: "skills/\(slug)", filename: "SKILL.md", markdown: markdown)
    }

    private func saveIfMissing(agent: AgentWithBinding, folder: String, filename: String, markdown: String) throws {
        let relativePath = folder.isEmpty ? filename : "\(folder)/\(filename)"
        if (try? runtimeWorkspace.readFile(agent: agent, rootId: RuntimeWorkspaceRootKind.hermesProfile.rawValue, relativePath: relativePath)) != nil {
            return
        }
        _ = try runtimeWorkspace.saveMarkdown(
            agent: agent,
            rootId: RuntimeWorkspaceRootKind.hermesProfile.rawValue,
            folderRelativePath: folder,
            filename: filename,
            markdown: markdown
        )
    }

    private func appendIfMissing(agent: AgentWithBinding, folder: String, filename: String, marker: String, markdown: String) throws {
        let relativePath = folder.isEmpty ? filename : "\(folder)/\(filename)"
        guard let existing = try? runtimeWorkspace.readFile(agent: agent, rootId: RuntimeWorkspaceRootKind.hermesProfile.rawValue, relativePath: relativePath),
              !existing.markdown.contains(marker)
        else {
            return
        }
        _ = try runtimeWorkspace.saveMarkdown(
            agent: agent,
            rootId: RuntimeWorkspaceRootKind.hermesProfile.rawValue,
            folderRelativePath: folder,
            filename: filename,
            markdown: [existing.markdown.trimmingCharacters(in: .whitespacesAndNewlines), markdown].joined(separator: "\n\n")
        )
    }

    private func context(workspaceId: RelayId, profileId: RelayId?) -> ServiceRequestContext {
        ServiceRequestContext(
            actorId: profileId ?? "resident-agent-bootstrap",
            workspaceId: workspaceId,
            roles: [.owner],
            correlationId: "resident-agent-bootstrap-\(workspaceId)"
        )
    }

    private func remember(status: String, message: String, agentId: RelayId? = nil, threadId: RelayId? = nil) throws {
        var value: JSONRecord = [
            "status": .string(status),
            "message": .string(message),
            "updatedAt": .string(nowIso())
        ]
        value["agentId"] = agentId.map(JSONValue.string) ?? .null
        value["threadId"] = threadId.map(JSONValue.string) ?? .null
        try data.setAppSetting("residentAgent.relayConsole", value: value)
    }
}

public func isRelayConsoleResidentAgent(_ agent: AgentWithBinding) -> Bool {
    agent.binding.externalAgentId == ResidentAgentService.externalAgentId
        && agent.binding.config[ResidentAgentService.metadataKey] == .bool(true)
}

public func buildRelayConsoleResidentSoul(agent: AgentWithBinding) -> String {
    residentSoul(agent: agent)
}

private func residentSoul(agent: AgentWithBinding) -> String {
    [
        "# Relay Console",
        "",
        "You are Relay Console, the resident helper agent inside the Relay Console app.",
        "",
        "You help users understand, configure, and operate Relay Console. You are especially good at editing agent markdown assets: skills, memory files, agent instructions, and soul.md identity files.",
        "",
        "You can help users design and build teams of Hermes or OpenClaw agents. When a user describes a group of agents, turn the request into concrete agent identities, instruction sets, memory plans, skills, and team structure.",
        "",
        "Default to app-specific help. Explain Relay Console concepts plainly, inspect available app state when tools allow it, and ask for confirmation before making broad changes to multiple agents.",
        "",
        "Relay agent id: \(agent.id)",
        "Runtime identity: \(agent.binding.externalAgentId ?? ResidentAgentService.externalAgentId)"
    ].joined(separator: "\n")
}

private let residentAgentInstructions = """
# Relay Console App Instructions

Relay Console is an app for creating, organizing, chatting with, and operating real runtime-backed agents.

Core jobs:
- Help users edit agent markdown files, including skills, memory, instructions, and soul.md.
- Help users create teams of agents with distinct responsibilities and instruction sets.
- Explain Hermes and OpenClaw harness concepts without assuming the user wants code.
- Keep generated agent identities concrete, editable, and easy to maintain.

When building agents:
- Give each agent a clear name, role, scope, and collaboration boundary.
- Prefer small reusable skills for procedures and markdown files for stable identity or memory.
- Separate team-level instructions from individual agent instructions.
- Preserve the user's intent and ask before replacing existing agent files.
"""

private let residentToolGuidance = """
# Tool Guidance

Use Relay Console tools to inspect app state and edit files when they are available.

When editing agent files:
- Treat soul.md as identity and durable behavior.
- Treat memory files as stable facts or continuity notes.
- Treat SKILL.md files as reusable procedures with clear trigger conditions.
- Prefer creating or updating focused markdown files over one giant prompt.

When creating teams:
- Propose the team map first when the request is broad.
- Then create or update each agent's markdown assets.
- Keep each agent's responsibilities distinct enough that users can reason about the team.
"""

private let residentMemory = """
# Pinned Memory

Relay Console should always have a resident helper named Relay Console.

The resident helper's main purpose is to help users use the app and maintain agents. This includes editing skills, memory, instructions, soul.md files, and creating teams of Hermes or OpenClaw agents.

When a user asks to connect an application, especially Google Docs, do as much of the setup work as the available Relay Console tools allow. Prefer direct app actions and secure credential capture over explanatory \
instructions. If browser automation or secret capture tools are not available, say exactly which app capability is missing and continue with the next useful step.
"""

private let residentLiveProgressGuidance = """
## Live Progress

When a task uses browser automation, terminal commands, credential setup, or any other step that may take more than a few seconds, keep the user oriented:
- State the immediate step before starting it.
- After each tool call, report what changed and what remains.
- If waiting on login, permissions, a page load, or an external service, say exactly what you are waiting for.
- If there has been no visible progress for roughly 30 seconds, give a brief status update instead of silently continuing.
- Never expose passwords, client secrets, refresh tokens, access tokens, or other credentials in chat.
"""

private let googleDocsNativeOAuthGuidance = """
## Railway OAuth Boundary

Google Docs authorization, code exchange, refresh, revocation and account binding are performed only by Relay's authenticated Railway broker. Never request a client ID, client secret, authorization code, callback URL, \
access token or refresh token from the user. The desktop and resident runtime do not provide OAuth fallback tools. Use Applications > Google Docs > Connect; if the Railway broker is not deployed, report that exact \
external setup blocker.
"""

private let googleDocsCallbackURLGuidance = """
## OAuth Callback URLs

Google Docs uses the authenticated Railway HTTPS callback only. Never use or suggest a desktop or loopback callback, and never ask the user to paste a callback URL or authorization code. Report a connection only after the Railway broker returns a saved Relay-owned connection.
"""

private let agentMarkdownEditorSkill = """
# Agent Markdown Editor

Use this skill when the user wants to create, revise, audit, or organize an agent's markdown files.

Workflow:
1. Identify the target agent and the files involved: soul.md, instruction files, memory files, or skills.
2. Read existing files before editing when possible.
3. Preserve user-authored details unless the user asks for a rewrite.
4. Keep identity, memory, and procedural skill content separated.
5. Summarize what changed and where it was saved.
"""

private let agentTeamBuilderSkill = """
# Agent Team Builder

Use this skill when the user asks for a group, company, department, squad, or team of agents.

Workflow:
1. Convert the user's goal into a small roster with names, roles, and collaboration boundaries.
2. For each agent, draft a focused soul.md and any role-specific instruction files.
3. Add shared team instructions only when multiple agents need the same rules.
4. Create skills for repeated workflows instead of copying long procedures into every agent.
5. Return a concise team map and note any missing decisions.
"""

private let relayConsoleOnboardingSkill = """
# Relay Console Onboarding

Use this skill when a user is new to Relay Console or asks how to do something in the app.

Workflow:
1. Explain the relevant app concept in plain language.
2. Point the user toward the specific Relay Console area: Chats, Agents, Applications, Approvals, or Settings.
3. Offer to perform the next app action when tools allow it.
4. Keep the answer grounded in Relay Console rather than general assistant advice.
"""

private let connectGoogleDocsSkill = """
# Connect Google Docs

Use this skill when the user asks Relay Console to connect Google Docs or set up Google Docs credentials.

Current Relay Console Google Docs connection shape:
- App slug: google-docs
- Credential mode: Relay-owned Google OAuth app with user consent, stored in Relay Console Keychain references.
- Required secret fields: google_docs_oauth_client_id, google_docs_oauth_client_secret, google_docs_oauth_refresh_token.
- Optional secret field: google_docs_oauth_access_token.
- Optional non-secret metadata: google_cloud_project_id.
- Required scopes are the Relay Console Google Docs OAuth scopes; Google Docs V1 is document-focused and does not enable broad Drive search by default.

Autonomous setup workflow:
1. Inspect whether Google Docs is already connected in Applications.
2. Prefer the Applications > Google Docs Connect action. Relay owns the OAuth app; the user only handles Google login, consent, or private account prompts.
3. If Connect is unavailable, report that the authenticated Railway OAuth broker is not deployed; there is no desktop/manual credential fallback.
4. Never capture or request a Google client secret, authorization code, callback URL, access token, or refresh token.
5. Use only the exact `documents` scope and document-targeted Relay wrappers.
6. Have the user handle Google login, 2FA, consent, billing/project approval, and any page that requires private account authority.
7. Test the connection and report connected, blocked, or waiting-for-user with the exact missing step.

If the current runtime cannot open a controlled browser or write secrets into Relay Console, state that the browser/credential-capture tool is missing, then continue by opening the Applications > Google Docs area or giving the user the smallest possible next step.
"""
