// ThreadViewModel.swift
// ClawChat – Single thread / conversation screen
// Swift 6, @Observable, @MainActor

import Foundation
import Observation
import SwiftData

@MainActor
@Observable
final class ThreadViewModel {

    // MARK: - Public State

    var thread: Thread
    var messages: [Message] = []
    var isLoading: Bool = false
    var isRefreshing: Bool = false
    var hasLoadedMessages: Bool = false
    var isSending: Bool = false
    var isAwaitingAgentReply: Bool = false
    var hasMore: Bool = false
    var error: String?
    var didRenderCachedMessages: Bool = false
    var didStartNetworkRefresh: Bool = false
    var typingUsers: Set<String> = []
    var composerText: String = ""

    // MARK: - Private

    private let api: APIClient
    private let ws: WebSocketClient
    private var page: Int = 1
    private var wsUnsubscribe: (() -> Void)?
    private var cacheContext: ModelContext?
    private var hasStartedRealtime = false
    private var awaitingReplyPollTask: _Concurrency.Task<Void, Never>?

    // MARK: - Init

    init(thread: Thread, api: APIClient = .shared, ws: WebSocketClient = .shared) {
        self.thread = thread
        self.api    = api
        self.ws     = ws
        Telemetry.shared.setThread(thread.id)
        Telemetry.shared.breadcrumb(
            "Thread view model initialized",
            category: "thread",
            attributes: ["threadId": thread.id, "workspaceId": thread.workspaceId, "threadType": thread.type.rawValue]
        )
        // Restore draft from UserDefaults
        let key = "clawchat.draft.\(thread.id)"
        if let saved = UserDefaults.standard.string(forKey: key), !saved.isEmpty {
            composerText = saved
        }
    }

    func cleanup() {
        // Persist draft
        let key = "clawchat.draft.\(thread.id)"
        if composerText.trimmingCharacters(in: .whitespaces).isEmpty {
            UserDefaults.standard.removeObject(forKey: key)
        } else {
            UserDefaults.standard.set(composerText, forKey: key)
        }
        wsUnsubscribe?()
        wsUnsubscribe = nil
        ws.unsubscribe(from: thread.id)
        awaitingReplyPollTask?.cancel()
        awaitingReplyPollTask = nil
        Telemetry.shared.breadcrumb("Thread view model cleaned up", category: "thread", attributes: ["threadId": thread.id])
    }

    func configureCache(_ context: ModelContext) {
        cacheContext = context
    }

    func startRealtimeAfterFirstRender() {
        guard !hasStartedRealtime else { return }
        hasStartedRealtime = true
        setupWebSocket()
    }

    func renderCachedMessagesForFirstOpen() {
        let startedAt = Date()
        Telemetry.shared.breadcrumb(
            "Cached message query started",
            category: "thread.open",
            attributes: ["threadId": thread.id, "workspaceId": thread.workspaceId]
        )
        hydrateCachedMessages()
        didRenderCachedMessages = true
        Telemetry.shared.breadcrumb(
            "Cached message query finished",
            category: "thread.open",
            attributes: [
                "threadId": thread.id,
                "messageCount": messages.count,
                "durationMs": startedAt.elapsedMilliseconds
            ]
        )
    }

    func refreshLatestMessagesInBackground(markReadWhenDone: Bool = true) async {
        guard !isLoading, !isRefreshing else { return }
        let startedAt = Date()
        didStartNetworkRefresh = true
        if messages.isEmpty {
            isLoading = true
        } else {
            isRefreshing = true
        }
        error = nil
        Telemetry.shared.breadcrumb(
            "Network refresh started",
            category: "thread.open",
            attributes: ["threadId": thread.id, "existingCount": messages.count]
        )
        do {
            let response = try await fetchLatestMessages(limit: 30)
            messages = mergeMessages(messages, response)
            hasMore = response.count >= 30
            hasLoadedMessages = true
            cacheMessages(response)
            Telemetry.shared.breadcrumb(
                "Network refresh finished",
                category: "thread.open",
                attributes: [
                    "threadId": thread.id,
                    "fetchedCount": response.count,
                    "renderedCount": messages.count,
                    "durationMs": startedAt.elapsedMilliseconds
                ]
            )
            if markReadWhenDone {
                _Concurrency.Task { await markRead() }
            }
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            recordMessageLoadError(error, operation: "message.latest", attributes: [
                "threadId": thread.id,
                "durationMs": startedAt.elapsedMilliseconds
            ])
        }
        isLoading = false
        isRefreshing = false
    }

    private func fetchLatestMessages(limit: Int) async throws -> [Message] {
        do {
            return try await api.request(
                .latestThreadMessages(threadId: thread.id, limit: limit, before: nil)
            )
        } catch APIError.notFound {
            Telemetry.shared.breadcrumb(
                "Latest message endpoint unavailable, falling back",
                category: "thread.open",
                level: .warning,
                attributes: ["threadId": thread.id]
            )
            let fallback: PaginatedResponse<Message> = try await api.requestPaginated(
                .threadMessages(threadId: thread.id, page: 1, pageSize: limit, before: nil)
            )
            return fallback.data
        }
    }

    // MARK: - Load Messages

    func loadMessages() async {
        guard !isLoading, !isRefreshing else { return }
        let startedAt = Date()
        Telemetry.shared.breadcrumb(
            "Thread message load started",
            category: "message.list",
            attributes: [
                "threadId": thread.id,
                "workspaceId": thread.workspaceId,
                "existingCount": messages.count,
                "hasCacheContext": cacheContext != nil
            ]
        )
        if messages.isEmpty {
            hydrateCachedMessages()
        }
        let cacheHydratedCount = messages.count
        if messages.isEmpty {
            isLoading = true
        } else {
            isRefreshing = true
        }
        error = nil
        page = 1
        do {
            let response: PaginatedResponse<Message> = try await api.requestPaginated(
                .threadMessages(threadId: thread.id, page: 1, pageSize: 30, before: nil)
            )
            messages = mergeMessages(messages, response.data)
            hasMore = response.hasMore
            hasLoadedMessages = true
            cacheMessages(response.data)
            Telemetry.shared.breadcrumb(
                "Thread messages loaded",
                category: "message.list",
                attributes: [
                    "threadId": thread.id,
                    "fetchedCount": response.data.count,
                    "renderedCount": messages.count,
                    "cacheHydratedCount": cacheHydratedCount,
                    "hasMore": response.hasMore,
                    "durationMs": startedAt.elapsedMilliseconds
                ]
            )
            if startedAt.elapsedMilliseconds > 1_500 {
                Telemetry.shared.capture(
                    message: "Slow thread message load",
                    level: .warning,
                    attributes: [
                        "operation": "message.list",
                        "threadId": thread.id,
                        "workspaceId": thread.workspaceId,
                        "fetchedCount": response.data.count,
                        "renderedCount": messages.count,
                        "cacheHydratedCount": cacheHydratedCount,
                        "durationMs": startedAt.elapsedMilliseconds
                    ]
                )
            }
            await markRead()
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            recordMessageLoadError(error, operation: "message.list", attributes: [
                "threadId": thread.id,
                "durationMs": startedAt.elapsedMilliseconds,
                "cacheHydratedCount": cacheHydratedCount
            ])
        }
        isLoading = false
        isRefreshing = false
    }

    /// Load older messages (pagination going back in time)
    func loadMore() async {
        guard hasMore, !isLoading, !isRefreshing, let oldest = messages.first else { return }
        let startedAt = Date()
        let previousCount = messages.count
        Telemetry.shared.breadcrumb(
            "Older thread message load started",
            category: "message.list",
            attributes: ["threadId": thread.id, "previousCount": previousCount, "beforeMessageId": oldest.id]
        )
        isLoading = true
        do {
            let response: PaginatedResponse<Message> = try await api.requestPaginated(
                .threadMessages(
                    threadId: thread.id,
                    page: 1,
                    pageSize: 30,
                    before: oldest.id
                )
            )
            messages = mergeMessages(response.data, messages)
            page += 1
            hasMore = response.hasMore
            cacheMessages(response.data)
            Telemetry.shared.breadcrumb(
                "Older thread messages loaded",
                category: "message.list",
                attributes: [
                    "threadId": thread.id,
                    "fetchedCount": response.data.count,
                    "previousCount": previousCount,
                    "renderedCount": messages.count,
                    "page": page,
                    "durationMs": startedAt.elapsedMilliseconds
                ]
            )
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            recordMessageLoadError(error, operation: "message.load_more", attributes: [
                "threadId": thread.id,
                "durationMs": startedAt.elapsedMilliseconds
            ])
        }
        isLoading = false
    }

    // MARK: - Send Message

    func sendMessage(
        approvalMode: RelayRuntimeApprovalMode = .askForApproval,
        dispatchConfirmed: Bool = true
    ) async {
        let content = composerText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty, !isSending else { return }
        composerText = ""
        UserDefaults.standard.removeObject(forKey: "clawchat.draft.\(thread.id)")
        await sendMessage(
            content: content,
            type: .text,
            approvalMode: approvalMode,
            dispatchConfirmed: dispatchConfirmed
        )
    }

    func sendMessage(
        content: String,
        type: MessageType,
        approvalMode: RelayRuntimeApprovalMode = .askForApproval,
        dispatchConfirmed: Bool = true
    ) async {
        guard !isSending else { return }
        isSending = true
        error = nil
        do {
            let sent: Message = try await api.request(
                .sendMessage(
                    threadId: thread.id,
                    content: content,
                    type: type.rawValue,
                    runtimeApprovalMode: approvalMode.rawValue,
                    runtimeDispatchConfirmed: dispatchConfirmed
                )
            )
            messages = mergeMessages(messages, [sent])
            cacheMessages([sent])
            if sent.isFromUser {
                isAwaitingAgentReply = true
                startAgentReplyFallbackPolling(after: sent)
            }
            Telemetry.shared.breadcrumb(
                "Message sent",
                category: "message.send",
                attributes: ["threadId": thread.id, "messageId": sent.id, "type": type.rawValue]
            )
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            Telemetry.shared.capture(error: error, attributes: ["operation": "message.send", "threadId": thread.id, "type": type.rawValue])
            // Restore composer text so the user doesn't lose their message
            if composerText.isEmpty { composerText = content }
        }
        isSending = false
    }

    // MARK: - Thread Actions

    func refreshThread() async {
        do {
            let updated: Thread = try await api.request(.thread(id: thread.id))
            thread = updated
        } catch {
            self.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    func markRead() async {
        guard thread.unreadCount > 0 else { return }
        do {
            let _: EmptyResponse = try await api.request(.markThreadRead(threadId: thread.id))
            thread.unreadCount = 0
        } catch {
            // Non-fatal – silently ignore
        }
    }

    // MARK: - Embedded Card Navigation

    func handleCardTap(_ card: EmbeddedCard) -> Route? {
        guard let refId = card.referenceId else { return nil }
        switch card.type {
        case .task:       return .taskDetail(taskId: refId)
        case .approval:   return .approvalDetail(approvalId: refId)
        case .incident:   return nil  // incident management not exposed on web
        case .report:     return nil  // navigate via parent coordinator
        default:          return nil
        }
    }

    // MARK: - Private: WebSocket

    private func setupWebSocket() {
        ws.subscribe(to: thread.id)
        Telemetry.shared.breadcrumb("Subscribed to thread websocket", category: "ws.thread", attributes: ["threadId": thread.id])
        wsUnsubscribe = ws.onEvent { [weak self] event in
            _Concurrency.Task { @MainActor [weak self] in
                self?.handleEvent(event)
            }
        }
    }

    private func handleEvent(_ event: WebSocketClient.Event) {
        switch event {
        case .messageNew(let msg) where msg.threadId == thread.id:
            if !messages.contains(where: { $0.id == msg.id }) {
                messages = mergeMessages(messages, [msg])
                cacheMessages([msg])
                Telemetry.shared.breadcrumb("Realtime message appended", category: "message.realtime", attributes: ["threadId": thread.id, "messageId": msg.id])
            }
            if !msg.isFromUser {
                typingUsers.removeAll()
                isAwaitingAgentReply = false
                stopAgentReplyFallbackPolling()
            }
        case .messageUpdate(let msg) where msg.threadId == thread.id:
            if let idx = messages.firstIndex(where: { $0.id == msg.id }) {
                messages[idx] = msg
                cacheMessages([msg])
            }
            if !msg.isFromUser {
                typingUsers.removeAll()
                isAwaitingAgentReply = false
                stopAgentReplyFallbackPolling()
            }
        case .typingStart(let tId, let senderId) where tId == thread.id:
            typingUsers.insert(senderId)
            isAwaitingAgentReply = false
        case .typingStop(let tId, let senderId) where tId == thread.id:
            typingUsers.remove(senderId)
        case .threadUpdate(let updated) where updated.id == thread.id:
            thread = updated
        case .dispatchStarted(let dispatch) where dispatch.threadId == thread.id:
            isAwaitingAgentReply = false
        case .dispatchCompleted(let dispatch) where dispatch.threadId == thread.id:
            isAwaitingAgentReply = false
        case .dispatchFailed(let dispatch) where dispatch.threadId == thread.id:
            isAwaitingAgentReply = false
        case .runDelta(let threadId, _, _) where threadId == thread.id:
            isAwaitingAgentReply = false
        case .runStatus(let threadId, _, let status) where threadId == thread.id:
            if status == "completed" || status == "failed" || status == "cancelled" {
                isAwaitingAgentReply = false
            }
        case .runtimeDispatchStarted(let dispatch) where dispatch.threadId == thread.id:
            isAwaitingAgentReply = false
        case .runtimeDispatchCompleted(let dispatch) where dispatch.threadId == thread.id:
            isAwaitingAgentReply = false
        case .runtimeDispatchFailed(let dispatch) where dispatch.threadId == thread.id:
            isAwaitingAgentReply = false
        case .runtimeDispatchCancelled(let dispatch) where dispatch.threadId == thread.id:
            isAwaitingAgentReply = false
        case .runtimeRunDelta(let event) where event.threadId == thread.id:
            isAwaitingAgentReply = false
        case .runtimeRunThinking(let event) where event.threadId == thread.id:
            isAwaitingAgentReply = false
        case .runtimeRunStatus(let event) where event.threadId == thread.id:
            isAwaitingAgentReply = false
        case .runtimeRunTool(let event) where event.threadId == thread.id:
            isAwaitingAgentReply = false
        default:
            break
        }
    }

    private func hydrateCachedMessages() {
        guard let cacheContext else { return }
        let startedAt = Date()
        do {
            var descriptor = FetchDescriptor<CachedMessage>(
                predicate: #Predicate { $0.threadId == thread.id },
                sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
            )
            descriptor.fetchLimit = 25
            let cached = try cacheContext.fetch(descriptor)
            let decoded = cached.compactMap { $0.toMessage() }.filter { $0.threadId == thread.id }
            guard !decoded.isEmpty else { return }
            messages = decoded.sorted { $0.createdAt < $1.createdAt }
            hasLoadedMessages = true
            Telemetry.shared.breadcrumb(
                "Hydrated cached thread messages",
                category: "message.cache",
                attributes: ["threadId": thread.id, "count": decoded.count, "durationMs": startedAt.elapsedMilliseconds]
            )
        } catch {
            Telemetry.shared.capture(
                error: error,
                attributes: ["operation": "message.cache.hydrate", "threadId": thread.id, "durationMs": startedAt.elapsedMilliseconds]
            )
        }
    }

    private func startAgentReplyFallbackPolling(after sentMessage: Message) {
        awaitingReplyPollTask?.cancel()
        let sentAt = sentMessage.createdAt
        let sentMessageId = sentMessage.id
        Telemetry.shared.breadcrumb(
            "Agent reply fallback polling started",
            category: "message.send",
            attributes: ["threadId": thread.id, "sentMessageId": sentMessageId]
        )
        awaitingReplyPollTask = _Concurrency.Task { [weak self] in
            let delays: [UInt64] = [
                2_000_000_000,
                2_000_000_000,
                3_000_000_000,
                5_000_000_000,
                8_000_000_000,
                13_000_000_000,
                21_000_000_000,
                30_000_000_000,
                30_000_000_000,
                30_000_000_000
            ]

            for delay in delays {
                guard !_Concurrency.Task.isCancelled else { return }
                try? await _Concurrency.Task.sleep(nanoseconds: delay)
                guard !_Concurrency.Task.isCancelled else { return }

                await self?.pollLatestMessagesForAgentReply(sentAt: sentAt, sentMessageId: sentMessageId)

                guard self?.isAwaitingAgentReply == true else { return }
            }

            await MainActor.run { [weak self] in
                guard let self else { return }
                Telemetry.shared.breadcrumb(
                    "Agent reply fallback polling exhausted",
                    category: "message.send",
                    level: .warning,
                    attributes: ["threadId": self.thread.id, "sentMessageId": sentMessageId]
                )
            }
        }
    }

    private func stopAgentReplyFallbackPolling() {
        awaitingReplyPollTask?.cancel()
        awaitingReplyPollTask = nil
    }

    private func pollLatestMessagesForAgentReply(sentAt: Date, sentMessageId: String) async {
        guard isAwaitingAgentReply else { return }
        let startedAt = Date()
        do {
            let latest = try await fetchLatestMessages(limit: 30)
            let merged = mergeMessages(messages, latest)
            messages = merged
            cacheMessages(latest)

            if merged.contains(where: { message in
                message.threadId == thread.id &&
                message.id != sentMessageId &&
                !message.isFromUser &&
                message.createdAt >= sentAt
            }) {
                typingUsers.removeAll()
                isAwaitingAgentReply = false
                stopAgentReplyFallbackPolling()
                Telemetry.shared.breadcrumb(
                    "Agent reply found by fallback polling",
                    category: "message.send",
                    attributes: [
                        "threadId": thread.id,
                        "sentMessageId": sentMessageId,
                        "durationMs": startedAt.elapsedMilliseconds
                    ]
                )
            }
        } catch {
            recordMessageLoadError(error, operation: "message.reply_poll", attributes: [
                "threadId": thread.id,
                "sentMessageId": sentMessageId,
                "durationMs": startedAt.elapsedMilliseconds
            ])
        }
    }

    private func cacheMessages(_ nextMessages: [Message]) {
        guard let cacheContext else { return }
        let scopedMessages = nextMessages.filter { $0.threadId == thread.id }
        guard !scopedMessages.isEmpty else { return }
        let startedAt = Date()

        do {
            for message in scopedMessages {
                if let existing = try cacheContext.fetch(FetchDescriptor<CachedMessage>(
                    predicate: #Predicate { $0.id == message.id }
                )).first {
                    existing.update(from: message)
                } else {
                    cacheContext.insert(CachedMessage(from: message))
                }
            }
            try cacheContext.save()
            Telemetry.shared.breadcrumb(
                "Cached thread messages",
                category: "message.cache",
                attributes: ["threadId": thread.id, "count": scopedMessages.count, "durationMs": startedAt.elapsedMilliseconds]
            )
        } catch {
            Telemetry.shared.capture(
                error: error,
                attributes: ["operation": "message.cache.save", "threadId": thread.id, "durationMs": startedAt.elapsedMilliseconds]
            )
        }
    }

    private func mergeMessages(_ groups: [Message]...) -> [Message] {
        var byId: [String: Message] = [:]
        for message in groups.flatMap({ $0 }) where message.threadId == thread.id {
            byId[message.id] = message
        }
        return byId.values.sorted { left, right in
            if left.createdAt == right.createdAt {
                return left.id < right.id
            }
            return left.createdAt < right.createdAt
        }
    }

    private func recordMessageLoadError(_ error: any Error, operation: String, attributes: [String: Any]) {
        var nextAttributes = attributes
        nextAttributes["operation"] = operation
        if APIClient.isExpectedCancellation(error) {
            Telemetry.shared.breadcrumb("Thread message request cancelled", category: "message.list", attributes: nextAttributes)
            return
        }
        if case APIError.unauthorized = error {
            Telemetry.shared.breadcrumb("Thread message request unauthorized", category: "message.list", level: .warning, attributes: nextAttributes)
            return
        }
        if case APIError.notFound = error {
            Telemetry.shared.breadcrumb("Thread message request not found", category: "message.list", level: .warning, attributes: nextAttributes)
            return
        }
        Telemetry.shared.capture(error: error, attributes: nextAttributes)
    }

}

// MARK: - Response helpers

private struct EmptyResponse: Decodable {}

private extension Date {
    var elapsedMilliseconds: Int {
        Int(Date().timeIntervalSince(self) * 1_000)
    }
}
