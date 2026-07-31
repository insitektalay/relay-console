// ThreadView.swift
// ClawChat – Main thread/chat view
// Swift 6, iOS 18, SwiftUI

import SwiftUI
import SwiftData

// MARK: - ThreadView

@MainActor
struct ThreadView: View {
    let thread: Thread
    let usesIPadThreadHeader: Bool

    @State private var viewModel: ThreadViewModel
    @State private var voiceInput = VoiceInputViewModel()
    @State private var wrapUpViewModel = WrapUpViewModel()
    @State private var showDetail: Bool = false
    @State private var selectedWrapUp: ThreadWrapUp?
    @State private var showWrapUpConfirmation = false
    @State private var activeDispatches: [AgentDispatch] = []
    @State private var isAtBottom: Bool = true
    @State private var hasPositionedInitialScroll: Bool = false
    @State private var dispatchPendingCancellation: AgentDispatch?
    @State private var sendPendingModelSharingConsent = false
    @State private var modelCatalog: HarnessModelCatalog?
    @State private var isUpdatingDirectChatModel = false
    @AppStorage("runtime.activity.detail.enabled") private var detailedRuntimeActivity = true
    @AppStorage("runtime.approval_mode") private var runtimeApprovalModeRawValue = RelayRuntimeApprovalMode.askForApproval.rawValue
    @AppStorage("privacy.third_party_model_sharing.consent") private var modelSharingConsent = false
    @EnvironmentObject private var appStore: AppStore
    @Environment(\.modelContext) private var modelContext

    init(
        thread: Thread,
        usesIPadThreadHeader: Bool = false
    ) {
        self.thread = thread
        self.usesIPadThreadHeader = usesIPadThreadHeader
        self._viewModel = State(wrappedValue: ThreadViewModel(thread: thread))
    }

    var body: some View {
        VStack(spacing: 0) {
            // Custom nav bar
            ThreadNavBar(
                thread: viewModel.thread,
                onInfo: { showDetail = true },
                messages: viewModel.messages,
                wrapUps: wrapUpViewModel.wrapUps,
                isWrappingUp: wrapUpViewModel.isGenerating,
                contextPercent: estimatedDirectContextPercent,
                usesIPadThreadHeader: usesIPadThreadHeader,
                onCopyThread: copyThread,
                onWrapUpReset: { showWrapUpConfirmation = true },
                onSelectWrapUp: { selectedWrapUp = $0 }
            )

            // Active agent dispatch banners
            if !activeDispatches.isEmpty {
                ForEach(activeDispatches) { dispatch in
                    DispatchStatusBanner(
                        dispatch: dispatch,
                        onTap: {},
                        onCancel: { dispatchPendingCancellation = dispatch },
                        showsDetail: detailedRuntimeActivity
                    )
                }
            }

            // Message list
            ScrollViewReader { proxy in
                ZStack(alignment: .bottomTrailing) {
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            let toneMap = participantToneMap
                            let agentsById = agentsById
                            let managerAgentIds = managerAgentIds
                            let currentUserAvatarUrl = appStore.currentUser?.effectiveAvatarUrl
                            if viewModel.hasMore {
                                Button {
                                    _Concurrency.Task { await viewModel.loadMore() }
                                } label: {
                                    HStack(spacing: 6) {
                                        if viewModel.isLoading {
                                            ProgressView()
                                                .progressViewStyle(CircularProgressViewStyle(tint: ClawColors.textSecondary))
                                                .scaleEffect(0.8)
                                        }
                                        Text("Load earlier messages")
                                            .font(.system(size: 14, weight: .medium))
                                            .foregroundStyle(ClawColors.accent)
                                    }
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                }
                                .disabled(viewModel.isLoading)
                            }

                            ForEach(Array(viewModel.messages.enumerated()), id: \.element.id) { index, message in
                                // Date separator when date changes between messages
                                if shouldShowDateSeparator(at: index) {
                                    DateSeparator(date: message.createdAt)
                                        .padding(.vertical, 8)
                                }

                                MessageView(
                                    message: message,
                                    previousMessage: index > 0 ? viewModel.messages[index - 1] : nil,
                                    onJumpToMessageEdge: { messageId, edge in
                                        withAnimation(.easeInOut(duration: 0.25)) {
                                            proxy.scrollTo("\(messageId)_\(edge.rawValue)", anchor: edge == .top ? .top : .bottom)
                                        }
                                    },
                                    toneOverride: WebMessageCardTone.tone(for: message, map: toneMap),
                                    agentOverride: agentsById[message.senderId],
                                    currentUserAvatarUrl: currentUserAvatarUrl,
                                    managerAgentIds: managerAgentIds,
                                    skipStoreAgentLookup: true,
                                    onCardTap: { card in
                                        _ = card  // handled by parent coordinator
                                    }
                                )
                                .id(message.id)
                            }

                            // Streaming agent output bubble
                            if let streamText = appStore.streamingContent[thread.id] {
                                let liveDispatch = activeLiveDispatch
                                StreamingBubble(
                                    content: streamText,
                                    tasks: appStore.runtimeTodoTasks[thread.id] ?? [],
                                    agentName: liveDispatch?.agentName ?? directChatAgent?.name ?? "Agent",
                                    startedAt: liveDispatch?.startedAt,
                                    onCancel: liveDispatch.map { dispatch in
                                        { dispatchPendingCancellation = dispatch }
                                    }
                                )
                                    .id("streaming_bubble")
                                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                            }

                            if shouldShowThinking {
                                ForEach(thinkingAgents) { agent in
                                    AgentThinkingRow(
                                        agentName: agent.name,
                                        agentAvatarUrl: agent.avatarUrl,
                                        agentStatus: agent.status
                                    )
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 4)
                                    .transition(.opacity.combined(with: .move(edge: .bottom)))
                                }
                            }

                            // Invisible scroll anchor
                            Color.clear
                                .frame(height: 1)
                                .id("bottom_anchor")
                        }
                        .padding(.vertical, 8)
                    }
                    .scrollDismissesKeyboard(.interactively)
                    .onScrollGeometryChange(for: Bool.self) { geometry in
                        geometry.contentOffset.y + geometry.containerSize.height >= geometry.contentSize.height - 96
                    } action: { _, newValue in
                        isAtBottom = newValue
                    }

                    if !isAtBottom {
                        Button {
                            scrollToBottom(proxy: proxy, animated: true)
                        } label: {
                            Image(systemName: "chevron.down")
                                .font(.system(size: 17, weight: .bold))
                                .foregroundStyle(.white)
                                .frame(width: 42, height: 42)
                                .background(ClawColors.accent)
                                .clipShape(Circle())
                                .shadow(color: Color.black.opacity(0.25), radius: 8, y: 4)
                        }
                        .padding(.trailing, 16)
                        .padding(.bottom, 12)
                        .accessibilityLabel("Scroll to latest message")
                        .transition(.scale.combined(with: .opacity))
                    }

                    // Loading / error overlay (only when messages are empty)
                    if viewModel.messages.isEmpty {
                        if viewModel.isLoading {
                            RelayThreadStateOverlay(state: .loading)
                        } else if let err = viewModel.error {
                            RelayThreadStateOverlay(state: .error(err)) {
                                _Concurrency.Task { await viewModel.loadMessages() }
                            }
                        } else if viewModel.hasLoadedMessages {
                            RelayThreadStateOverlay(state: .empty)
                        }
                    }
                }
                .onAppear {
                    positionInitialScrollIfNeeded(proxy: proxy)
                }
                .onChange(of: viewModel.messages.count) {
                    if !hasPositionedInitialScroll {
                        positionInitialScrollIfNeeded(proxy: proxy)
                        return
                    }
                    if isAtBottom || viewModel.messages.last?.isFromUser == true {
                        scrollToBottom(proxy: proxy, animated: true)
                    }
                }
                .onChange(of: appStore.streamingContent[thread.id]) { _, _ in
                    if isAtBottom {
                        withAnimation { proxy.scrollTo("bottom_anchor") }
                    }
                }
                .onChange(of: appStore.runtimeTodoTasks[thread.id]) { _, _ in
                    if isAtBottom {
                        withAnimation { proxy.scrollTo("bottom_anchor") }
                    }
                }
                .onChange(of: viewModel.isAwaitingAgentReply) {
                    if isAtBottom {
                        withAnimation { proxy.scrollTo("bottom_anchor") }
                    }
                }
            }

            // Typing indicator
            if !viewModel.typingUsers.isEmpty {
                TypingIndicatorView(usernames: resolvedTypingNames)
                    .padding(.horizontal, 16)
                    .padding(.bottom, 4)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            if let error = viewModel.error, !viewModel.messages.isEmpty {
                RelayErrorPanel(message: error)
                    .padding(.horizontal, RelaySpacing.md)
                    .padding(.bottom, RelaySpacing.xs)
            }

            // Composer (only for non-agent-to-agent threads)
            if viewModel.thread.type != .agentToAgent {
                MessageComposerView(
                    text: $viewModel.composerText,
                    onSend: requestSend,
                    onAttach: {},
                    onMicrophone: { _Concurrency.Task { await handleVoiceInput() } },
                    isRecordingVoice: voiceInput.isRecording,
                    mentionableAgents: viewModel.thread.agentIds.compactMap { id in
                        appStore.agents.first(where: { $0.id == id })
                    },
                    isBusy: viewModel.isSending,
                    disabledReason: composerDisabledReason,
                    supportsAttachments: false,
                    approvalMode: runtimeApprovalMode,
                    onApprovalModeChange: { runtimeApprovalModeRawValue = $0.rawValue },
                    directChatModel: directChatAgent?.modelPrimary?.trimmingCharacters(in: .whitespacesAndNewlines),
                    directChatModelOptions: directChatModelOptions,
                    directChatDefaultModel: directChatDefaultModel,
                    showsDirectChatModelSelector: viewModel.thread.type == .direct,
                    isUpdatingDirectChatModel: isUpdatingDirectChatModel,
                    onDirectChatModelChange: { model in
                        _Concurrency.Task { await updateDirectChatModel(model) }
                    }
                )
            }
        }
        .background(RelayColors.chatCanvas)
        .navigationBarHidden(true)
        .sheet(isPresented: $showDetail) {
            ThreadDetailView(thread: viewModel.thread)
        }
        .sheet(item: $selectedWrapUp) { wrapUp in
            WrapUpView(wrapUp: wrapUp)
        }
        .alert("Reset this direct chat?", isPresented: $showWrapUpConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Wrap up and reset") {
                _Concurrency.Task { await wrapUpAndReset() }
            }
        } message: {
            Text("This generates a wrap-up report, keeps the same chat and agent, and starts the next conversation cycle on a blank canvas.")
        }
        .alert("Share with your model provider?", isPresented: $sendPendingModelSharingConsent) {
            Button("Allow and Continue") {
                modelSharingConsent = true
                requestSendAfterModelConsent()
            }
            Button("Not Now", role: .cancel) {}
        } message: {
            Text("Relay sends this message to your user-managed agent runtime. That runtime may share it with the AI model provider configured for the agent under that provider's terms. You can withdraw this permission in Settings.")
        }
        .confirmationDialog(
            "Cancel this agent run?",
            isPresented: Binding(
                get: { dispatchPendingCancellation != nil },
                set: { if !$0 { dispatchPendingCancellation = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Cancel run", role: .destructive) {
                guard let dispatch = dispatchPendingCancellation else { return }
                dispatchPendingCancellation = nil
                _Concurrency.Task { await cancel(dispatch) }
            }
            Button("Keep running", role: .cancel) { dispatchPendingCancellation = nil }
        }
        .task {
            let startedAt = Date()
            Telemetry.shared.breadcrumb(
                "Thread screen task started",
                category: "thread.open",
                attributes: ["threadId": viewModel.thread.id, "threadType": viewModel.thread.type.rawValue]
            )
            viewModel.configureCache(modelContext)
            viewModel.renderCachedMessagesForFirstOpen()
            appStore.recordThreadMessageParticipants(viewModel.messages)
            Telemetry.shared.breadcrumb(
                "First chat render ready",
                category: "thread.open",
                attributes: [
                    "threadId": viewModel.thread.id,
                    "cachedMessageCount": viewModel.messages.count,
                    "durationMs": Int(Date().timeIntervalSince(startedAt) * 1_000)
                ]
            )
            _Concurrency.Task { await viewModel.refreshLatestMessagesInBackground() }
            _Concurrency.Task {
                let sideStartedAt = Date()
                Telemetry.shared.breadcrumb("Thread side work started", category: "thread.open", attributes: ["threadId": viewModel.thread.id])
                viewModel.startRealtimeAfterFirstRender()
                await loadActiveDispatches()
                Telemetry.shared.breadcrumb(
                    "Thread side work finished",
                    category: "thread.open",
                    attributes: [
                        "threadId": viewModel.thread.id,
                        "activeDispatchCount": activeDispatches.count,
                        "durationMs": Int(Date().timeIntervalSince(sideStartedAt) * 1_000)
                    ]
                )
            }
            let durationMs = Int(Date().timeIntervalSince(startedAt) * 1_000)
            Telemetry.shared.breadcrumb(
                "Thread screen task finished",
                category: "thread.open",
                attributes: [
                    "threadId": viewModel.thread.id,
                    "messageCount": viewModel.messages.count,
                    "activeDispatchCount": activeDispatches.count,
                    "durationMs": durationMs
                ]
            )
            if durationMs > 2_000 {
                Telemetry.shared.capture(
                    message: "Slow thread screen open",
                    level: .warning,
                    attributes: [
                        "threadId": viewModel.thread.id,
                        "threadType": viewModel.thread.type.rawValue,
                        "messageCount": viewModel.messages.count,
                        "activeDispatchCount": activeDispatches.count,
                        "durationMs": durationMs
                    ]
                )
            }
        }
        .onChange(of: viewModel.messages.count) { _, count in
            appStore.recordThreadMessageParticipants(viewModel.messages)
            Telemetry.shared.breadcrumb(
                "Thread rendered message count changed",
                category: "thread.render",
                attributes: ["threadId": viewModel.thread.id, "messageCount": count]
            )
        }
        .task { await loadModelCatalog() }
        .task {
            guard usesIPadThreadHeader else { return }
            await wrapUpViewModel.load(threadId: viewModel.thread.id)
        }
        .onDisappear { viewModel.cleanup() }
    }

    private func requestSend() {
        guard !viewModel.thread.agentIds.isEmpty else {
            requestSendAfterModelConsent()
            return
        }
        guard modelSharingConsent else {
            sendPendingModelSharingConsent = true
            return
        }
        requestSendAfterModelConsent()
    }

    private func requestSendAfterModelConsent() {
        _Concurrency.Task {
            await viewModel.sendMessage(
                approvalMode: runtimeApprovalMode,
                dispatchConfirmed: true
            )
        }
    }

    // MARK: - Helpers

    private var composerDisabledReason: String? {
        switch viewModel.thread.status {
        case .archived: return "This chat is archived and read-only."
        case .resolved: return "This chat is resolved and read-only."
        case .active, .unknown:
            let participants = viewModel.thread.agentIds.compactMap { id in
                appStore.agents.first(where: { $0.id == id })
            }
            if !viewModel.thread.agentIds.isEmpty,
               !participants.contains(where: \.isExecutionAvailable) {
                return "No execution owner is online for this chat."
            }
            return nil
        }
    }

    private var runtimeApprovalMode: RelayRuntimeApprovalMode {
        RelayRuntimeApprovalMode(rawValue: runtimeApprovalModeRawValue) ?? .askForApproval
    }

    private var directChatAgent: Agent? {
        guard viewModel.thread.type == .direct,
              let agentId = viewModel.thread.agentIds.first else { return nil }
        return appStore.agents.first(where: { $0.id == agentId })
    }

    private var activeLiveDispatch: AgentDispatch? {
        activeDispatches.first(where: { $0.status == .running })
    }

    private var estimatedDirectContextPercent: Int? {
        guard let agent = directChatAgent else { return nil }
        let transcriptCharacters = viewModel.messages.reduce(0) {
            $0 + $1.senderName.count + $1.content.count
        }
        let promptCharacters = agent.name.count + agent.role.count + (agent.description?.count ?? 0)
        let estimatedTokens = 700 + max(1, (transcriptCharacters + promptCharacters) / 4)
        return min(100, max(1, Int((Double(estimatedTokens) / 128_000 * 100).rounded())))
    }

    private func copyThread() {
        UIPasteboard.general.string = viewModel.messages
            .map { message in
                let stamp = message.createdAt.formatted(date: .abbreviated, time: .shortened)
                return "[\(stamp)] \(message.senderName):\n\(message.content)"
            }
            .joined(separator: "\n\n")
    }

    private func wrapUpAndReset() async {
        await wrapUpViewModel.generate(threadId: viewModel.thread.id)
        await viewModel.loadMessages()
        try? await appStore.syncThreads()
    }

    private var directChatHarnessOptions: HarnessModelOptions? {
        guard let runtimeType = directChatAgent?.runtimeType else { return nil }
        let key = runtimeType == .openClaw ? "openclaw" : runtimeType.rawValue
        return modelCatalog?.harnesses[key]
    }

    private var directChatDefaultModel: String? {
        if directChatAgent?.runtimeType == .claudeCode { return "sonnet" }
        return directChatHarnessOptions?.defaultModel
    }

    private var directChatModelOptions: [String] {
        guard let agent = directChatAgent else { return [] }
        let current = agent.modelPrimary?.trimmingCharacters(in: .whitespacesAndNewlines)
        let catalogModels = directChatHarnessOptions?.models ?? []
        let runtimeDefaults = agent.runtimeType == .claudeCode ? ["sonnet"] : []
        var seen = Set<String>()
        return (catalogModels + [current].compactMap { $0 } + runtimeDefaults)
            .filter { !$0.isEmpty && seen.insert($0).inserted }
    }

    private func loadModelCatalog() async {
        guard let workspaceId = appStore.selectedWorkspace?.id else { return }
        do {
            modelCatalog = try await APIClient.shared.request(
                .agentModelOptions(workspaceId: workspaceId)
            )
        } catch {
            if directChatAgent?.runtimeType != .claudeCode {
                viewModel.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    private func updateDirectChatModel(_ model: String) async {
        guard let agent = directChatAgent, !isUpdatingDirectChatModel else { return }
        isUpdatingDirectChatModel = true
        defer { isUpdatingDirectChatModel = false }
        do {
            var updated: Agent = try await APIClient.shared.request(
                .updateAgent(id: agent.id, params: ["modelPrimary": model])
            )
            updated.workspaceId = agent.workspaceId
            appStore.upsertAgent(updated)
            viewModel.error = nil
        } catch {
            viewModel.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func positionInitialScrollIfNeeded(proxy: ScrollViewProxy) {
        guard !hasPositionedInitialScroll, !viewModel.messages.isEmpty else { return }
        hasPositionedInitialScroll = true
        scrollToBottom(proxy: proxy, animated: false)
    }

    private func loadActiveDispatches() async {
        do {
            let response: PaginatedResponse<AgentDispatch> = try await APIClient.shared.requestPaginated(
                .activeDispatches(threadId: viewModel.thread.id)
            )
            activeDispatches = response.data
        } catch {}
    }

    private func cancel(_ dispatch: AgentDispatch) async {
        do {
            let result: RuntimeDispatchCancelResult = try await APIClient.shared.request(.cancelDispatch(id: dispatch.id))
            guard result.cancelled else { return }
            if let index = activeDispatches.firstIndex(where: { $0.id == dispatch.id }) {
                activeDispatches[index].status = .cancelled
                activeDispatches[index].completedAt = Date()
            }
        } catch {
            viewModel.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private var participantToneMap: [String: WebMessageCardTone] {
        WebMessageCardTone.participantToneMap(thread: viewModel.thread, messages: viewModel.messages)
    }

    private var agentsById: [String: Agent] {
        Dictionary(uniqueKeysWithValues: appStore.agents.map { ($0.id, $0) })
    }

    private var managerAgentIds: Set<String> {
        var ids = Set<String>()
        for team in appStore.teams {
            if let leadAgentId = team.leadAgentId {
                ids.insert(leadAgentId)
            }
        }
        for department in appStore.departments {
            if let headAgentId = department.headAgentId {
                ids.insert(headAgentId)
            }
        }
        return ids
    }

    private var resolvedTypingNames: [String] {
        viewModel.typingUsers.compactMap { userId in
            appStore.agents.first(where: { $0.id == userId })?.name
        }
    }

    private var shouldShowThinking: Bool {
        viewModel.isAwaitingAgentReply &&
        viewModel.typingUsers.isEmpty &&
        appStore.streamingContent[thread.id] == nil
    }

    private var thinkingAgents: [Agent] {
        let agents = viewModel.thread.agentIds.compactMap { id in
            appStore.agents.first(where: { $0.id == id })
        }
        return Array(agents.prefix(max(1, min(agents.count, 3))))
    }

    private func shouldShowDateSeparator(at index: Int) -> Bool {
        guard index < viewModel.messages.count else { return false }
        if index == 0 { return true }
        let current = viewModel.messages[index]
        let prev    = viewModel.messages[index - 1]
        return !Calendar.current.isDate(current.createdAt, inSameDayAs: prev.createdAt)
    }

    private func scrollToBottom(proxy: ScrollViewProxy, animated: Bool = false) {
        guard !viewModel.messages.isEmpty else { return }
        if animated {
            withAnimation(.easeOut(duration: 0.3)) {
                proxy.scrollTo("bottom_anchor", anchor: .bottom)
            }
        } else {
            proxy.scrollTo("bottom_anchor", anchor: .bottom)
        }
    }

    private func handleVoiceInput() async {
        let transcript = await voiceInput.toggleRecording()
        guard let transcript else { return }
        if viewModel.composerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            viewModel.composerText = transcript
        } else {
            viewModel.composerText += " " + transcript
        }
    }
}

// MARK: - ThreadNavBar

enum IPadThreadHeaderContract {
    static let actionLabels = [
        "Copy thread",
        "Wrap up and reset",
        "Current chat cycle",
        "Context usage",
        "Messages",
    ]
}

struct ThreadNavBar: View {
    let thread: Thread
    let onInfo: () -> Void
    var messages: [Message] = []
    var wrapUps: [ThreadWrapUp] = []
    var isWrappingUp = false
    var contextPercent: Int?
    var usesIPadThreadHeader = false
    var onCopyThread: (() -> Void)?
    var onWrapUpReset: (() -> Void)?
    var onSelectWrapUp: ((ThreadWrapUp) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var appStore: AppStore

    private var resolvedAgent: Agent? {
        let senderIds = messages
            .sorted { $0.createdAt > $1.createdAt }
            .map(\.senderId) + (appStore.threadMessageSenderIds[thread.id] ?? [])
        return ThreadAvatarResolver.directAgent(
            thread: thread,
            agents: appStore.agents,
            messageSenderIds: senderIds
        )
    }

    private var displayName: String {
        resolvedAgent?.name ?? appStore.threadMessageAgentPreviews[thread.id]?.name ?? thread.title
    }

    private var displayAvatarUrl: String? {
        resolvedAgent?.avatarUrl
            ?? appStore.threadMessageAgentPreviews[thread.id]?.avatarUrl
            ?? thread.avatarUrl
    }

    @ViewBuilder
    var body: some View {
        if usesIPadThreadHeader {
            ipadHeader
        } else {
            compactPhoneHeader
        }
    }

    private var ipadHeader: some View {
        HStack(spacing: 6) {
            AvatarView(name: displayName, imageUrl: displayAvatarUrl, size: .mini, status: nil)
                .accessibilityLabel(displayName)

            Spacer(minLength: 8)

            if !wrapUps.isEmpty, let onSelectWrapUp {
                Menu {
                    ForEach(Array(wrapUps.enumerated()), id: \.element.id) { index, wrapUp in
                        Button {
                            onSelectWrapUp(wrapUp)
                        } label: {
                            Label("Cycle \(max(1, wrapUps.count - index))", systemImage: "doc.text")
                        }
                    }
                } label: {
                    headerChip(icon: "doc.text", text: "\(wrapUps.count)", showsChevron: true)
                }
                .accessibilityLabel("Open transcript history")
            }

            Button(action: { onCopyThread?() }) {
                headerIcon("doc.on.doc")
            }
            .buttonStyle(.plain)
            .disabled(messages.isEmpty)
            .accessibilityLabel("Copy thread")

            Button(action: { onWrapUpReset?() }) {
                if isWrappingUp {
                    ProgressView().controlSize(.mini).frame(width: 28, height: 28)
                } else {
                    headerIcon("arrow.triangle.2.circlepath")
                }
            }
            .buttonStyle(.plain)
            .disabled(isWrappingUp || messages.isEmpty)
            .accessibilityLabel("Wrap up and reset")

            Rectangle()
                .fill(RelayColors.borderLow)
                .frame(width: 1, height: 24)
                .padding(.horizontal, 2)

            headerChip(icon: "message", text: "\(max(1, wrapUps.count + 1))")
                .accessibilityLabel("Current chat cycle \(max(1, wrapUps.count + 1))")

            if let contextPercent {
                headerChip(icon: nil, text: "~\(contextPercent)%")
                    .accessibilityLabel("Estimated context usage \(contextPercent) percent")
            }

            headerChip(icon: "text.bubble", text: "\(messages.count)")
                .accessibilityLabel("\(messages.count) messages")
        }
        .padding(.horizontal, 12)
        .frame(height: 56)
        .background(RelayColors.chatChrome)
        .overlay(alignment: .bottom) {
            Rectangle().fill(ClawColors.separator).frame(height: 0.5)
        }
    }

    private var compactPhoneHeader: some View {
        HStack(spacing: 0) {
            Button { dismiss() } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(ClawColors.accent)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Back to Chats")

            Spacer(minLength: 0)

            Button(action: onInfo) {
                HStack(spacing: 10) {
                    AvatarView(
                        name: displayName,
                        imageUrl: displayAvatarUrl,
                        size: .medium,
                        status: resolvedAgent?.status
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        Text(displayName)
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(ClawColors.textPrimary)
                            .lineLimit(1)
                        Text(threadTypeLabel(thread.type))
                            .font(.system(size: 12))
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                }
            }
            .buttonStyle(.plain)

            Spacer(minLength: 0)

            Menu {
                Button(action: onInfo) {
                    Label("Chat Info", systemImage: "info.circle")
                }
                let todayMessages = messages.filter { Calendar.current.isDateInToday($0.createdAt) }
                if !todayMessages.isEmpty {
                    Button {
                        UIPasteboard.general.string = todayMessages
                            .map { "\($0.senderName): \($0.content)" }
                            .joined(separator: "\n")
                    } label: {
                        Label("Copy Today's Messages", systemImage: "doc.on.doc")
                    }
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(RelayColors.accent)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .accessibilityLabel("Chat actions")
        }
        .padding(.horizontal, 4)
        .frame(height: 56)
        .background(RelayColors.chatChrome)
        .overlay(alignment: .bottom) {
            Rectangle().fill(ClawColors.separator).frame(height: 0.5)
        }
    }

    private func headerIcon(_ symbol: String) -> some View {
        Image(systemName: symbol)
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(ClawColors.textPrimary)
            .frame(width: 28, height: 28)
            .background(RelayColors.backgroundElevated)
            .clipShape(RoundedRectangle(cornerRadius: 5))
            .overlay(RoundedRectangle(cornerRadius: 5).stroke(RelayColors.borderStandard))
    }

    private func headerChip(icon: String?, text: String, showsChevron: Bool = false) -> some View {
        HStack(spacing: 5) {
            if let icon {
                Image(systemName: icon)
            }
            Text(text).monospacedDigit()
            if showsChevron {
                Image(systemName: "chevron.down").font(.system(size: 8, weight: .bold))
            }
        }
        .font(.system(size: 11, weight: .semibold))
        .foregroundStyle(ClawColors.textPrimary)
        .padding(.horizontal, 9)
        .frame(minWidth: 42)
        .frame(height: 28)
        .background(RelayColors.backgroundElevated)
        .clipShape(RoundedRectangle(cornerRadius: 5))
        .overlay(RoundedRectangle(cornerRadius: 5).stroke(RelayColors.borderStandard))
    }

    private func threadTypeLabel(_ type: ThreadType) -> String {
        switch type {
        case .direct:       return "Direct"
        case .team:         return "Team Chat"
        case .department:   return "Department"
        case .agentToAgent: return "Agent to Agent"
        case .groupAgent:   return "Group"
        case .system:       return "System"
        case .approval:     return "Approval"
        case .incident:     return "Incident"
        case .report:       return "Report"
        case .unknown:      return "Thread"
        }
    }
}

enum RelayThreadState: Equatable {
    case loading
    case empty
    case error(String)
}

struct RelayThreadStateOverlay: View {
    let state: RelayThreadState
    var retry: (() -> Void)? = nil

    var body: some View {
        switch state {
        case .loading:
            RelayLoadingState(message: "Loading messages")
        case .empty:
            RelayEmptyState(
                icon: "bubble.left",
                title: "No messages yet",
                subtitle: "Start the chat from the composer below."
            )
        case .error(let message):
            VStack(spacing: RelaySpacing.md) {
                RelayErrorPanel(message: message)
                if let retry {
                    Button("Retry", action: retry)
                        .buttonStyle(RelayButtonStyle(size: .sm, variant: .secondary))
                }
            }
            .padding(RelaySpacing.lg)
        }
    }
}

// MARK: - SupervisingBadge

struct SupervisingBadge: View {
    var body: some View {
        Text("Supervising")
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(ClawColors.accent)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(ClawColors.accent.opacity(0.15))
            .clipShape(Capsule())
    }
}

// MARK: - Thread preview helper

extension Thread {
    static var preview: Thread {
        Thread(
            id: "t1",
            title: "Aria – Sales Agent",
            type: .direct,
            workspaceId: "ws1",
            avatarUrl: nil,
            lastMessage: nil,
            unreadCount: 3,
            isPinned: false,
            isMuted: false,
            participantIds: ["u1", "a1"],
            createdAt: Date(),
            updatedAt: Date(),
            teamId: nil,
            departmentId: nil,
            agentIds: ["a1"],
            status: .active
        )
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        ThreadView(thread: .preview)
            .environmentObject(AppStore.preview)
    }
}
