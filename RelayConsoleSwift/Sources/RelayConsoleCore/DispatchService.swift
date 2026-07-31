import Foundation

public final class DispatchService {
    private let paths: RelayConsolePaths
    private let data: LocalDataService
    private let registry: RuntimeBridgeRegistry
    private let entitlement: RelayEntitlementService
    private let eventBus: RelayEventBus

    public init(
        paths: RelayConsolePaths,
        data: LocalDataService,
        registry: RuntimeBridgeRegistry,
        entitlement: RelayEntitlementService,
        eventBus: RelayEventBus
    ) {
        self.paths = paths
        self.data = data
        self.registry = registry
        self.entitlement = entitlement
        self.eventBus = eventBus
    }

    public func checkHarnessHealth(harnessId: String) async throws -> HarnessHealth {
        let harness = try data.getHarness(harnessId)
        let bridge = try registry.get(harness.runtimeType)
        let health = await bridge.getHealth(harnessId: harness.id, config: harness.config)
        _ = try? data.log(
            severity: health.status == .healthy ? "info" : "warn",
            category: "harness",
            message: "Harness health check: \(health.message)",
            harnessId: harness.id,
            detail: ["status": .string(health.status.rawValue), "runtimeType": .string(health.runtimeType.rawValue)]
        )
        eventBus.emit(.harnessHealthChanged, health)
        return health
    }

    public func getCapabilities(harnessId: String) async throws -> RuntimeCapabilities {
        let harness = try data.getHarness(harnessId)
        let bridge = try registry.get(harness.runtimeType)
        return await bridge.getCapabilities(harnessId: harness.id, config: harness.config)
    }

    public func sendMessage(
        threadId: String,
        agentId: String,
        content rawContent: String,
        threadWasNew: Bool = false,
        metadata: JSONRecord = [:],
        approvalMode: RuntimeApprovalMode? = nil
    ) async throws -> (userMessage: Message, dispatch: RuntimeDispatch) {
        try entitlement.requireSameMacExecution()
        let content = try assertMessageContent(rawContent, maxLength: try data.getMessageLimit())
        let thread = try data.getThread(threadId)
        let fallbackAgent = try data.getAgent(agentId)
        guard fallbackAgent.workspaceId == thread.workspaceId else {
            throw RelayError(.invalidInput, "Agent does not belong to this thread workspace.")
        }
        guard fallbackAgent.status == "active" else {
            throw RelayError(.invalidInput, "Selected agent is not active.")
        }
        let route = try resolveDispatchRoute(
            thread: thread,
            fallbackAgent: fallbackAgent,
            content: content,
            excludingAgentId: nil
        )
        guard !route.agents.isEmpty else {
            throw RelayError(.invalidInput, "Team chat has no active agent participants.")
        }
        var initialMetadata = metadata
        let effectiveApprovalMode = approvalMode ?? currentApprovalMode()
        initialMetadata["runtimeApprovalMode"] = .string(effectiveApprovalMode.rawValue)
        initialMetadata["localSendState"] = .string(LocalSendState.pending.rawValue)
        initialMetadata["retrySourceMessageId"] = .string("")
        var userMessage = try data.createMessage(
            threadId: threadId,
            senderType: .user,
            senderName: "You",
            content: content,
            contentFormat: .plain,
            metadata: initialMetadata
        )
        userMessage = try markLocalSendState(
            message: userMessage,
            state: .pending,
            detail: [
                "retrySourceMessageId": .string(userMessage.id),
                "threadWasNew": .bool(threadWasNew)
            ]
        )
        let preparedTargets: [(agent: AgentWithBinding, bridge: DesktopRuntimeBridge)]
        do {
            preparedTargets = try await prepareDispatchTargets(route.agents)
        } catch {
            let relay = relayError(error)
            _ = try? markLocalSendState(
                message: userMessage,
                state: .failed,
                detail: [
                    "localErrorMessage": .string(error.localizedDescription),
                    "localErrorCode": .string(relay.code.rawValue),
                    "retrySourceMessageId": .string(userMessage.id),
                    "retryable": .bool(relay.code == .harnessUnhealthy)
                ]
            )
            throw error
        }
        if thread.threadType != .team, thread.selectedAgentId != fallbackAgent.id {
            _ = try data.updateThread(threadId: thread.id, selectedAgentId: fallbackAgent.id)
        }
        var dispatches: [RuntimeDispatch] = []
        do {
            for prepared in preparedTargets {
                dispatches.append(try queueRuntimeDispatch(
                    thread: thread,
                    sourceMessage: userMessage,
                    agent: prepared.agent,
                    bridge: prepared.bridge,
                    inputContent: content,
                    inputFormat: .plain,
                    attempt: 1,
                    sourceMetadata: metadata,
                    approvalMode: effectiveApprovalMode,
                    route: route,
                    threadWasNew: threadWasNew
                ))
            }
        } catch {
            _ = try? markLocalSendState(
                message: userMessage,
                state: .failed,
                detail: [
                    "localErrorMessage": .string(error.localizedDescription),
                    "localErrorCode": .string("dispatch.create_failed"),
                    "retrySourceMessageId": .string(userMessage.id),
                    "retryable": .bool(true)
                ]
            )
            throw error
        }
        guard let firstDispatch = dispatches.first else {
            _ = try? markLocalSendState(
                message: userMessage,
                state: .failed,
                detail: [
                    "localErrorMessage": .string("No runtime dispatch targets were available."),
                    "localErrorCode": .string(RelayErrorCode.invalidInput.rawValue),
                    "retrySourceMessageId": .string(userMessage.id),
                    "retryable": .bool(false)
                ]
            )
            throw RelayError(.invalidInput, "No runtime dispatch targets were available.")
        }
        userMessage = try markLocalSendState(
            message: userMessage,
            state: .dispatched,
            detail: [
                "dispatchId": .string(firstDispatch.id),
                "dispatchIds": .array(dispatches.map { .string($0.id) }),
                "correlationId": .string(firstDispatch.correlationId),
                "correlationIds": .array(dispatches.map { .string($0.correlationId) }),
                "retrySourceMessageId": .string(userMessage.id),
                "retryable": .bool(false),
                "dispatchRoutingMode": .string(route.mode),
                "dispatchTargetAgentIds": .array(route.agents.map { .string($0.id) }),
                "mentionedAgentIds": .array(route.mentionedAgentIds.map { .string($0) })
            ]
        )
        return (userMessage, firstDispatch)
    }

    public func injectScheduledMessage(
        threadId: String,
        agentId: String,
        content rawContent: String,
        metadata: JSONRecord = [:],
        approvalMode: RuntimeApprovalMode? = nil
    ) async throws -> Message {
        try entitlement.requireSameMacExecution()
        let content = try assertMessageContent(rawContent, maxLength: try data.getMessageLimit())
        let thread = try data.getThread(threadId)
        let fallbackAgent = try data.getAgent(agentId)
        guard fallbackAgent.workspaceId == thread.workspaceId, fallbackAgent.status == "active" else {
            throw RelayError(.invalidInput, "Scheduled task agent is not active in this workspace.")
        }
        let route = try resolveDispatchRoute(
            thread: thread,
            fallbackAgent: fallbackAgent,
            content: content,
            excludingAgentId: nil
        )
        guard !route.agents.isEmpty else {
            throw RelayError(.invalidInput, "Scheduled task chat has no active agent participants.")
        }
        let effectiveApprovalMode = approvalMode ?? currentApprovalMode()
        var initialMetadata = metadata
        initialMetadata["runtimeApprovalMode"] = .string(effectiveApprovalMode.rawValue)
        initialMetadata["localSendState"] = .string(LocalSendState.pending.rawValue)
        var message = try data.createMessage(
            threadId: threadId,
            senderType: .user,
            senderName: "You",
            content: content,
            contentFormat: .plain,
            metadata: initialMetadata
        )
        let preparedTargets: [(agent: AgentWithBinding, bridge: DesktopRuntimeBridge)]
        do {
            preparedTargets = try await prepareDispatchTargets(route.agents)
        } catch {
            let relay = relayError(error)
            _ = try? markLocalSendState(
                message: message,
                state: .failed,
                detail: [
                    "localErrorMessage": .string(error.localizedDescription),
                    "localErrorCode": .string(relay.code.rawValue),
                    "retrySourceMessageId": .string(message.id),
                    "retryable": .bool(relay.code == .harnessUnhealthy)
                ]
            )
            throw error
        }
        do {
            let dispatches = try preparedTargets.map { prepared in
                try queueRuntimeDispatch(
                    thread: thread,
                    sourceMessage: message,
                    agent: prepared.agent,
                    bridge: prepared.bridge,
                    inputContent: message.content,
                    inputFormat: message.contentFormat,
                    attempt: 1,
                    sourceMetadata: metadata,
                    approvalMode: effectiveApprovalMode,
                    route: route,
                    threadWasNew: false
                )
            }
            message = try markLocalSendState(
                message: message,
                state: .dispatched,
                detail: [
                    "dispatchIds": .array(dispatches.map { .string($0.id) }),
                    "retrySourceMessageId": .string(message.id),
                    "retryable": .bool(false),
                    "dispatchRoutingMode": .string(route.mode),
                    "dispatchTargetAgentIds": .array(route.agents.map { .string($0.id) })
                ]
            )
            return message
        } catch {
            _ = try? markLocalSendState(
                message: message,
                state: .failed,
                detail: [
                    "localErrorMessage": .string(error.localizedDescription),
                    "localErrorCode": .string("scheduled_dispatch.failed"),
                    "retrySourceMessageId": .string(message.id),
                    "retryable": .bool(true)
                ]
            )
            throw error
        }
    }

    @discardableResult
    public func pauseTeamRelay(threadId: String) throws -> ThreadDetail {
        let thread = try data.getThread(threadId)
        guard thread.threadType == .team else {
            throw RelayError(.invalidInput, "Relay controls are available only in team chats.")
        }
        guard let session = activeTeamRelaySession(in: thread) else {
            throw RelayError(.invalidInput, "Team chat has no active relay cycle.")
        }
        _ = try data.updateChatSessionRelayControls(
            sessionId: session.id,
            runState: .paused,
            pauseReason: .manual,
            replyLimit: session.relayReplyLimit
        )
        return try data.getThread(threadId)
    }

    @discardableResult
    public func continueTeamRelay(threadId: String) async throws -> ThreadDetail {
        try entitlement.requireSameMacExecution()
        let thread = try data.getThread(threadId)
        guard thread.threadType == .team else {
            throw RelayError(.invalidInput, "Relay controls are available only in team chats.")
        }
        guard let session = activeTeamRelaySession(in: thread) else {
            throw RelayError(.invalidInput, "Team chat has no active relay cycle.")
        }
        let replyCount = try data.countAgentMessages(threadId: thread.id, sessionId: session.id)
        let nextLimit = replyCount >= session.relayReplyLimit
            ? TeamRelayReplyLimits.nextLimit(after: max(replyCount, session.relayReplyLimit))
            : session.relayReplyLimit
        _ = try data.updateChatSessionRelayControls(
            sessionId: session.id,
            runState: .running,
            pauseReason: nil,
            replyLimit: nextLimit
        )
        try await routeLatestPendingTeamRelayMessage(threadId: threadId)
        return try data.getThread(threadId)
    }

    @discardableResult
    public func setTeamRelayReplyLimit(threadId: String, replyLimit rawLimit: Int) async throws -> ThreadDetail {
        try entitlement.requireSameMacExecution()
        let thread = try data.getThread(threadId)
        guard thread.threadType == .team else {
            throw RelayError(.invalidInput, "Relay controls are available only in team chats.")
        }
        guard let session = activeTeamRelaySession(in: thread) else {
            throw RelayError(.invalidInput, "Team chat has no active relay cycle.")
        }
        let replyLimit = TeamRelayReplyLimits.normalized(rawLimit)
        let replyCount = try data.countAgentMessages(threadId: thread.id, sessionId: session.id)
        let canRun = replyCount < replyLimit
        _ = try data.updateChatSessionRelayControls(
            sessionId: session.id,
            runState: canRun ? .running : .paused,
            pauseReason: canRun ? nil : .replyLimit,
            replyLimit: replyLimit
        )
        if canRun {
            try await routeLatestPendingTeamRelayMessage(threadId: threadId)
        }
        return try data.getThread(threadId)
    }

    private struct DispatchRoute {
        var agents: [AgentWithBinding]
        var mode: String
        var mentionedAgentIds: [RelayId]
        var mentionTokens: [String]
    }

    private struct TeamCatchUpBundle {
        var messages: [Message]
        var sinceMessageId: RelayId?
        var sinceCreatedAt: IsoTimestamp?

        static let empty = TeamCatchUpBundle(messages: [], sinceMessageId: nil, sinceCreatedAt: nil)
    }

    private func resolveDispatchRoute(
        thread: ThreadDetail,
        fallbackAgent: AgentWithBinding,
        content: String,
        excludingAgentId: RelayId?
    ) throws -> DispatchRoute {
        guard thread.threadType == .team else {
            return DispatchRoute(
                agents: [fallbackAgent],
                mode: "direct",
                mentionedAgentIds: [],
                mentionTokens: []
            )
        }

        let participantAgents = try teamParticipantAgents(thread: thread)
        let candidates = (participantAgents.isEmpty ? [fallbackAgent] : participantAgents)
            .filter { agent in
                agent.workspaceId == thread.workspaceId
                    && agent.status == "active"
                    && agent.id != excludingAgentId
            }
        let mentions = mentionedTeamAgent(in: content, candidates: candidates)
        if let target = mentions.agent {
            return DispatchRoute(
                agents: [target],
                mode: "team_single_mention",
                mentionedAgentIds: [target.id],
                mentionTokens: mentions.tokens
            )
        }
        guard let randomTarget = candidates.randomElement() else {
            return DispatchRoute(
                agents: [],
                mode: "team_single_unavailable",
                mentionedAgentIds: [],
                mentionTokens: mentions.tokens
            )
        }
        return DispatchRoute(
            agents: [randomTarget],
            mode: "team_single_random",
            mentionedAgentIds: [],
            mentionTokens: mentions.tokens
        )
    }

    private func teamParticipantAgents(thread: ThreadDetail) throws -> [AgentWithBinding] {
        var seen: Set<RelayId> = []
        var agents: [AgentWithBinding] = []
        for participant in thread.participants where participant.participantType == .agent && participant.leftAt == nil {
            guard let agentId = participant.participantId, !seen.contains(agentId) else { continue }
            let agent = try data.getAgent(agentId)
            guard agent.workspaceId == thread.workspaceId else { continue }
            seen.insert(agentId)
            agents.append(agent)
        }
        return agents
    }

    private func mentionedTeamAgent(
        in content: String,
        candidates: [AgentWithBinding]
    ) -> (agent: AgentWithBinding?, tokens: [String]) {
        let tokens = mentionTokens(in: content)
        guard !tokens.isEmpty else {
            return (nil, [])
        }
        let candidateMap = Dictionary(uniqueKeysWithValues: candidates.map { agent in
            (agent.id, mentionCandidates(for: agent))
        })
        for token in tokens {
            let normalized = normalizeMentionToken(token)
            guard !normalized.isEmpty else { continue }
            for agent in candidates where candidateMap[agent.id]?.contains(normalized) == true {
                return (agent, tokens)
            }
        }
        return (nil, tokens)
    }

    private func mentionTokens(in content: String) -> [String] {
        rawMentionTokens(in: content)
            .map(normalizeMentionToken)
            .filter { !$0.isEmpty }
    }

    private func rawMentionTokens(in content: String) -> [String] {
        let pattern = #"(?<![A-Za-z0-9_])@([A-Za-z0-9][A-Za-z0-9._-]{0,159})"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return []
        }
        let nsRange = NSRange(content.startIndex..<content.endIndex, in: content)
        return regex.matches(in: content, range: nsRange).compactMap { match in
            guard match.numberOfRanges > 1, let range = Range(match.range(at: 1), in: content) else {
                return nil
            }
            return String(content[range])
        }
    }

    private func mentionCandidates(for agent: AgentWithBinding) -> Set<String> {
        let rawValues = [
            agent.id,
            agent.name,
            agent.externalId,
            agent.binding.externalAgentId,
            agent.binding.hermesProfileSlug
        ].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
        var candidates: Set<String> = []
        for value in rawValues where !value.isEmpty {
            let normalized = normalizeMentionToken(value)
            if !normalized.isEmpty {
                candidates.insert(normalized)
            }
            let slug = slugifyAgentId(value)
            if !slug.isEmpty {
                candidates.insert(slug)
                candidates.insert(slug.replacingOccurrences(of: "_", with: "-"))
                candidates.insert(slug.replacingOccurrences(of: "_", with: ""))
            }
        }
        return candidates
    }

    private func normalizeMentionToken(_ value: String) -> String {
        value
            .trimmingCharacters(in: CharacterSet(charactersIn: "@._- \n\t\r"))
            .lowercased()
    }

    private func prepareDispatchTargets(
        _ agents: [AgentWithBinding]
    ) async throws -> [(agent: AgentWithBinding, bridge: DesktopRuntimeBridge)] {
        var prepared: [(agent: AgentWithBinding, bridge: DesktopRuntimeBridge)] = []
        for agent in agents {
            let bridge = try registry.get(agent.binding.runtimeType)
            let health = await bridge.getHealth(harnessId: agent.harness.id, config: agent.harness.config)
            guard health.status == .healthy else {
                throw RelayError(
                    .harnessUnhealthy,
                    "\(agent.name)'s harness is not ready.",
                    recovery: "Open Harnesses and run a health check."
                )
            }
            prepared.append((agent, bridge))
        }
        return prepared
    }

    private func createArtifactContract(correlationId: String, createdAt: String) throws -> RuntimeArtifactContract {
        let day = artifactDay(createdAt)
        let runDirectory = paths.artifactsDir
            .appendingPathComponent("runs", isDirectory: true)
            .appendingPathComponent(day, isDirectory: true)
            .appendingPathComponent(safePathComponent(correlationId, fallback: "run"), isDirectory: true)
        let cronDirectoryRoot = paths.artifactsDir.appendingPathComponent("cron", isDirectory: true)
        try FileManager.default.createDirectory(at: runDirectory, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: cronDirectoryRoot, withIntermediateDirectories: true)
        return RuntimeArtifactContract(
            rootPath: paths.artifactsDir.path,
            runDirectoryPath: runDirectory.path,
            cronDirectoryRootPath: cronDirectoryRoot.path
        )
    }

    private func artifactDay(_ timestamp: String) -> String {
        let prefix = String(timestamp.prefix(10))
        return prefix.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) == nil ? "undated" : prefix
    }

    private func safePathComponent(_ value: String, fallback: String) -> String {
        let safe = value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"[^A-Za-z0-9_.-]+"#, with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".-"))
        return String((safe.isEmpty ? fallback : safe).prefix(160))
    }

    private func artifactContract(from snapshot: JSONRecord) -> RuntimeArtifactContract? {
        guard case .object(let object)? = snapshot["artifactContract"],
              let rootPath = stringValue(object["rootPath"])?.trimmingCharacters(in: .whitespacesAndNewlines),
              !rootPath.isEmpty,
              let runDirectoryPath = stringValue(object["runDirectoryPath"])?.trimmingCharacters(in: .whitespacesAndNewlines),
              !runDirectoryPath.isEmpty
        else { return nil }
        let cronRoot = stringValue(object["cronDirectoryRootPath"])?.trimmingCharacters(in: .whitespacesAndNewlines)
        return RuntimeArtifactContract(
            rootPath: rootPath,
            runDirectoryPath: runDirectoryPath,
            cronDirectoryRootPath: cronRoot?.isEmpty == false ? cronRoot! : paths.artifactsDir.appendingPathComponent("cron", isDirectory: true).path
        )
    }

    private func teamCatchUpBundle(
        thread: ThreadDetail,
        sourceMessage: Message,
        targetAgentId: RelayId
    ) throws -> TeamCatchUpBundle {
        guard thread.threadType == .team else { return .empty }
        let messages = try data.listMessagesInThreadOrder(threadId: thread.id, sessionId: sourceMessage.threadSessionId)
        guard let currentIndex = messages.firstIndex(where: { $0.id == sourceMessage.id }) else {
            return .empty
        }
        let indexByMessageId = Dictionary(uniqueKeysWithValues: messages.enumerated().map { index, message in
            (message.id, index)
        })
        let lastSeenIndex = try data.listDispatchesForThread(thread.id)
            .filter { dispatch in
                dispatch.agentId == targetAgentId
                    && dispatch.status != .failed
                    && dispatch.status != .cancelled
            }
            .compactMap { indexByMessageId[$0.messageId] }
            .filter { $0 < currentIndex }
            .max()
        let candidateRange: Range<Int>
        if let lastSeenIndex {
            candidateRange = (lastSeenIndex + 1)..<currentIndex
        } else {
            candidateRange = 0..<currentIndex
        }
        let catchUpMessages = messages[candidateRange].filter { message in
            message.id != sourceMessage.id && message.senderId != targetAgentId
        }
        let sinceMessage = lastSeenIndex.map { messages[$0] }
        return TeamCatchUpBundle(
            messages: Array(catchUpMessages),
            sinceMessageId: sinceMessage?.id,
            sinceCreatedAt: sinceMessage?.createdAt
        )
    }

    private func inputContentWithTeamCatchUp(
        originalContent: String,
        bundle: TeamCatchUpBundle
    ) -> String {
        guard !bundle.messages.isEmpty else { return originalContent }
        let context = bundle.messages.enumerated().map { index, message in
            let sender = teamCatchUpSenderLabel(message)
            let body = indentForTeamCatchUp(message.content)
            return "\(index + 1). \(sender) at \(message.createdAt)\n\(body)"
        }.joined(separator: "\n\n")
        return [
            "[Relay Console team catch-up since your last routed turn]",
            "These are earlier team-chat messages you may not have received in this runtime session. Use them as context only.",
            "",
            context,
            "",
            "[Current routed message - respond to this]",
            originalContent
        ].joined(separator: "\n")
    }

    private func teamCatchUpSenderLabel(_ message: Message) -> String {
        let name = message.senderName.trimmingCharacters(in: .whitespacesAndNewlines)
        let displayName = name.isEmpty ? message.senderType.rawValue.capitalized : name
        return "\(displayName) (\(message.senderType.rawValue))"
    }

    private func indentForTeamCatchUp(_ content: String) -> String {
        content
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map { "    \($0)" }
            .joined(separator: "\n")
    }

    @discardableResult
    private func queueRuntimeDispatch(
        thread: ThreadDetail,
        sourceMessage: Message,
        agent: AgentWithBinding,
        bridge: DesktopRuntimeBridge,
        inputContent: String,
        inputFormat: MessageFormat,
        attempt: Int,
        sourceMetadata: JSONRecord,
        approvalMode: RuntimeApprovalMode,
        route: DispatchRoute,
        threadWasNew: Bool? = nil
    ) throws -> RuntimeDispatch {
        try entitlement.requireSameMacExecution()
        let catchUpBundle = try teamCatchUpBundle(
            thread: thread,
            sourceMessage: sourceMessage,
            targetAgentId: agent.id
        )
        let runtimeInputContent = inputContentWithTeamCatchUp(
            originalContent: inputContent,
            bundle: catchUpBundle
        )
        let session = try data.createRuntimeSession(threadId: thread.id, agentId: agent.id, runtimeBindingId: agent.binding.id)
        let createdAt = nowIso()
        let correlationId = UUID().uuidString
        let artifactContract = try createArtifactContract(correlationId: correlationId, createdAt: createdAt)
        var inputSnapshot: JSONRecord = [
            "content": .string(runtimeInputContent),
            "sourceContent": .string(inputContent),
            "agentId": .string(agent.id),
            "harnessId": .string(agent.harness.id),
            "runtimeType": .string(agent.binding.runtimeType.rawValue),
            "attempt": .number(Double(attempt)),
            "retrySourceMessageId": .string(sourceMessage.id),
            "retryable": .bool(false),
            "sourceMessageId": .string(sourceMessage.id),
            "sourceSenderType": .string(sourceMessage.senderType.rawValue),
            "dispatchRoutingMode": .string(route.mode),
            "dispatchTargetAgentIds": .array(route.agents.map { .string($0.id) }),
            "mentionedAgentIds": .array(route.mentionedAgentIds.map { .string($0) }),
            "mentionTokens": .array(route.mentionTokens.map { .string($0) }),
            "runtimeApprovalMode": .string(approvalMode.rawValue),
            "artifactContract": .object(artifactContract.metadata),
            "artifactDirectoryPath": .string(artifactContract.runDirectoryPath),
            "artifactRootPath": .string(artifactContract.rootPath),
            "teamCatchUpMode": .string(thread.threadType == .team ? "incremental" : "none"),
            "teamCatchUpMessageCount": .number(Double(catchUpBundle.messages.count)),
            "teamCatchUpMessageIds": .array(catchUpBundle.messages.map { .string($0.id) }),
            "teamCatchUpSinceMessageId": catchUpBundle.sinceMessageId.map { .string($0) } ?? .null,
            "teamCatchUpSinceCreatedAt": catchUpBundle.sinceCreatedAt.map { .string($0) } ?? .null,
            "metadata": .object(sourceMetadata)
        ]
        if let senderId = sourceMessage.senderId {
            inputSnapshot["sourceSenderId"] = .string(senderId)
        }
        if let threadWasNew {
            inputSnapshot["threadWasNew"] = .bool(threadWasNew)
        }
        let requiresRunConfirmation = approvalMode.requiresRunConfirmation
        if requiresRunConfirmation {
            inputSnapshot.merge(runConfirmationInputSnapshot(agentName: agent.name, inputContent: inputContent)) { _, new in new }
        }
        let dispatch = try data.createDispatch(
            threadId: thread.id,
            messageId: sourceMessage.id,
            agentId: agent.id,
            harnessId: agent.harness.id,
            sessionId: session.id,
            correlationId: correlationId,
            inputSnapshot: inputSnapshot
        )
        let recentMessages: [Message]
        if thread.threadType == .team {
            recentMessages = [sourceMessage]
        } else {
            recentMessages = try data.listMessages(threadId: thread.id, limit: 40)
        }
        _ = try? data.log(
            severity: "info",
            category: "dispatch",
            message: "Dispatch queued.",
            correlationId: dispatch.correlationId,
            dispatchId: dispatch.id,
            harnessId: agent.harness.id,
            threadId: thread.id,
            detail: [
                "routingMode": .string(route.mode),
                "sourceMessageId": .string(sourceMessage.id),
                "sourceSenderType": .string(sourceMessage.senderType.rawValue),
                "targetAgentCount": .number(Double(route.agents.count)),
                "teamCatchUpMessageCount": .number(Double(catchUpBundle.messages.count))
            ]
        )
        let request = RuntimeDispatchRequest(
            dispatchId: dispatch.id,
            correlationId: dispatch.correlationId,
            threadId: thread.id,
            messageId: sourceMessage.id,
            sessionId: session.id,
            attempt: attempt,
            agent: agent,
            runtimeBinding: agent.binding,
            harness: agent.harness,
            inputContent: runtimeInputContent,
            inputFormat: inputFormat,
            recentMessages: recentMessages,
            approvalMode: approvalMode,
            timeoutMs: RuntimeDispatchTimeouts.chatTurnMs,
            createdAt: createdAt,
            artifactContract: artifactContract,
            attachmentPaths: try nativeImageAttachmentPaths(from: sourceMetadata)
        )
        if requiresRunConfirmation {
            return try markRunConfirmationPending(
                dispatch: dispatch,
                agentName: agent.name,
                inputContent: inputContent
            )
        }
        launchRuntimeDispatch(request, bridge: bridge, data: data, eventBus: eventBus)
        return dispatch
    }

    public func cancel(dispatchId: String, context: ServiceRequestContext? = nil) async throws -> RuntimeDispatch {
        let dispatch = try data.getDispatch(dispatchId)
        let requestContext = try authorizeDispatchAction(dispatch, context: context, actionName: "cancel")
        if dispatch.isTerminal {
            return dispatch
        }
        if dispatch.isRunConfirmationPending {
            return try rejectPendingRun(
                dispatch,
                context: requestContext,
                message: "Run rejected before the runtime started."
            )
        }
        let agent = try data.getAgent(dispatch.agentId)
        let bridge = try registry.get(agent.binding.runtimeType)
        let capabilities = await bridge.getCapabilities(harnessId: agent.harness.id, config: agent.harness.config)
        guard capabilities.supportsCancellation else {
            throw ServiceGuard.unavailable(
                context: requestContext,
                reasonCode: .capabilityMissing,
                message: "\(runtimeLabel(agent.binding.runtimeType)) does not support cancellation.",
                recovery: "Wait for the runtime attempt to finish."
            )
        }
        let cancelled = try data.updateDispatch(
            dispatchId: dispatchId,
            status: .cancelled,
            errorSnapshot: [
                "category": .string("cancelled"),
                "message": .string("Cancel requested."),
                "cancelStatus": .string("requested"),
                "cancellationSupported": .bool(true),
                "retryable": .bool(false),
                "attempt": .number(Double(dispatch.attempt)),
                "runtimeType": .string(agent.binding.runtimeType.rawValue)
            ]
        )
        Task.detached {
            _ = await bridge.cancelDispatch(dispatchId: dispatchId, correlationId: dispatch.correlationId)
        }
        return cancelled
    }

    public func resolveRuntimeApproval(
        dispatchId: String,
        decision: RuntimeApprovalDecision,
        context: ServiceRequestContext? = nil
    ) async throws -> RuntimeDispatch {
        let dispatch = try data.getDispatch(dispatchId)
        let requestContext = try authorizeDispatchAction(
            dispatch,
            context: context,
            actionName: "resolve approvals for"
        )
        guard dispatch.isRuntimeApprovalPending else {
            throw ServiceGuard.invalidInput(
                context: requestContext,
                message: "This runtime dispatch is not waiting for action approval."
            )
        }
        let agent = try data.getAgent(dispatch.agentId)
        let bridge = try registry.get(agent.binding.runtimeType)
        guard await bridge.resolveApproval(
            dispatchId: dispatch.id,
            correlationId: dispatch.correlationId,
            decision: decision
        ) else {
            throw ServiceGuard.unavailable(
                context: requestContext,
                reasonCode: .runtimeUnavailable,
                message: "The runtime approval request is no longer available."
            )
        }

        let current = try data.getDispatch(dispatch.id)
        guard current.isActive else { return current }
        let timestamp = nowIso()
        var snapshot = current.resultSnapshot ?? [:]
        snapshot["runtimeApprovalState"] = .string(
            decision == .deny ? "denied" : "approved"
        )
        snapshot["runtimeApprovalDecision"] = .string(decision.rawValue)
        snapshot["runtimeApprovalDecidedAt"] = .string(timestamp)
        snapshot["runtimeApprovalDecidedBy"] = .string(requestContext.actorId)
        snapshot["runtimeStatusMessage"] = .string(
            decision == .deny ? "Action denied" : "Action approved"
        )
        let event = RuntimeActivityProjectionEvent(
            id: createRelayId("evt"),
            dispatchId: dispatch.id,
            type: .status,
            text: decision == .deny ? "Action denied" : "Action approved",
            status: decision == .deny ? "Denied" : "Approved",
            detail: [
                "gatewayEventType": .string("approval.responded"),
                "approvalState": .string(decision == .deny ? "denied" : "approved"),
                "approvalDecision": .string(decision.rawValue),
                "redactionStatus": .string("private-state-excluded")
            ],
            timestamp: timestamp
        )
        snapshot = RuntimeActivityProjector.snapshot(snapshot, applying: event)
        return try data.updateDispatch(
            dispatchId: dispatch.id,
            status: current.status,
            resultSnapshot: snapshot
        )
    }

    public func confirmRun(dispatchId: String, context: ServiceRequestContext? = nil) async throws -> RuntimeDispatch {
        try entitlement.requireSameMacExecution()
        let dispatch = try data.getDispatch(dispatchId)
        let requestContext = try authorizeDispatchAction(dispatch, context: context, actionName: "confirm")
        guard dispatch.isRunConfirmationPending else {
            throw ServiceGuard.invalidInput(
                context: requestContext,
                message: "This runtime dispatch is not waiting for Run confirmation."
            )
        }
        let thread = try data.getThread(dispatch.threadId)
        let sourceMessage = try data.getMessage(dispatch.messageId)
        let agent = try data.getAgent(dispatch.agentId)
        guard agent.workspaceId == thread.workspaceId else {
            throw ServiceGuard.invalidInput(
                context: requestContext,
                message: "The runtime agent no longer belongs to this thread workspace."
            )
        }
        guard agent.status == "active" else {
            throw ServiceGuard.unavailable(
                context: requestContext,
                reasonCode: .runtimeUnavailable,
                message: "Selected agent is not active."
            )
        }
        let bridge = try registry.get(agent.binding.runtimeType)
        let health = await bridge.getHealth(harnessId: agent.harness.id, config: agent.harness.config)
        guard health.status == .healthy else {
            throw ServiceGuard.unavailable(
                context: requestContext,
                reasonCode: health.status == .authRequired ? .authRequired : .runtimeUnavailable,
                message: health.status == .authRequired ? "Runtime authentication is required before running." : "Selected harness is not ready.",
                recovery: health.status == .authRequired ? "Sign in to OpenAI through the selected harness from Harnesses." : "Open Harnesses and run a health check."
            )
        }

        let updated = try markRunConfirmationAccepted(dispatch, context: requestContext)
        let request = try runtimeDispatchRequest(
            dispatch: updated,
            thread: thread,
            sourceMessage: sourceMessage,
            agent: agent
        )
        launchRuntimeDispatch(request, bridge: bridge, data: data, eventBus: eventBus)
        return updated
    }

    public func rejectRun(dispatchId: String, context: ServiceRequestContext? = nil) async throws -> RuntimeDispatch {
        let dispatch = try data.getDispatch(dispatchId)
        let requestContext = try authorizeDispatchAction(dispatch, context: context, actionName: "reject")
        guard dispatch.isRunConfirmationPending else {
            throw ServiceGuard.invalidInput(
                context: requestContext,
                message: "This runtime dispatch is not waiting for Run confirmation."
            )
        }
        return try rejectPendingRun(
            dispatch,
            context: requestContext,
            message: "Run rejected before the runtime started."
        )
    }

    public func retry(dispatchId: String, context: ServiceRequestContext? = nil) async throws -> RuntimeDispatch {
        try entitlement.requireSameMacExecution()
        let failedDispatch = try data.getDispatch(dispatchId)
        let requestContext = try authorizeDispatchAction(failedDispatch, context: context, actionName: "retry")
        guard failedDispatch.status == .failed else {
            throw ServiceGuard.invalidInput(
                context: requestContext,
                message: "Only failed runtime dispatches can be retried."
            )
        }
        guard failedDispatch.postedMessageId == nil,
              try !hasTerminalAgentMessage(dispatchId: failedDispatch.id, threadId: failedDispatch.threadId)
        else {
            throw ServiceGuard.blocked(
                context: requestContext,
                reasonCode: .policyBlocked,
                message: "Retry is blocked because this dispatch already has terminal output."
            )
        }
        let activeDispatchExists = try data.listDispatchesForThread(failedDispatch.threadId)
            .contains { $0.id != failedDispatch.id && $0.isActive }
        let sourceMessageId = failedDispatch.retrySourceMessageId
        let sourceMessage = try sourceMessageId.map(data.getMessage)
        let sourceExists = sourceMessage != nil
        let sourceHasRetryableContent: Bool
        if let sourceMessage {
            let sourceBelongsToDispatch = sourceMessage.threadId == failedDispatch.threadId
                && sourceMessage.senderType == .user
            let sourceHasText = !sourceMessage.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            let sourceHasAttachments = try !data.listMessageAttachments(messageId: sourceMessage.id).isEmpty
            sourceHasRetryableContent = sourceBelongsToDispatch
                && (sourceHasText || sourceHasAttachments)
        } else {
            sourceHasRetryableContent = false
        }
        let actionState = failedDispatch.actionState(
            capabilities: nil,
            hasActiveDispatchForThread: activeDispatchExists,
            sourceMessageExists: sourceExists,
            sourceHasRetryableContent: sourceHasRetryableContent
        )
        guard actionState.canRetry else {
            throw retryDenied(context: requestContext, reason: actionState.retryReason)
        }
        guard let sourceMessage else {
            throw retryDenied(context: requestContext, reason: .retrySourceMissing)
        }
        let thread = try data.getThread(failedDispatch.threadId)
        let agent = try data.getAgent(failedDispatch.agentId)
        guard agent.workspaceId == thread.workspaceId else {
            throw ServiceGuard.invalidInput(
                context: requestContext,
                message: "The retry agent no longer belongs to this thread workspace."
            )
        }
        guard agent.status == "active" else {
            throw ServiceGuard.unavailable(
                context: requestContext,
                reasonCode: .runtimeUnavailable,
                message: "Selected agent is not active."
            )
        }
        let bridge = try registry.get(agent.binding.runtimeType)
        let health = await bridge.getHealth(harnessId: agent.harness.id, config: agent.harness.config)
        guard health.status == .healthy else {
            throw ServiceGuard.unavailable(
                context: requestContext,
                reasonCode: health.status == .authRequired ? .authRequired : .runtimeUnavailable,
                message: health.status == .authRequired ? "Runtime authentication is required before retrying." : "Selected harness is not ready.",
                recovery: health.status == .authRequired ? "Sign in to OpenAI through the selected harness from Harnesses." : "Open Harnesses and run a health check."
            )
        }

        let attempt = failedDispatch.attempt + 1
        let session = try data.createRuntimeSession(threadId: thread.id, agentId: agent.id, runtimeBindingId: agent.binding.id)
        let approvalMode = approvalMode(for: failedDispatch) ?? currentApprovalMode()
        let requiresRunConfirmation = approvalMode.requiresRunConfirmation
        let createdAt = nowIso()
        let correlationId = UUID().uuidString
        let artifactContract = try createArtifactContract(correlationId: correlationId, createdAt: createdAt)
        var inputSnapshot: JSONRecord = [
            "content": .string(sourceMessage.content),
            "agentId": .string(agent.id),
            "harnessId": .string(agent.harness.id),
            "runtimeType": .string(agent.binding.runtimeType.rawValue),
            "attempt": .number(Double(attempt)),
            "retrySourceMessageId": .string(sourceMessage.id),
            "retryOfDispatchId": .string(failedDispatch.id),
            "retrySafetyEvidenceId": .string(failedDispatch.retrySafetyEvidenceId ?? "dispatch.retry.source-message"),
            "retryable": .bool(false),
            "runtimeApprovalMode": .string(approvalMode.rawValue),
            "artifactContract": .object(artifactContract.metadata),
            "artifactDirectoryPath": .string(artifactContract.runDirectoryPath),
            "artifactRootPath": .string(artifactContract.rootPath),
            "sourceMessageMetadata": .object(sourceMessage.metadata)
        ]
        if requiresRunConfirmation {
            inputSnapshot.merge(runConfirmationInputSnapshot(agentName: agent.name, inputContent: sourceMessage.content)) { _, new in new }
        }
        let retryDispatch = try data.createDispatch(
            threadId: thread.id,
            messageId: sourceMessage.id,
            agentId: agent.id,
            harnessId: agent.harness.id,
            sessionId: session.id,
            correlationId: correlationId,
            inputSnapshot: inputSnapshot
        )
        let recentMessages = try data.listMessages(threadId: thread.id, limit: 40)
        _ = try? data.log(
            severity: "info",
            category: "dispatch",
            message: "Dispatch retry queued.",
            correlationId: retryDispatch.correlationId,
            dispatchId: retryDispatch.id,
            harnessId: agent.harness.id,
            threadId: thread.id,
            detail: [
                "retryOfDispatchId": .string(failedDispatch.id),
                "retrySourceMessageId": .string(sourceMessage.id),
                "attempt": .number(Double(attempt))
            ]
        )
        let request = RuntimeDispatchRequest(
            dispatchId: retryDispatch.id,
            correlationId: retryDispatch.correlationId,
            threadId: thread.id,
            messageId: sourceMessage.id,
            sessionId: session.id,
            attempt: attempt,
            agent: agent,
            runtimeBinding: agent.binding,
            harness: agent.harness,
            inputContent: sourceMessage.content,
            inputFormat: sourceMessage.contentFormat,
            recentMessages: recentMessages,
            approvalMode: approvalMode,
            timeoutMs: RuntimeDispatchTimeouts.chatTurnMs,
            createdAt: createdAt,
            artifactContract: artifactContract,
            attachmentPaths: try nativeImageAttachmentPaths(from: sourceMessage.metadata)
        )
        if requiresRunConfirmation {
            return try markRunConfirmationPending(
                dispatch: retryDispatch,
                agentName: agent.name,
                inputContent: sourceMessage.content
            )
        }
        launchRuntimeDispatch(request, bridge: bridge, data: data, eventBus: eventBus)
        return retryDispatch
    }

    private func currentApprovalMode() -> RuntimeApprovalMode {
        let legacyRunConfirmation: Bool = (try? data.getAppSetting(
            RuntimeExperienceSettings.runConfirmationEnabledKey,
            fallback: RuntimeExperienceSettings.defaultRunConfirmationEnabled
        )) ?? RuntimeExperienceSettings.defaultRunConfirmationEnabled
        let legacyMode = RuntimeApprovalMode.fromLegacyRunConfirmation(legacyRunConfirmation)
        return (try? data.getAppSetting(
            RuntimeExperienceSettings.approvalModeKey,
            fallback: legacyMode
        )) ?? legacyMode
    }

    private func approvalMode(for dispatch: RuntimeDispatch) -> RuntimeApprovalMode? {
        stringValue(dispatch.inputSnapshot["runtimeApprovalMode"]).flatMap(RuntimeApprovalMode.init(rawValue:))
            ?? stringValue(dispatch.resultSnapshot?["runtimeApprovalMode"]).flatMap(RuntimeApprovalMode.init(rawValue:))
            ?? stringValue(dispatch.errorSnapshot?["runtimeApprovalMode"]).flatMap(RuntimeApprovalMode.init(rawValue:))
    }

    private func runConfirmationInputSnapshot(agentName: String, inputContent: String) -> JSONRecord {
        [
            RuntimeRunConfirmationSnapshot.requiredKey: .bool(true),
            RuntimeRunConfirmationSnapshot.stateKey: .string(RuntimeRunConfirmationState.pending.rawValue),
            RuntimeRunConfirmationSnapshot.titleKey: .string("Run \(agentName)"),
            RuntimeRunConfirmationSnapshot.summaryKey: .string(runConfirmationSummary(for: inputContent)),
            RuntimeRunConfirmationSnapshot.requestedAtKey: .string(nowIso())
        ]
    }

    private func markRunConfirmationPending(
        dispatch: RuntimeDispatch,
        agentName: String,
        inputContent: String
    ) throws -> RuntimeDispatch {
        let timestamp = nowIso()
        var snapshot: JSONRecord = [
            RuntimeRunConfirmationSnapshot.requiredKey: .bool(true),
            RuntimeRunConfirmationSnapshot.stateKey: .string(RuntimeRunConfirmationState.pending.rawValue),
            RuntimeRunConfirmationSnapshot.titleKey: .string(dispatch.runConfirmationTitle ?? "Run \(agentName)"),
            RuntimeRunConfirmationSnapshot.summaryKey: .string(dispatch.runConfirmationSummary ?? runConfirmationSummary(for: inputContent)),
            RuntimeRunConfirmationSnapshot.requestedAtKey: dispatch.inputSnapshot[RuntimeRunConfirmationSnapshot.requestedAtKey] ?? .string(timestamp),
            "runtimeStatusMessage": .string("Waiting for Run confirmation")
        ]
        let event = RuntimeActivityProjectionEvent(
            id: createRelayId("evt"),
            dispatchId: dispatch.id,
            type: .status,
            text: "Run confirmation needed",
            status: "Waiting for Run confirmation",
            detail: [
                "gatewayEventType": .string("runtime.confirmation.pending"),
                "confirmationState": .string(RuntimeRunConfirmationState.pending.rawValue),
                "redactionStatus": .string("private-state-excluded")
            ],
            timestamp: timestamp
        )
        snapshot = RuntimeActivityProjector.snapshot(snapshot, applying: event)
        return try data.updateDispatch(dispatchId: dispatch.id, status: .queued, resultSnapshot: snapshot)
    }

    private func markRunConfirmationAccepted(
        _ dispatch: RuntimeDispatch,
        context: ServiceRequestContext
    ) throws -> RuntimeDispatch {
        let timestamp = nowIso()
        var snapshot = dispatch.resultSnapshot ?? [:]
        snapshot[RuntimeRunConfirmationSnapshot.requiredKey] = .bool(true)
        snapshot[RuntimeRunConfirmationSnapshot.stateKey] = .string(RuntimeRunConfirmationState.accepted.rawValue)
        snapshot[RuntimeRunConfirmationSnapshot.decidedAtKey] = .string(timestamp)
        snapshot[RuntimeRunConfirmationSnapshot.decidedByKey] = .string(context.actorId)
        snapshot["runtimeStatusMessage"] = .string("Run confirmed")
        let event = RuntimeActivityProjectionEvent(
            id: createRelayId("evt"),
            dispatchId: dispatch.id,
            type: .status,
            text: "Run confirmed",
            status: "Starting runtime",
            detail: [
                "gatewayEventType": .string("runtime.confirmation.accepted"),
                "confirmationState": .string(RuntimeRunConfirmationState.accepted.rawValue),
                "redactionStatus": .string("private-state-excluded")
            ],
            timestamp: timestamp
        )
        snapshot = RuntimeActivityProjector.snapshot(snapshot, applying: event)
        return try data.updateDispatch(dispatchId: dispatch.id, status: .queued, resultSnapshot: snapshot)
    }

    private func rejectPendingRun(
        _ dispatch: RuntimeDispatch,
        context: ServiceRequestContext,
        message: String
    ) throws -> RuntimeDispatch {
        let timestamp = nowIso()
        var snapshot = dispatch.errorSnapshot ?? [:]
        if let activityProjection = dispatch.resultSnapshot?[RuntimeActivityProjection.snapshotKey] {
            snapshot[RuntimeActivityProjection.snapshotKey] = activityProjection
        }
        for key in [
            RuntimeRunConfirmationSnapshot.requiredKey,
            RuntimeRunConfirmationSnapshot.titleKey,
            RuntimeRunConfirmationSnapshot.summaryKey,
            RuntimeRunConfirmationSnapshot.requestedAtKey
        ] {
            if snapshot[key] == nil {
                snapshot[key] = dispatch.resultSnapshot?[key] ?? dispatch.inputSnapshot[key]
            }
        }
        snapshot[RuntimeRunConfirmationSnapshot.stateKey] = .string(RuntimeRunConfirmationState.rejected.rawValue)
        snapshot[RuntimeRunConfirmationSnapshot.decidedAtKey] = .string(timestamp)
        snapshot[RuntimeRunConfirmationSnapshot.decidedByKey] = .string(context.actorId)
        snapshot["category"] = .string("run_confirmation_rejected")
        snapshot["message"] = .string(message)
        snapshot["retryable"] = .bool(false)
        snapshot["runtimeType"] = dispatch.inputSnapshot["runtimeType"]
        snapshot["attempt"] = dispatch.inputSnapshot["attempt"]
        return try data.updateDispatch(dispatchId: dispatch.id, status: .cancelled, errorSnapshot: snapshot)
    }

    private func runtimeDispatchRequest(
        dispatch: RuntimeDispatch,
        thread: ThreadDetail,
        sourceMessage: Message,
        agent: AgentWithBinding
    ) throws -> RuntimeDispatchRequest {
        RuntimeDispatchRequest(
            dispatchId: dispatch.id,
            correlationId: dispatch.correlationId,
            threadId: thread.id,
            messageId: sourceMessage.id,
            sessionId: dispatch.sessionId,
            attempt: dispatch.attempt,
            agent: agent,
            runtimeBinding: agent.binding,
            harness: agent.harness,
            inputContent: stringValue(dispatch.inputSnapshot["content"]) ?? sourceMessage.content,
            inputFormat: sourceMessage.contentFormat,
            recentMessages: try data.listMessages(threadId: thread.id, limit: 40),
            approvalMode: approvalMode(for: dispatch) ?? currentApprovalMode(),
            timeoutMs: 60_000,
            createdAt: nowIso(),
            artifactContract: artifactContract(from: dispatch.inputSnapshot),
            attachmentPaths: try nativeImageAttachmentPaths(from: sourceMessage.metadata)
        )
    }

    private func nativeImageAttachmentPaths(from metadata: JSONRecord) throws -> [String] {
        guard case .array(let values)? = metadata["attachments"] else { return [] }
        let attachmentIds = values.compactMap { value -> String? in
            guard case .object(let attachment) = value else { return nil }
            return attachment["id"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        guard !attachmentIds.isEmpty else { return [] }

        let store = NativeChatAttachmentStore(appDataRoot: paths.root)
        var seen = Set<String>()
        return try attachmentIds.compactMap { attachmentId in
            guard !attachmentId.isEmpty, seen.insert(attachmentId).inserted else { return nil }
            return try store.readableImagePath(for: data.getAttachment(attachmentId))
        }
    }

    private func launchRuntimeDispatch(
        _ request: RuntimeDispatchRequest,
        bridge: DesktopRuntimeBridge,
        data: LocalDataService,
        eventBus: RelayEventBus
    ) {
        Task.detached { [data, eventBus] in
            await self.runDispatch(request, bridge: bridge, data: data, eventBus: eventBus)
        }
    }

    private func runConfirmationSummary(for content: String) -> String {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Run this runtime turn" }
        if trimmed.count <= 180 {
            return trimmed
        }
        return String(trimmed.prefix(177)) + "..."
    }

    private func runDispatch(_ request: RuntimeDispatchRequest, bridge: DesktopRuntimeBridge, data: LocalDataService, eventBus: RelayEventBus) async {
        let sink = DispatchSink { event in
            _ = try? self.updateDispatchFromRuntimeEvent(event, request: request, data: data)
            let runtimeEvent = RuntimeEvent(
                id: event.id,
                dispatchId: event.dispatchId,
                threadId: request.threadId,
                agentId: request.agent.id,
                runtimeType: request.harness.runtimeType,
                type: event.type,
                text: event.text,
                status: event.status,
                detail: event.detail,
                timestamp: event.timestamp
            )
            _ = try? data.log(
                severity: event.type == .failed ? "error" : "info",
                category: "runtime",
                message: event.status ?? event.type.rawValue,
                correlationId: event.correlationId,
                dispatchId: event.dispatchId,
                harnessId: request.harness.id,
                threadId: request.threadId,
                detail: ["type": .string(event.type.rawValue), "text": .string(event.text ?? "")]
            )
            eventBus.emit(.runtimeEvent, runtimeEvent)
        }

        let result = await bridge.dispatchTurn(request, sink: sink)
        do {
            let current = try data.getDispatch(request.dispatchId)
            if current.status == .cancelled {
                return
            }
            if current.status == .failed, result.status != "failed" {
                return
            }
            if result.status == "completed" {
                let finalText = result.finalText ?? ""
                let existingMessage = try terminalAgentMessage(dispatchId: request.dispatchId, threadId: request.threadId)
                let createdTerminalMessage = existingMessage == nil
                let posted: Message
                let terminalMetadata = terminalMessageMetadata(request: request, resultMetadata: result.metadata)
                if let existingMessage {
                    let mergedMetadata = existingMessage.metadata.merging(terminalMetadata) { _, new in new }
                    posted = try data.updateMessageMetadata(messageId: existingMessage.id, metadata: mergedMetadata)
                } else {
                    posted = try data.createMessage(
                        threadId: request.threadId,
                        senderType: .agent,
                        senderId: request.agent.id,
                        senderName: request.agent.name,
                        content: finalText,
                        contentFormat: result.contentFormat,
                        metadata: terminalMetadata
                    )
                }
                var resultSnapshot = current.resultSnapshot ?? [:]
                resultSnapshot["finalText"] = .string(finalText)
                resultSnapshot["postedMessageId"] = .string(posted.id)
                resultSnapshot["runtimeType"] = .string(request.harness.runtimeType.rawValue)
                resultSnapshot["attempt"] = .number(Double(request.attempt))
                resultSnapshot["retrySourceMessageId"] = .string(request.messageId)
                resultSnapshot["metadata"] = .object(result.metadata)
                if let artifactContract = request.artifactContract {
                    resultSnapshot["artifactContract"] = .object(artifactContract.metadata)
                    resultSnapshot["artifactDirectoryPath"] = .string(artifactContract.runDirectoryPath)
                    resultSnapshot["artifactRootPath"] = .string(artifactContract.rootPath)
                }
                _ = try data.updateDispatch(dispatchId: request.dispatchId, status: .completed, resultSnapshot: resultSnapshot)
                if createdTerminalMessage {
                    do {
                        try await routeAgentMentionFollowUps(sourceMessage: posted, sourceAgent: request.agent)
                    } catch {
                        _ = try? data.log(
                            severity: "warn",
                            category: "dispatch",
                            message: "Agent mention follow-up routing failed.",
                            correlationId: request.correlationId,
                            dispatchId: request.dispatchId,
                            harnessId: request.harness.id,
                            threadId: request.threadId,
                            detail: [
                                "sourceMessageId": .string(posted.id),
                                "sourceAgentId": .string(request.agent.id),
                                "error": .string(error.localizedDescription)
                            ]
                        )
                    }
                }
            } else if result.status == "cancelled" {
                var errorSnapshot = current.errorSnapshot ?? [:]
                if let activityProjection = current.resultSnapshot?[RuntimeActivityProjection.snapshotKey] {
                    errorSnapshot[RuntimeActivityProjection.snapshotKey] = activityProjection
                }
                errorSnapshot["category"] = .string(result.error?.category ?? "cancelled")
                errorSnapshot["message"] = .string(result.error?.message ?? "Dispatch cancelled.")
                errorSnapshot["retryable"] = .bool(false)
                errorSnapshot["runtimeType"] = .string(request.harness.runtimeType.rawValue)
                errorSnapshot["attempt"] = .number(Double(request.attempt))
                _ = try data.updateDispatch(dispatchId: request.dispatchId, status: .cancelled, errorSnapshot: errorSnapshot)
            } else {
                let retryable = result.error?.recoverable ?? true
                var errorSnapshot = current.errorSnapshot ?? [:]
                if let activityProjection = current.resultSnapshot?[RuntimeActivityProjection.snapshotKey] {
                    errorSnapshot[RuntimeActivityProjection.snapshotKey] = activityProjection
                }
                errorSnapshot["category"] = .string(result.error?.category ?? "unknown")
                errorSnapshot["message"] = .string(result.error?.message ?? "Dispatch failed.")
                errorSnapshot["retryable"] = .bool(retryable)
                errorSnapshot["runtimeType"] = .string(request.harness.runtimeType.rawValue)
                errorSnapshot["attempt"] = .number(Double(request.attempt))
                errorSnapshot["retrySourceMessageId"] = .string(request.messageId)
                if let retryOfDispatchId = stringValue(current.inputSnapshot["retryOfDispatchId"]) {
                    errorSnapshot["retryOfDispatchId"] = .string(retryOfDispatchId)
                }
                if retryable {
                    errorSnapshot["retrySafetyEvidenceId"] = .string(retrySafetyEvidenceId(dispatchId: request.dispatchId, messageId: request.messageId, attempt: request.attempt))
                }
                _ = try data.updateDispatch(dispatchId: request.dispatchId, status: .failed, errorSnapshot: errorSnapshot)
            }
        } catch {
            _ = try? data.updateDispatch(dispatchId: request.dispatchId, status: .failed, errorSnapshot: [
                "category": .string("unknown"),
                "message": .string(error.localizedDescription),
                "retryable": .bool(false),
                "runtimeType": .string(request.harness.runtimeType.rawValue),
                "attempt": .number(Double(request.attempt))
            ])
        }
    }

    private func routeAgentMentionFollowUps(
        sourceMessage: Message,
        sourceAgent: AgentWithBinding
    ) async throws {
        guard sourceMessage.senderType == .agent else { return }
        let thread = try data.getThread(sourceMessage.threadId)
        guard thread.threadType == .team else { return }
        let alreadyQueued = try data.listDispatchesForThread(thread.id)
            .contains { $0.messageId == sourceMessage.id }
        guard !alreadyQueued else { return }
        guard try teamRelayShouldRouteFollowUp(thread: thread, sourceMessage: sourceMessage) else { return }
        let route = try resolveDispatchRoute(
            thread: thread,
            fallbackAgent: sourceAgent,
            content: sourceMessage.content,
            excludingAgentId: sourceAgent.id
        )
        guard !route.agents.isEmpty else { return }
        let preparedTargets = try await prepareDispatchTargets(route.agents)
        for prepared in preparedTargets {
            try queueRuntimeDispatch(
                thread: thread,
                sourceMessage: sourceMessage,
                agent: prepared.agent,
                bridge: prepared.bridge,
                inputContent: sourceMessage.content,
                inputFormat: sourceMessage.contentFormat,
                attempt: 1,
                sourceMetadata: sourceMessage.metadata,
                approvalMode: currentApprovalMode(),
                route: route,
                threadWasNew: nil
            )
        }
    }

    private func activeTeamRelaySession(in thread: ThreadDetail) -> ChatSession? {
        guard thread.threadType == .team, let activeSessionId = thread.activeSessionId else { return nil }
        return thread.sessions.first { $0.id == activeSessionId && $0.status == .active && !$0.isReadOnly }
    }

    private func teamRelaySession(for sourceMessage: Message, in thread: ThreadDetail) -> ChatSession? {
        let sessionId = sourceMessage.threadSessionId ?? thread.activeSessionId
        guard let sessionId else { return nil }
        return thread.sessions.first { $0.id == sessionId }
    }

    private func teamRelayShouldRouteFollowUp(thread: ThreadDetail, sourceMessage: Message) throws -> Bool {
        guard let session = teamRelaySession(for: sourceMessage, in: thread),
              session.status == .active,
              !session.isReadOnly
        else {
            return false
        }
        if session.relayRunState == .paused {
            _ = try? data.log(
                severity: "info",
                category: "dispatch",
                message: "Team relay follow-up skipped because the cycle is paused.",
                threadId: thread.id,
                detail: [
                    "sourceMessageId": .string(sourceMessage.id),
                    "sessionId": .string(session.id),
                    "pauseReason": session.relayPauseReason.map { .string($0.rawValue) } ?? .null
                ]
            )
            return false
        }
        let replyCount = try data.countAgentMessages(threadId: thread.id, sessionId: session.id)
        guard replyCount < session.relayReplyLimit else {
            _ = try data.updateChatSessionRelayControls(
                sessionId: session.id,
                runState: .paused,
                pauseReason: .replyLimit,
                replyLimit: session.relayReplyLimit
            )
            _ = try? data.log(
                severity: "info",
                category: "dispatch",
                message: "Team relay follow-up skipped because the reply limit was reached.",
                threadId: thread.id,
                detail: [
                    "sourceMessageId": .string(sourceMessage.id),
                    "sessionId": .string(session.id),
                    "replyCount": .number(Double(replyCount)),
                    "replyLimit": .number(Double(session.relayReplyLimit))
                ]
            )
            return false
        }
        return true
    }

    private func routeLatestPendingTeamRelayMessage(threadId: String) async throws {
        let thread = try data.getThread(threadId)
        guard thread.threadType == .team, let session = activeTeamRelaySession(in: thread) else { return }
        let dispatches = try data.listDispatchesForThread(thread.id)
        if dispatches.contains(where: \.isActive) {
            return
        }
        let routedSourceMessageIds = Set(dispatches.map(\.messageId))
        let messages = try data.listMessagesInThreadOrder(threadId: thread.id, sessionId: session.id)
        guard let sourceMessage = messages.reversed().first(where: { message in
            message.senderType == .agent && !routedSourceMessageIds.contains(message.id)
        }) else {
            return
        }
        guard let sourceAgentId = sourceMessage.senderId else { return }
        let sourceAgent = try data.getAgent(sourceAgentId)
        try await routeAgentMentionFollowUps(sourceMessage: sourceMessage, sourceAgent: sourceAgent)
    }

    @discardableResult
    private func updateDispatchFromRuntimeEvent(
        _ event: RuntimeBridgeEvent,
        request: RuntimeDispatchRequest,
        data: LocalDataService
    ) throws -> RuntimeDispatch? {
        guard let nextStatus = dispatchStatus(for: event.type) else {
            return nil
        }
        let current = try data.getDispatch(event.dispatchId)
        if current.status == .cancelled {
            return current
        }
        if current.isTerminal, current.status != nextStatus {
            return current
        }
        let persistedStatus = bridgeEventPersistenceStatus(
            for: event.type,
            currentStatus: current.status,
            eventStatus: nextStatus
        )

        switch event.type {
        case .failed:
            var snapshot = current.errorSnapshot ?? [:]
            let retryable = boolValue(event.detail["retryable"]) ?? true
            snapshot["category"] = event.detail["category"] ?? .string(event.status ?? "runtime_failed")
            snapshot["message"] = .string(event.status ?? event.text ?? "Dispatch failed.")
            snapshot["retryable"] = .bool(retryable)
            snapshot["runtimeType"] = .string(request.harness.runtimeType.rawValue)
            snapshot["attempt"] = .number(Double(request.attempt))
            snapshot["retrySourceMessageId"] = .string(request.messageId)
            if retryable, snapshot["retrySafetyEvidenceId"] == nil {
                snapshot["retrySafetyEvidenceId"] = .string(retrySafetyEvidenceId(dispatchId: request.dispatchId, messageId: request.messageId, attempt: request.attempt))
            }
            snapshot = RuntimeActivityProjector.snapshot(snapshot, applying: event)
            return try data.updateDispatch(dispatchId: event.dispatchId, status: persistedStatus, errorSnapshot: snapshot)
        case .cancelled:
            var snapshot = current.errorSnapshot ?? [:]
            snapshot["category"] = .string("cancelled")
            snapshot["message"] = .string(event.status ?? event.text ?? "Dispatch cancelled.")
            snapshot["retryable"] = .bool(false)
            snapshot["runtimeType"] = .string(request.harness.runtimeType.rawValue)
            snapshot["attempt"] = .number(Double(request.attempt))
            snapshot = RuntimeActivityProjector.snapshot(snapshot, applying: event)
            return try data.updateDispatch(dispatchId: event.dispatchId, status: persistedStatus, errorSnapshot: snapshot)
        default:
            var snapshot = RuntimeActivityProjector.snapshot(current.resultSnapshot, applying: event)
            snapshot["runtimeType"] = .string(request.harness.runtimeType.rawValue)
            snapshot["attempt"] = .number(Double(request.attempt))
            snapshot["retrySourceMessageId"] = .string(request.messageId)
            if stringValue(event.detail["gatewayEventType"]) == "approval.request" {
                let payload = dispatchObjectValue(event.detail["payload"]) ?? [:]
                snapshot["runtimeApprovalState"] = .string("pending")
                snapshot["runtimeApprovalMode"] = .string(request.approvalMode.rawValue)
                snapshot["runtimeApprovalRequestedAt"] = .string(event.timestamp)
                snapshot["runtimeApprovalCommand"] = payload["command"] ?? .null
                snapshot["runtimeApprovalDescription"] = payload["description"] ?? .null
            } else if stringValue(event.detail["gatewayEventType"]) == "approval.responded" {
                snapshot["runtimeApprovalState"] = event.detail["approvalState"] ?? .string("approved")
                snapshot["runtimeApprovalDecision"] = event.detail["approvalDecision"] ?? .null
                snapshot["runtimeApprovalDecidedAt"] = .string(event.timestamp)
            }
            return try data.updateDispatch(dispatchId: event.dispatchId, status: persistedStatus, resultSnapshot: snapshot)
        }
    }

    private func authorizeDispatchAction(
        _ dispatch: RuntimeDispatch,
        context: ServiceRequestContext?,
        actionName: String
    ) throws -> ServiceRequestContext {
        let thread = try data.getThread(dispatch.threadId)
        let requestContext = context ?? ServiceRequestContext(
            actorId: "local-profile",
            workspaceId: thread.workspaceId,
            roles: [.owner],
            correlationId: dispatch.correlationId
        )
        guard requestContext.workspaceId == thread.workspaceId else {
            throw ServiceGuard.invalidInput(
                context: requestContext,
                message: "Runtime dispatch does not belong to the requested workspace."
            )
        }
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .operator],
            context: requestContext,
            message: "Your current role cannot \(actionName) runtime dispatches.",
            recovery: "Ask an owner or operator to perform this action."
        ) {
            throw denied
        }
        return requestContext
    }

    private func retryDenied(context: ServiceRequestContext, reason: RuntimeDispatchActionReason) -> ServiceGuardResult {
        switch reason {
        case .failedRequired:
            return ServiceGuard.invalidInput(
                context: context,
                message: "Only failed runtime dispatches can be retried."
            )
        case .retryEvidenceMissing:
            return ServiceGuard.unavailable(
                context: context,
                reasonCode: .errorTerminal,
                message: "This runtime failure was not marked retryable."
            )
        case .retrySourceMissing:
            return ServiceGuard.unavailable(
                context: context,
                reasonCode: .dependencyMissing,
                message: "This runtime failure is missing its source message."
            )
        case .retryContentMissing:
            return ServiceGuard.invalidInput(
                context: context,
                message: "The original message has no retryable content."
            )
        case .activeDispatchExists:
            return ServiceGuard.blocked(
                context: context,
                reasonCode: .operationPending,
                message: "Wait for the current message to finish sending first."
            )
        default:
            return ServiceGuard.unavailable(
                context: context,
                reasonCode: .actionUnsupported,
                message: "Retry is unavailable for this runtime dispatch."
            )
        }
    }

    private func hasTerminalAgentMessage(dispatchId: RelayId, threadId: RelayId) throws -> Bool {
        try terminalAgentMessage(dispatchId: dispatchId, threadId: threadId) != nil
    }

    private func terminalAgentMessage(dispatchId: RelayId, threadId: RelayId) throws -> Message? {
        try data.listMessages(threadId: threadId)
            .first { message in
                message.senderType == .agent && stringValue(message.metadata["dispatchId"]) == dispatchId
            }
    }

    private func terminalMessageMetadata(request: RuntimeDispatchRequest, resultMetadata: JSONRecord) -> JSONRecord {
        var metadata = resultMetadata
        metadata["dispatchId"] = .string(request.dispatchId)
        metadata["runtimeType"] = .string(request.harness.runtimeType.rawValue)
        metadata["attempt"] = .number(Double(request.attempt))
        metadata["retrySourceMessageId"] = .string(request.messageId)
        if let artifactContract = request.artifactContract {
            metadata["artifactContract"] = .object(artifactContract.metadata)
            metadata["artifactDirectoryPath"] = .string(artifactContract.runDirectoryPath)
            metadata["artifactRootPath"] = .string(artifactContract.rootPath)
        }
        return metadata
    }

    private func retrySafetyEvidenceId(dispatchId: RelayId, messageId: RelayId, attempt: Int) -> String {
        "dispatch.retry.\(dispatchId).\(messageId).attempt-\(attempt)"
    }

    @discardableResult
    private func markLocalSendState(message: Message, state: LocalSendState, detail: JSONRecord = [:]) throws -> Message {
        var metadata = message.metadata
        metadata["localSendState"] = .string(state.rawValue)
        for (key, value) in detail {
            metadata[key] = value
        }
        return try data.updateMessageMetadata(messageId: message.id, metadata: metadata)
    }
}

private final class DispatchSink: RuntimeEventSink {
    private let handler: (RuntimeBridgeEvent) async -> Void
    init(handler: @escaping (RuntimeBridgeEvent) async -> Void) {
        self.handler = handler
    }
    func emit(_ event: RuntimeBridgeEvent) async {
        await handler(event)
    }
}

private func dispatchStatus(for type: RuntimeEventType) -> DispatchStatus? {
    switch type {
    case .queued:
        return .queued
    case .started:
        return .started
    case .status, .delta, .thinking, .tool, .context:
        return .streaming
    case .completed:
        return .completed
    case .failed:
        return .failed
    case .cancelled:
        return .cancelled
    default:
        return nil
    }
}

private func bridgeEventPersistenceStatus(
    for type: RuntimeEventType,
    currentStatus: DispatchStatus,
    eventStatus: DispatchStatus
) -> DispatchStatus {
    switch type {
    case .completed, .failed, .cancelled:
        return currentStatus == .queued ? .streaming : currentStatus
    default:
        return eventStatus
    }
}

private func dispatchObjectValue(_ value: JSONValue?) -> JSONRecord? {
    guard case .object(let object)? = value else { return nil }
    return object
}
