import Foundation

public struct ChatEventPayload: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var eventName: String
    public var threadId: RelayId
    public var workspaceId: RelayId
    public var messageId: RelayId?
    public var sessionId: RelayId?
    public var readStateId: RelayId?
    public var wrapUpReportId: RelayId?
    public var dispatchId: RelayId?
    public var sourceRecordIds: JSONRecord
    public var detail: JSONRecord
    public var timestamp: IsoTimestamp
}

public struct ChatEventReplayApplyResult: Codable, Equatable, Sendable {
    public var accepted: Bool
    public var duplicate: Bool
    public var eventId: RelayId
}

public struct ChatEventReplaySnapshot: Codable, Equatable, Sendable {
    public var eventIds: Set<RelayId>
    public var threadIds: Set<RelayId>
    public var messageIds: Set<RelayId>
    public var readStateIds: Set<RelayId>
    public var wrapUpReportIds: Set<RelayId>
    public var archivedThreadIds: Set<RelayId>

    public var eventCount: Int { eventIds.count }
}

public struct ChatEventReplayReducer: Sendable {
    private var eventIds: Set<RelayId> = []
    private var threadIds: Set<RelayId> = []
    private var messageIds: Set<RelayId> = []
    private var readStateIds: Set<RelayId> = []
    private var wrapUpReportIds: Set<RelayId> = []
    private var archivedThreadIds: Set<RelayId> = []

    public init() {}

    public mutating func apply(_ payload: ChatEventPayload) -> ChatEventReplayApplyResult {
        guard !eventIds.contains(payload.id) else {
            return ChatEventReplayApplyResult(accepted: false, duplicate: true, eventId: payload.id)
        }
        eventIds.insert(payload.id)
        threadIds.insert(payload.threadId)
        if let messageId = payload.messageId {
            messageIds.insert(messageId)
        }
        if let readStateId = payload.readStateId {
            readStateIds.insert(readStateId)
        }
        if let wrapUpReportId = payload.wrapUpReportId {
            wrapUpReportIds.insert(wrapUpReportId)
        }
        if payload.eventName == RelayEventName.chatThreadArchived.rawValue {
            archivedThreadIds.insert(payload.threadId)
        }
        return ChatEventReplayApplyResult(accepted: true, duplicate: false, eventId: payload.id)
    }

    public func snapshot() -> ChatEventReplaySnapshot {
        ChatEventReplaySnapshot(
            eventIds: eventIds,
            threadIds: threadIds,
            messageIds: messageIds,
            readStateIds: readStateIds,
            wrapUpReportIds: wrapUpReportIds,
            archivedThreadIds: archivedThreadIds
        )
    }
}

public final class ChatService {
    private let data: LocalDataService
    private let eventBus: RelayEventBus

    public init(data: LocalDataService, eventBus: RelayEventBus) {
        self.data = data
        self.eventBus = eventBus
    }

    public func listThreads(context: ServiceRequestContext, status: String = "active") throws -> [ThreadSummary] {
        _ = try data.getWorkspace(context.workspaceId)
        return try data.listThreads(workspaceId: context.workspaceId, status: status)
    }

    public func getThread(_ threadId: String, context: ServiceRequestContext) throws -> ThreadDetail {
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        return thread
    }

    public func getComposerDraft(
        context: ServiceRequestContext,
        threadId: String,
        profileId: String? = nil
    ) throws -> ChatComposerDraft? {
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        return try data.getComposerDraft(threadId: threadId, profileId: profileId ?? context.actorId)
    }

    @discardableResult
    public func saveComposerDraft(
        context: ServiceRequestContext,
        threadId: String,
        profileId: String? = nil,
        content: String,
        metadata: JSONRecord = [:]
    ) throws -> ChatComposerDraft? {
        try requireRoles([.owner, .admin, .member], context: context, message: "Editing a draft requires member access.")
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        return try data.saveComposerDraft(
            threadId: threadId,
            profileId: profileId ?? context.actorId,
            content: content,
            metadata: metadata
        )
    }

    public func clearComposerDraft(
        context: ServiceRequestContext,
        threadId: String,
        profileId: String? = nil
    ) throws {
        try requireRoles([.owner, .admin, .member], context: context, message: "Clearing a draft requires member access.")
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        try data.clearComposerDraft(threadId: threadId, profileId: profileId ?? context.actorId)
    }

    public func mentionAvailability(
        context: ServiceRequestContext,
        threadId: String
    ) throws -> ChatMentionAvailability {
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        guard thread.threadType == .team else {
            return ChatMentionAvailability(
                isAvailable: false,
                reasonCode: .featureUnavailable,
                message: "Mentions are available only in team chats.",
                help: "Select a team chat before using mentions."
            )
        }
        let activeAgentCount = thread.participants
            .filter { $0.participantType == .agent && $0.leftAt == nil }
            .compactMap(\.participantId)
            .compactMap { try? data.getAgent($0) }
            .filter { $0.workspaceId == thread.workspaceId && $0.status == "active" }
            .count
        guard activeAgentCount > 0 else {
            return ChatMentionAvailability(
                isAvailable: false,
                reasonCode: .dependencyMissing,
                message: "Team mentions need at least one active agent participant.",
                help: "Add active agents to this team chat before using mentions."
            )
        }
        return ChatMentionAvailability(
            isAvailable: true,
            message: "Team mentions are available.",
            help: "Type @ to mention a team agent."
        )
    }

    public func listComposerAttachments(
        context: ServiceRequestContext,
        threadId: String,
        profileId: String? = nil
    ) throws -> [ChatAttachment] {
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        return try data.listComposerAttachments(threadId: threadId, profileId: profileId ?? context.actorId)
    }

    @discardableResult
    public func stageAttachment(
        context: ServiceRequestContext,
        threadId: String,
        profileId: String? = nil,
        fileName: String,
        mimeType: String,
        byteSize: Int,
        sha256: String,
        kind: ChatAttachmentKind,
        status: ChatAttachmentStatus = .uploaded,
        progress: Int = 100,
        provenance: JSONRecord = [:]
    ) throws -> ChatAttachment {
        try requireRoles([.owner, .admin, .member], context: context, message: "Adding an attachment requires member access.")
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        guard !thread.isArchived else {
            try deny(
                ServiceGuardResult(
                    stateKind: .readOnly,
                    reasonCode: .authorityReadOnly,
                    message: "Archived threads cannot add attachments.",
                    recovery: "Unarchive the thread before adding attachments.",
                    correlationId: context.correlationId,
                    auditRequired: true
                ),
                threadId: threadId,
                category: "chat-service"
            )
        }
        return try data.stageAttachment(
            threadId: threadId,
            profileId: profileId ?? context.actorId,
            fileName: fileName,
            mimeType: mimeType,
            byteSize: byteSize,
            sha256: sha256,
            kind: kind,
            status: status,
            progress: progress,
            provenance: provenance
        )
    }

    @discardableResult
    public func updateAttachmentStatus(
        context: ServiceRequestContext,
        threadId: String,
        attachmentId: String,
        status: ChatAttachmentStatus,
        progress: Int? = nil,
        error: JSONRecord? = nil
    ) throws -> ChatAttachment {
        try requireRoles([.owner, .admin, .member], context: context, message: "Updating an attachment requires member access.")
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        let current = try data.getAttachment(attachmentId)
        guard current.threadId == threadId else {
            try deny(
                ServiceGuard.invalidInput(context: context, message: "Attachment does not belong to this thread."),
                threadId: threadId,
                category: "chat-service"
            )
        }
        return try data.updateAttachmentStatus(attachmentId: attachmentId, status: status, progress: progress, error: error)
    }

    @discardableResult
    public func assignAttachmentsToMessage(
        context: ServiceRequestContext,
        threadId: String,
        profileId: String? = nil,
        messageId: String,
        attachmentIds: [String]
    ) throws -> [ChatAttachment] {
        try requireRoles([.owner, .admin, .member], context: context, message: "Sending attachments requires member access.")
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        return try data.assignAttachmentsToMessage(
            threadId: threadId,
            profileId: profileId ?? context.actorId,
            messageId: messageId,
            attachmentIds: attachmentIds
        )
    }

    @discardableResult
    public func createDocumentReference(
        context: ServiceRequestContext,
        messageId: String,
        title: String,
        referenceKind: ChatDocumentReferenceKind,
        displayPath: String? = nil,
        tokenCount: Int? = nil,
        isSensitive: Bool = false,
        isRedacted: Bool = false,
        metadata: JSONRecord = [:]
    ) throws -> ChatDocumentReference {
        let message = try data.getMessage(messageId)
        let thread = try data.getThread(message.threadId)
        try ensureThreadWorkspace(thread, context: context)
        return try data.createDocumentReference(
            messageId: messageId,
            title: title,
            referenceKind: referenceKind,
            displayPath: displayPath,
            tokenCount: tokenCount,
            isSensitive: isSensitive,
            isRedacted: isRedacted,
            metadata: metadata
        )
    }

    public func createOrReuseDirectThread(
        context: ServiceRequestContext,
        selectedAgentId: String,
        title: String? = nil
    ) throws -> ThreadDetail {
        try requireRoles([.owner, .admin, .member], context: context, message: "Creating a chat requires member access.")
        let agent = try requireActiveAgent(selectedAgentId, context: context)
        if let existing = try data
            .listThreads(workspaceId: context.workspaceId)
            .first(where: { $0.threadType == .direct && $0.selectedAgentId == agent.id && !$0.isArchived }) {
            return try data.getThread(existing.id)
        }
        let thread = try data.createThread(
            workspaceId: context.workspaceId,
            title: title ?? agent.name,
            selectedAgentId: agent.id,
            threadType: .direct
        )
        emit(.chatThreadUpdate, thread: thread, detail: ["action": .string("created")])
        return thread
    }

    public func createTeamThread(
        context: ServiceRequestContext,
        departmentId: String,
        title: String,
        selectedAgentIds: [String]
    ) throws -> ThreadDetail {
        try requireRoles([.owner, .admin, .member], context: context, message: "Creating a team chat requires member access.")
        let department = try data.getAgentOrgDepartment(departmentId)
        guard department.workspaceId == context.workspaceId else {
            try deny(
                ServiceGuard.invalidInput(context: context, message: "Selected department does not belong to this workspace."),
                threadId: nil,
                category: "chat-service"
            )
        }
        let trimmedTitle = try requireNonEmptyString(title, field: "Team chat name", maxLength: 160)
        var uniqueAgentIds: [String] = []
        for agentId in selectedAgentIds.map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) }) where !agentId.isEmpty {
            if !uniqueAgentIds.contains(agentId) {
                uniqueAgentIds.append(agentId)
            }
        }
        guard !uniqueAgentIds.isEmpty else {
            try deny(
                ServiceGuard.invalidInput(context: context, message: "Select at least one agent before creating a team chat."),
                threadId: nil,
                category: "chat-service"
            )
        }
        let selectedAgents = try uniqueAgentIds.map { try requireActiveAgent($0, context: context) }
        guard let primaryAgent = selectedAgents.first else {
            try deny(
                ServiceGuard.invalidInput(context: context, message: "Select at least one agent before creating a team chat."),
                threadId: nil,
                category: "chat-service"
            )
        }
        let thread = try data.createThread(
            workspaceId: context.workspaceId,
            title: trimmedTitle,
            selectedAgentId: primaryAgent.id,
            threadType: .team
        )
        for agent in selectedAgents {
            _ = try data.addThreadParticipant(
                threadId: thread.id,
                participantType: .agent,
                participantId: agent.id,
                displayName: agent.name,
                role: department.headAgentId == agent.id ? .manager : .member,
                isManager: department.headAgentId == agent.id
            )
        }
        let updatedThread = try data.getThread(thread.id)
        emit(.chatThreadUpdate, thread: updatedThread, detail: [
            "action": .string("created"),
            "threadType": .string(ThreadType.team.rawValue),
            "departmentId": .string(department.id),
            "participantCount": .number(Double(selectedAgents.count))
        ])
        return updatedThread
    }

    public func createMessage(
        context: ServiceRequestContext,
        threadId: String,
        senderType: SenderType,
        senderId: String? = nil,
        senderName: String,
        content: String,
        contentFormat: MessageFormat = .plain,
        metadata: JSONRecord = [:],
        runtimeAuthoritative: Bool = false
    ) throws -> Message {
        try requireRoles([.owner, .admin, .member], context: context, message: "Sending a message requires member access.")
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        if senderType == .agent && !runtimeAuthoritative {
            try deny(
                ServiceGuard.blocked(
                    context: context,
                    reasonCode: .policyBlocked,
                    message: "Agent messages must come from an authoritative runtime dispatch."
                ),
                threadId: threadId,
                category: "chat-service"
            )
        }
        let message = try data.createMessage(
            threadId: threadId,
            senderType: senderType,
            senderId: senderId,
            senderName: senderName,
            content: content,
            contentFormat: contentFormat,
            metadata: metadata
        )
        let updatedThread = try data.getThread(threadId)
        emit(.chatMessageNew, thread: updatedThread, message: message, detail: [
            "senderType": .string(senderType.rawValue),
            "contentFormat": .string(contentFormat.rawValue)
        ])
        emit(.chatThreadUpdate, thread: updatedThread, message: message, detail: ["action": .string("messageCreated")])
        return message
    }

    public func markThreadRead(
        context: ServiceRequestContext,
        threadId: String,
        profileId: String? = nil,
        lastReadMessageId: String? = nil
    ) throws -> ThreadReadState {
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        let readState = try data.markThreadRead(threadId: threadId, profileId: profileId, lastReadMessageId: lastReadMessageId)
        let updatedThread = try data.getThread(threadId)
        emit(.chatReadStateUpdate, thread: updatedThread, readState: readState, detail: ["action": .string("markRead")])
        emit(.chatThreadUpdate, thread: updatedThread, readState: readState, detail: ["action": .string("readStateUpdated")])
        return readState
    }

    public func archiveThread(context: ServiceRequestContext, threadId: String) throws -> ThreadDetail {
        try requireRoles([.owner, .admin, .member], context: context, message: "Archiving a thread requires member access.")
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        let archived = try data.archiveThread(threadId: threadId)
        emit(.chatThreadArchived, thread: archived, detail: ["action": .string("archived")])
        emit(.chatThreadUpdate, thread: archived, detail: ["action": .string("archived")])
        return archived
    }

    public func requestWrapUpReport(context: ServiceRequestContext, threadId: String) throws -> ThreadWrapUpReport {
        try requireRoles([.owner, .admin, .member], context: context, message: "Requesting a wrap-up requires member access.")
        let thread = try data.getThread(threadId)
        try ensureThreadWorkspace(thread, context: context)
        guard let sessionId = thread.activeSessionId else {
            try deny(
                ServiceGuard.invalidInput(
                    context: context,
                    message: "A wrap-up requires an active chat session."
                ),
                threadId: threadId,
                category: "chat-service"
            )
        }
        let messages = try data.listMessages(threadId: threadId, sessionId: sessionId)
        guard !messages.isEmpty else {
            try deny(
                ServiceGuard.invalidInput(
                    context: context,
                    message: "A wrap-up requires at least one message."
                ),
                threadId: threadId,
                category: "chat-service"
            )
        }
        let report = try data.createThreadWrapUpReport(
            threadId: threadId,
            sessionId: sessionId,
            status: .pending,
            title: "Cycle \(thread.sessions.first(where: { $0.id == sessionId })?.sequenceNumber ?? 1) transcript",
            metadata: ["requestedBy": .string(context.actorId)],
            messageCount: messages.count
        )
        _ = try data.wrapActiveRuntimeSessions(threadId: threadId)
        _ = try data.createChatSession(threadId: threadId)
        emit(.chatWrapUpUpdate, thread: try data.getThread(threadId), wrapUpReport: report, detail: ["action": .string("wrapUpReset")])
        return report
    }

    private func requireRoles(_ roles: Set<ServiceRole>, context: ServiceRequestContext, message: String) throws {
        if let denied = ServiceGuard.requireAnyRole(roles, context: context, message: message) {
            try deny(denied, threadId: nil, category: "chat-service")
        }
    }

    private func requireActiveAgent(_ agentId: String, context: ServiceRequestContext) throws -> AgentWithBinding {
        guard let agent = try? data.getAgent(agentId) else {
            try deny(
                ServiceGuard.invalidInput(context: context, message: "Selected agent was not found."),
                threadId: nil,
                category: "chat-service"
            )
        }
        guard agent.workspaceId == context.workspaceId else {
            try deny(
                ServiceGuard.invalidInput(context: context, message: "Selected agent does not belong to this workspace."),
                threadId: nil,
                category: "chat-service"
            )
        }
        guard agent.status == "active" else {
            try deny(
                ServiceGuard.invalidInput(context: context, message: "Selected agent is not active."),
                threadId: nil,
                category: "chat-service"
            )
        }
        return agent
    }

    private func ensureThreadWorkspace(_ thread: ThreadDetail, context: ServiceRequestContext) throws {
        guard thread.workspaceId == context.workspaceId else {
            try deny(
                ServiceGuard.invalidInput(context: context, message: "Thread does not belong to this workspace."),
                threadId: thread.id,
                category: "chat-service"
            )
        }
    }

    private func deny(_ result: ServiceGuardResult, threadId: String?, category: String) throws -> Never {
        _ = try? data.log(
            severity: "warning",
            category: category,
            message: "Denied chat action.",
            correlationId: result.correlationId,
            threadId: threadId,
            detail: [
                "stateKind": .string(result.stateKind.rawValue),
                "reasonCode": .string(result.reasonCode.rawValue),
                "auditRequired": .bool(result.auditRequired)
            ]
        )
        throw result
    }

    private func emit(
        _ eventName: RelayEventName,
        thread: ThreadDetail,
        message: Message? = nil,
        readState: ThreadReadState? = nil,
        wrapUpReport: ThreadWrapUpReport? = nil,
        detail: JSONRecord = [:]
    ) {
        let sessionId = message?.threadSessionId ?? thread.activeSessionId
        let sourceRecordIds: JSONRecord = [
            "threadId": .string(thread.id),
            "messageId": (message?.id).map { JSONValue.string($0) } ?? .null,
            "sessionId": sessionId.map { .string($0) } ?? .null,
            "readStateId": (readState?.id).map { JSONValue.string($0) } ?? .null,
            "wrapUpReportId": (wrapUpReport?.id).map { JSONValue.string($0) } ?? .null
        ]
        let payload = ChatEventPayload(
            id: createRelayId("che"),
            eventName: eventName.rawValue,
            threadId: thread.id,
            workspaceId: thread.workspaceId,
            messageId: message?.id,
            sessionId: sessionId,
            readStateId: readState?.id,
            wrapUpReportId: wrapUpReport?.id,
            dispatchId: message?.metadata["dispatchId"]?.string,
            sourceRecordIds: sourceRecordIds,
            detail: detail,
            timestamp: nowIso()
        )
        eventBus.emit(eventName, payload)
    }
}
