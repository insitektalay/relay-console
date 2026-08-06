// TeamChatView.swift
// ClawChat – Team chat view with multi-agent messages
// Swift 6, iOS 18, SwiftUI

import SwiftUI
import SwiftData

// MARK: - TeamChatView

@MainActor
struct TeamChatView: View {
    let thread: Thread
    let usesIPadThreadHeader: Bool

    @State private var viewModel: ThreadViewModel
    @State private var voiceInput = VoiceInputViewModel()
    @State private var wrapUpViewModel = WrapUpViewModel()
    @State private var showDetail: Bool = false
    @State private var showManageMembers: Bool = false
    @State private var activeDispatches: [AgentDispatch] = []
    @State private var teamRelayState: TeamRelayState?
    @State private var teamRelayError: String?
    @State private var isUpdatingTeamRelay = false
    @State private var selectedWrapUp: ThreadWrapUp?
    @State private var showWrapUpConfirmation = false
    @State private var isAtBottom: Bool = true
    @State private var hasPositionedInitialScroll: Bool = false
    @State private var dispatchPendingCancellation: AgentDispatch?
    @State private var sendPendingModelSharingConsent = false
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
            // Custom nav bar with team info
            TeamChatNavBar(
                thread: viewModel.thread,
                teamAgents: teamAgents,
                managerAgentIds: managerAgentIds,
                relayState: teamRelayState,
                relayError: teamRelayError,
                isUpdatingRelay: isUpdatingTeamRelay,
                cycleNumber: currentCycleNumber,
                messageCount: viewModel.messages.count,
                wrapUps: wrapUpViewModel.wrapUps,
                contextUsage: teamContextUsage,
                isWrappingUp: wrapUpViewModel.isGenerating,
                usesIPadThreadHeader: usesIPadThreadHeader,
                onToggleRelay: { updateTeamRelayRunState() },
                onSetReplyLimit: { setTeamRelayReplyLimit($0) },
                onSelectWrapUp: { selectedWrapUp = $0 },
                onWrapUpReset: {
                    if usesIPadThreadHeader {
                        showWrapUpConfirmation = true
                    } else {
                        _Concurrency.Task { await wrapUpAndReset() }
                    }
                },
                onCopyThreadWithReferences: { copyThread(includeReferences: true) },
                onCopyThread: { copyThread(includeReferences: false) },
                onManageMembers: { showManageMembers = true },
                onInfo: { showDetail = true }
            )

            if teamRelayState == nil, let teamRelayError {
                Text(teamRelayError)
                    .font(.caption)
                    .foregroundStyle(ClawColors.accentRed)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 6)
                    .background(ClawColors.backgroundSecondary)
                    .accessibilityLabel("Team relay unavailable. \(teamRelayError)")
            }

            // Active agent dispatch banners
            if !activeDispatches.isEmpty {
                ForEach(activeDispatches) { dispatch in
                    DispatchStatusBanner(
                        dispatch: dispatch,
                        onTap: {},
                        onCancel: { dispatchPendingCancellation = dispatch }
                    )
                }
            }

            // Message list
            ScrollViewReader { proxy in
                ZStack(alignment: .bottomTrailing) {
                    ScrollView {
                        LazyVStack(spacing: 0) {
                            let toneMap = participantToneMap
                            let displayedMessages = displayedMessages
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
                                                .progressViewStyle(
                                                    CircularProgressViewStyle(tint: ClawColors.textSecondary)
                                                )
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

                            ForEach(Array(displayedMessages.enumerated()), id: \.element.id) { index, message in
                                if shouldShowDateSeparator(at: index) {
                                    DateSeparator(date: message.createdAt)
                                        .padding(.vertical, 8)
                                }

                                MessageView(
                                    message: message,
                                    previousMessage: index > 0 ? displayedMessages[index - 1] : nil,
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
                                    onCardTap: { _ in }
                                )
                                .id(message.id)
                            }

                            // Streaming agent output bubble
                            if let streamText = appStore.streamingContent[thread.id] {
                                let liveDispatch = activeLiveDispatch
                                StreamingBubble(
                                    content: streamText,
                                    tasks: appStore.runtimeTodoTasks[thread.id] ?? [],
                                    agentName: liveDispatch?.agentName ?? "Agent",
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
                                    AgentThinkingRow(agentName: agent.name, agentAvatarUrl: agent.avatarUrl, agentStatus: agent.status)
                                        .padding(.horizontal, 16)
                                        .padding(.vertical, 4)
                                        .transition(.opacity.combined(with: .move(edge: .bottom)))
                                }
                            }

                            Color.clear
                                .frame(height: 1)
                                .id("team_bottom")
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

                    if viewModel.messages.isEmpty {
                        if viewModel.isLoading {
                            RelayThreadStateOverlay(state: .loading)
                        } else if let error = viewModel.error {
                            RelayThreadStateOverlay(state: .error(error)) {
                                _Concurrency.Task { await viewModel.loadMessages() }
                            }
                        } else if viewModel.hasLoadedMessages {
                            RelayThreadStateOverlay(state: .empty)
                        }
                    }
                }
                .onAppear { positionInitialScrollIfNeeded(proxy: proxy) }
                .onChange(of: viewModel.messages.map(\.id)) { previousIds, currentIds in
                    if !hasPositionedInitialScroll {
                        positionInitialScrollIfNeeded(proxy: proxy)
                        return
                    }
                    let appendedUserMessage = previousIds.last != currentIds.last
                        && viewModel.messages.last?.isFromUser == true
                    if isAtBottom || appendedUserMessage {
                        scrollToBottom(proxy: proxy, animated: true)
                    }
                }
                .onChange(of: appStore.streamingContent[thread.id]) { _, _ in
                    if isAtBottom {
                        withAnimation { proxy.scrollTo("team_bottom") }
                    }
                }
                .onChange(of: appStore.runtimeTodoTasks[thread.id]) { _, _ in
                    if isAtBottom {
                        withAnimation { proxy.scrollTo("team_bottom") }
                    }
                }
                .onChange(of: viewModel.isAwaitingAgentReply) {
                    if isAtBottom {
                        withAnimation { proxy.scrollTo("team_bottom") }
                    }
                }
            }

            // One typing row per agent — real indicators, not combined
            ForEach(typingAgents, id: \.id) { agent in
                AgentTypingRow(
                    agentName: agent.name,
                    agentAvatarUrl: agent.avatarUrl,
                    agentStatus: agent.status
                )
                .padding(.horizontal, 16)
                .padding(.bottom, 2)
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }

            if let error = viewModel.error, !viewModel.messages.isEmpty {
                RelayErrorPanel(message: error)
                    .padding(.horizontal, RelaySpacing.md)
                    .padding(.bottom, RelaySpacing.xs)
            }

            // Composer
            MessageComposerView(
                text: $viewModel.composerText,
                onSend: requestSend,
                onAttach: {},
                onMicrophone: { _Concurrency.Task { await handleVoiceInput() } },
                isRecordingVoice: voiceInput.isRecording,
                mentionableAgents: teamAgents,
                isBusy: viewModel.isSending,
                disabledReason: composerDisabledReason,
                supportsAttachments: false,
                approvalMode: runtimeApprovalMode,
                onApprovalModeChange: { runtimeApprovalModeRawValue = $0.rawValue }
            )
        }
        .background(RelayColors.chatCanvas)
        .navigationBarHidden(true)
        .sheet(isPresented: $showDetail) {
            ThreadDetailView(thread: viewModel.thread)
        }
        .sheet(isPresented: $showManageMembers) {
            ManageTeamMembersSheet(thread: viewModel.thread, isPresented: $showManageMembers)
                .environmentObject(appStore)
        }
        .sheet(item: $selectedWrapUp) { wrapUp in
            WrapUpView(wrapUp: wrapUp)
        }
        .alert("Reset this team chat?", isPresented: $showWrapUpConfirmation) {
            Button("Cancel", role: .cancel) {}
            Button("Wrap up and reset") {
                _Concurrency.Task { await wrapUpAndReset() }
            }
        } message: {
            Text("This generates a wrap-up report, keeps the same team and agents, and starts the next conversation cycle on a blank canvas.")
        }
        .alert("Share with your model provider?", isPresented: $sendPendingModelSharingConsent) {
            Button("Allow and Continue") {
                modelSharingConsent = true
                requestSendAfterModelConsent()
            }
            Button("Not Now", role: .cancel) {}
        } message: {
            Text("Relay sends this message to your user-managed agent runtime. That runtime may share it with the AI model provider configured for an agent under that provider's terms. You can withdraw this permission in Settings.")
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
                "Team thread screen task started",
                category: "thread.open",
                attributes: ["threadId": viewModel.thread.id, "threadType": viewModel.thread.type.rawValue]
            )
            viewModel.configureCache(modelContext)
            viewModel.renderCachedMessagesForFirstOpen()
            appStore.recordThreadMessageParticipants(viewModel.messages)
            Telemetry.shared.breadcrumb(
                "First team chat render ready",
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
                Telemetry.shared.breadcrumb("Team thread side work started", category: "thread.open", attributes: ["threadId": viewModel.thread.id])
                viewModel.startRealtimeAfterFirstRender()
                await wrapUpViewModel.load(threadId: viewModel.thread.id)
                await loadActiveDispatches()
                await loadTeamRelay()
                Telemetry.shared.breadcrumb(
                    "Team thread side work finished",
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
                "Team thread screen task finished",
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
                    message: "Slow team thread screen open",
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
        .onChange(of: viewModel.messages.map(\.id)) { _, _ in
            appStore.recordThreadMessageParticipants(viewModel.messages)
        }
        .onChange(of: viewModel.messages.count) { _, count in
            Telemetry.shared.breadcrumb(
                "Team thread rendered message count changed",
                category: "thread.render",
                attributes: ["threadId": viewModel.thread.id, "messageCount": count]
            )
            _Concurrency.Task { await loadTeamRelay() }
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

    private var runtimeApprovalMode: RelayRuntimeApprovalMode {
        RelayRuntimeApprovalMode(rawValue: runtimeApprovalModeRawValue) ?? .askForApproval
    }

    // MARK: - Computed Properties

    private var composerDisabledReason: String? {
        switch viewModel.thread.status {
        case .archived: return "This chat is archived and read-only."
        case .resolved: return "This chat is resolved and read-only."
        case .active, .unknown:
            if !viewModel.thread.agentIds.isEmpty,
               !teamAgents.contains(where: \.isExecutionAvailable) {
                return "No execution owner is online for this chat."
            }
            return nil
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
            let result: RuntimeDispatchCancelResult = try await APIClient.shared.request(
                .cancelDispatch(id: dispatch.id)
            )
            guard result.cancelled else { return }
            if let index = activeDispatches.firstIndex(where: { $0.id == dispatch.id }) {
                activeDispatches[index].status = .cancelled
                activeDispatches[index].completedAt = Date()
            }
        } catch {
            viewModel.error = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
    }

    private func loadTeamRelay() async {
        do {
            let state: TeamRelayState = try await APIClient.shared.request(
                .teamRelay(threadId: viewModel.thread.id)
            )
            teamRelayState = state
            teamRelayError = nil
        } catch {
            teamRelayError = error.localizedDescription
        }
    }

    private func updateTeamRelayRunState() {
        guard let state = teamRelayState, !isUpdatingTeamRelay else { return }
        isUpdatingTeamRelay = true
        teamRelayError = nil
        _Concurrency.Task {
            defer { isUpdatingTeamRelay = false }
            do {
                let endpoint: APIEndpoint = state.runState == .paused
                    ? .continueTeamRelay(threadId: viewModel.thread.id)
                    : .pauseTeamRelay(threadId: viewModel.thread.id)
                let updated: TeamRelayState = try await APIClient.shared.request(endpoint)
                teamRelayState = updated
            } catch {
                teamRelayError = error.localizedDescription
            }
        }
    }

    private func setTeamRelayReplyLimit(_ replyLimit: Int) {
        guard !isUpdatingTeamRelay else { return }
        isUpdatingTeamRelay = true
        teamRelayError = nil
        _Concurrency.Task {
            defer { isUpdatingTeamRelay = false }
            do {
                let updated: TeamRelayState = try await APIClient.shared.request(
                    .updateTeamRelayLimit(
                        threadId: viewModel.thread.id,
                        replyLimit: replyLimit
                    )
                )
                teamRelayState = updated
            } catch {
                teamRelayError = error.localizedDescription
            }
        }
    }

    private var displayedMessages: [Message] {
        viewModel.messages
    }

    private var participantToneMap: [String: WebMessageCardTone] {
        WebMessageCardTone.participantToneMap(thread: viewModel.thread, messages: viewModel.messages)
    }

    private var agentsById: [String: Agent] {
        Dictionary(uniqueKeysWithValues: appStore.agents.map { ($0.id, $0) })
    }

    private var teamAgents: [Agent] {
        appStore.agents.filter { viewModel.thread.agentIds.contains($0.id) }
    }

    private var activeLiveDispatch: AgentDispatch? {
        activeDispatches.first(where: { $0.status == .running })
    }

    private var managerAgentIds: Set<String> {
        var ids = Set<String>()
        for team in appStore.teams where viewModel.thread.agentIds.contains(team.leadAgentId ?? "") {
            if let leadAgentId = team.leadAgentId {
                ids.insert(leadAgentId)
            }
        }
        for department in appStore.departments where viewModel.thread.agentIds.contains(department.headAgentId ?? "") {
            if let headAgentId = department.headAgentId {
                ids.insert(headAgentId)
            }
        }
        return ids
    }

    private var resolvedTypingNames: [String] {
        typingAgents.map(\.name)
    }

    private var typingAgents: [Agent] {
        viewModel.typingUsers.compactMap { userId in
            appStore.agents.first(where: { $0.id == userId })
        }
    }

    private var shouldShowThinking: Bool {
        viewModel.isAwaitingAgentReply &&
        viewModel.typingUsers.isEmpty &&
        appStore.streamingContent[thread.id] == nil
    }

    private var thinkingAgents: [Agent] {
        Array(teamAgents.prefix(max(1, min(teamAgents.count, 3))))
    }

    private var currentCycleNumber: Int {
        max(1, wrapUpViewModel.wrapUps.count + 1)
    }

    private var teamContextUsage: [TeamAgentContextUsage] {
        let transcriptCharacters = viewModel.messages.reduce(0) {
            $0 + $1.senderName.count + $1.content.count
        }
        return teamAgents.map { agent in
            let agentPromptCharacters = agent.name.count
                + agent.role.count
                + (agent.description?.count ?? 0)
            // Mirrors Relay Console's stale-value fallback: estimate the current
            // transcript plus a modest system prompt against a 128k window.
            let estimatedTokens = 700 + max(1, (transcriptCharacters + agentPromptCharacters) / 4)
            let percent = min(100, max(1, Int((Double(estimatedTokens) / 128_000 * 100).rounded())))
            return TeamAgentContextUsage(agent: agent, percent: percent, isEstimate: true)
        }
    }

    // MARK: - Helpers

    private func shouldShowDateSeparator(at index: Int) -> Bool {
        let messages = displayedMessages
        guard index < messages.count else { return false }
        if index == 0 { return true }
        let current = messages[index]
        let prev    = messages[index - 1]
        return !Calendar.current.isDate(current.createdAt, inSameDayAs: prev.createdAt)
    }

    private func scrollToBottom(proxy: ScrollViewProxy, animated: Bool = false) {
        guard !viewModel.messages.isEmpty else { return }
        if animated {
            withAnimation(.easeOut(duration: 0.3)) {
                proxy.scrollTo("team_bottom", anchor: .bottom)
            }
        } else {
            proxy.scrollTo("team_bottom", anchor: .bottom)
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

    private func copyThread(includeReferences: Bool) {
        let body = viewModel.messages
            .map { message in
                let stamp = DateFormatter.threadCopyFormatter.string(from: message.createdAt)
                var parts = ["[\(stamp)] \(message.senderName):", message.content]
                if includeReferences {
                    if let card = message.embeddedCard {
                        parts.append("Reference: \(card.title)")
                    }
                    if !message.attachments.isEmpty {
                        parts.append("Attachments: \(message.attachments.map(\.filename).joined(separator: ", "))")
                    }
                }
                return parts.joined(separator: "\n")
            }
            .joined(separator: "\n\n")
        UIPasteboard.general.string = body
    }

    private func wrapUpAndReset() async {
        await wrapUpViewModel.generate(threadId: viewModel.thread.id)
        await viewModel.loadMessages()
        try? await appStore.syncThreads()
        await loadTeamRelay()
    }
}

// MARK: - TeamChatNavBar

private struct TeamAgentContextUsage: Identifiable {
    let agent: Agent
    let percent: Int
    let isEstimate: Bool

    var id: String { agent.id }
    var label: String { "\(isEstimate ? "~" : "")\(percent)%" }
}

private struct TeamChatNavBar: View {
    let thread: Thread
    let teamAgents: [Agent]
    let managerAgentIds: Set<String>
    let relayState: TeamRelayState?
    let relayError: String?
    let isUpdatingRelay: Bool
    let cycleNumber: Int
    let messageCount: Int
    let wrapUps: [ThreadWrapUp]
    let contextUsage: [TeamAgentContextUsage]
    let isWrappingUp: Bool
    let usesIPadThreadHeader: Bool
    let onToggleRelay: () -> Void
    let onSetReplyLimit: (Int) -> Void
    let onSelectWrapUp: (ThreadWrapUp) -> Void
    let onWrapUpReset: () -> Void
    let onCopyThreadWithReferences: () -> Void
    let onCopyThread: () -> Void
    let onManageMembers: () -> Void
    let onInfo: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var showOverflow = false

    private let replyLimitPresets = [25, 50, 100, 200, 400, 800, 1_500, 3_000, 5_000, 10_000]

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
            headerAgentAvatars

            Spacer(minLength: 8)

            transcriptHistoryMenu
            relayControls

            Button(action: onCopyThread) {
                compactControl {
                    Image(systemName: "doc.on.doc")
                }
            }
            .buttonStyle(.plain)
            .disabled(messageCount == 0)
            .accessibilityLabel("Copy thread")

            Button(action: onWrapUpReset) {
                compactControl {
                    if isWrappingUp {
                        ProgressView().controlSize(.mini)
                    } else {
                        Image(systemName: "arrow.triangle.2.circlepath")
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(isWrappingUp || messageCount == 0)
            .accessibilityLabel("Wrap up and reset")

            Rectangle()
                .fill(RelayColors.borderLow)
                .frame(width: 1, height: 24)
                .padding(.horizontal, 2)

            compactControl(minWidth: 42) {
                HStack(spacing: 5) {
                    Image(systemName: "message")
                    Text("\(cycleNumber)").monospacedDigit()
                }
            }
            .accessibilityLabel("Current chat cycle \(cycleNumber)")

            ForEach(contextUsage) { usage in
                compactControl(minWidth: 44) {
                    Text(usage.label).monospacedDigit()
                }
                .accessibilityLabel("\(usage.agent.name), estimated context usage \(usage.percent) percent")
            }

            compactControl(minWidth: 42) {
                HStack(spacing: 5) {
                    Image(systemName: "text.bubble")
                    Text("\(messageCount)").monospacedDigit()
                }
            }
            .accessibilityLabel("\(messageCount) messages")
        }
        .padding(.horizontal, 12)
        .frame(height: 56)
        .background(RelayColors.chatChrome)
        .overlay(alignment: .bottom) {
            Rectangle().fill(ClawColors.separator).frame(height: 0.5)
        }
    }

    private var compactPhoneHeader: some View {
        VStack(spacing: 0) {
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
                    VStack(spacing: 1) {
                        Text(thread.title)
                            .font(RelayFonts.navigationTitle)
                            .foregroundStyle(ClawColors.textPrimary)
                            .lineLimit(1)
                        Text("Team Chat")
                            .font(RelayFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                topActionsMenu
            }

            HStack(spacing: 8) {
                headerAgentAvatars
                Spacer(minLength: 0)
                transcriptHistoryMenu
                relayControls
                overflowButton
            }
            .padding(.horizontal, RelaySpacing.md)
            .padding(.bottom, RelaySpacing.sm)
        }
        .padding(.horizontal, 4)
        .padding(.top, 4)
        .background(RelayColors.chatChrome)
        .overlay(
            Rectangle()
                .fill(ClawColors.separator)
                .frame(height: 0.5),
            alignment: .bottom
        )
    }

    private var topActionsMenu: some View {
        Menu {
            Button(action: onInfo) {
                Label("Chat Info", systemImage: "info.circle")
            }
            Button(action: onManageMembers) {
                Label("Manage Agents", systemImage: "person.badge.plus")
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

    @ViewBuilder
    private var transcriptHistoryMenu: some View {
        if !wrapUps.isEmpty {
            Menu {
                ForEach(Array(wrapUps.enumerated()), id: \.element.id) { index, wrapUp in
                    Button {
                        onSelectWrapUp(wrapUp)
                    } label: {
                        Label("Cycle \(max(1, cycleNumber - index - 1))", systemImage: "doc.text")
                    }
                }
            } label: {
                compactControl {
                    HStack(spacing: 3) {
                        Image(systemName: "doc.text")
                        Text("\(wrapUps.count)").monospacedDigit()
                        Image(systemName: "chevron.down")
                            .font(.system(size: 7, weight: .bold))
                    }
                }
            }
            .accessibilityLabel("Transcript history")
        }
    }

    @ViewBuilder
    private var relayControls: some View {
        if let relayState {
            Button(action: onToggleRelay) {
                compactControl {
                    if isUpdatingRelay {
                        ProgressView().controlSize(.mini)
                    } else {
                        Image(systemName: relayState.runState == .paused ? "play.fill" : "pause.fill")
                    }
                }
            }
            .buttonStyle(.plain)
            .disabled(isUpdatingRelay)
            .accessibilityLabel(relayState.runState == .paused ? "Continue team relay" : "Pause team relay")

            Menu {
                ForEach(replyLimitPresets, id: \.self) { preset in
                    Button {
                        onSetReplyLimit(preset)
                    } label: {
                        if preset == relayState.replyLimit {
                            Label("\(preset) replies", systemImage: "checkmark")
                        } else {
                            Text("\(preset) replies")
                        }
                    }
                }
            } label: {
                compactControl(minWidth: 72) {
                    HStack(spacing: 5) {
                        Text("\(relayState.replyCount)/\(relayState.replyLimit)")
                            .monospacedDigit()
                        Image(systemName: "chevron.down")
                            .font(.system(size: 8, weight: .bold))
                    }
                }
            }
            .disabled(isUpdatingRelay)
            .accessibilityLabel("Team relay reply limit")
            .accessibilityValue("\(relayState.replyCount) of \(relayState.replyLimit) replies")
        }
    }

    private var overflowButton: some View {
        Button { showOverflow.toggle() } label: {
            compactControl {
                Image(systemName: "ellipsis")
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Thread utilities and team details")
        .popover(isPresented: $showOverflow, arrowEdge: .top) {
            TeamChatOverflowView(
                teamAgents: teamAgents,
                managerAgentIds: managerAgentIds,
                contextUsage: contextUsage,
                cycleNumber: cycleNumber,
                messageCount: messageCount,
                relayState: relayState,
                relayError: relayError,
                isWrappingUp: isWrappingUp,
                onCopyThread: {
                    showOverflow = false
                    onCopyThread()
                },
                onCopyThreadWithReferences: {
                    showOverflow = false
                    onCopyThreadWithReferences()
                },
                onWrapUpReset: {
                    showOverflow = false
                    onWrapUpReset()
                }
            )
            .presentationCompactAdaptation(.popover)
        }
    }

    private var headerAgentAvatars: some View {
        let visibleCount = teamAgents.count > 4 ? 3 : min(teamAgents.count, 4)
        return HStack(spacing: 4) {
            ForEach(teamAgents.prefix(visibleCount)) { agent in
                TeamHeaderAvatar(agent: agent)
            }
            if teamAgents.count > 4 {
                Text("+\(teamAgents.count - 3)")
                    .font(.system(size: 10, weight: .semibold).monospacedDigit())
                    .foregroundStyle(ClawColors.textSecondary)
                    .frame(width: 26, height: 26)
                    .background(RelayColors.backgroundElevated)
                    .clipShape(Circle())
                    .overlay(Circle().stroke(RelayColors.borderStandard, lineWidth: 1))
            }
        }
    }

    private func compactControl<Content: View>(
        minWidth: CGFloat = 32,
        @ViewBuilder content: () -> Content
    ) -> some View {
        content()
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(ClawColors.textPrimary)
            .padding(.horizontal, 8)
            .frame(minWidth: minWidth)
            .frame(height: 26)
            .background(RelayColors.backgroundElevated)
            .clipShape(RoundedRectangle(cornerRadius: 5))
            .overlay(RoundedRectangle(cornerRadius: 5).stroke(RelayColors.borderStandard, lineWidth: 1))
    }
}

private struct TeamHeaderAvatar: View {
    let agent: Agent

    var body: some View {
        AvatarView(name: agent.name, imageUrl: agent.avatarUrl, size: .small, status: nil)
            .scaleEffect(22.0 / 28.0)
            .frame(width: 22, height: 22)
            .accessibilityLabel(agent.name)
    }
}

private struct TeamChatOverflowView: View {
    let teamAgents: [Agent]
    let managerAgentIds: Set<String>
    let contextUsage: [TeamAgentContextUsage]
    let cycleNumber: Int
    let messageCount: Int
    let relayState: TeamRelayState?
    let relayError: String?
    let isWrappingUp: Bool
    let onCopyThread: () -> Void
    let onCopyThreadWithReferences: () -> Void
    let onWrapUpReset: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                utilityButton("Copy Thread", icon: "doc.on.doc", action: onCopyThread)
                    .contextMenu {
                        Button("Copy with References", action: onCopyThreadWithReferences)
                    }
                utilityButton("Wrap Up / Reset", icon: "arrow.triangle.2.circlepath", action: onWrapUpReset)
                    .disabled(isWrappingUp || messageCount == 0)

                Divider().padding(.vertical, 4)
                metadataRow("Cycle", icon: "circle.dotted", value: "\(cycleNumber)")
                metadataRow("Messages in View", icon: "text.bubble", value: "\(messageCount)")

                if let relayState, relayState.pauseReason == .replyLimit {
                    statusRow("Reply limit reached. Continue the relay after increasing its limit.")
                } else if let relayError {
                    statusRow(relayError)
                }

                Divider().padding(.vertical, 4)
                sectionTitle("All Agents")
                ForEach(teamAgents) { agent in
                    HStack(spacing: 9) {
                        TeamHeaderAvatar(agent: agent)
                        Text(agent.name)
                            .font(.system(size: 14))
                            .foregroundStyle(ClawColors.textPrimary)
                            .lineLimit(1)
                        Spacer(minLength: 8)
                        if managerAgentIds.contains(agent.id) {
                            Text("Manager")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(ClawColors.textSecondary)
                                .padding(.horizontal, 7)
                                .frame(height: 22)
                                .background(RelayColors.backgroundElevated)
                                .clipShape(Capsule())
                        }
                    }
                    .frame(height: 34)
                }

                Divider().padding(.vertical, 4)
                sectionTitle("Per-Agent Context Usage")
                ForEach(contextUsage) { usage in
                    HStack(spacing: 9) {
                        TeamHeaderAvatar(agent: usage.agent)
                        Text(usage.agent.name)
                            .font(.system(size: 14))
                            .foregroundStyle(ClawColors.textPrimary)
                            .lineLimit(1)
                        Spacer(minLength: 8)
                        Text(usage.label)
                            .font(.system(size: 14, weight: .medium).monospacedDigit())
                            .foregroundStyle(ClawColors.textPrimary)
                    }
                    .frame(height: 34)
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("\(usage.agent.name), \(usage.percent) percent context used, estimated")
                }
            }
            .padding(10)
        }
        .frame(width: 340, height: min(560, overflowHeight))
        .background(RelayColors.chatChrome)
    }

    private var overflowHeight: CGFloat {
        CGFloat(178 + teamAgents.count * 34 + contextUsage.count * 34)
    }

    private func utilityButton(_ title: String, icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon).frame(width: 24)
                Text(title)
                Spacer()
            }
            .font(.system(size: 15))
            .foregroundStyle(ClawColors.textPrimary)
            .frame(height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func metadataRow(_ title: String, icon: String, value: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon).frame(width: 24)
            Text(title)
            Spacer()
            Text(value).monospacedDigit()
        }
        .font(.system(size: 14))
        .foregroundStyle(ClawColors.textPrimary)
        .frame(height: 40)
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(ClawColors.textTertiary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 5)
    }

    private func statusRow(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11))
            .foregroundStyle(ClawColors.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 6)
    }
}

private extension DateFormatter {
    static let threadCopyFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }()
}

// MARK: - TeamMessageView

/// Variant of MessageView that always shows sender names and uses
/// agent-specific colours for name labels.
struct TeamMessageView: View {
    let message: Message
    let previousMessage: Message?
    let agentColor: Color
    let onCardTap: (EmbeddedCard) -> Void

    @EnvironmentObject private var appStore: AppStore

    private var isFromUser: Bool { message.isFromUser }

    private var resolvedSenderName: String {
        if !message.isFromUser,
           let agent = appStore.agents.first(where: { $0.id == message.senderId }) {
            return agent.name
        }
        return message.senderName
    }
    private var showAvatar: Bool {
        !isFromUser && previousMessage?.senderId != message.senderId
    }
    private var showSenderName: Bool {
        !isFromUser && previousMessage?.senderId != message.senderId
    }
    private var topPadding: CGFloat {
        previousMessage?.senderId == message.senderId ? 1 : 6
    }
    private var incomingBubbleColor: Color {
        agentColor.opacity(0.9)
    }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if !isFromUser {
                Group {
                    if showAvatar {
                        AvatarView(
                            name: resolvedSenderName,
                            imageUrl: message.senderAvatarUrl,
                            size: .small
                        )
                    } else {
                        Spacer().frame(width: 28)
                    }
                }
                .frame(width: 28)
            } else {
                Spacer(minLength: 60)
            }

            VStack(alignment: isFromUser ? .trailing : .leading, spacing: 2) {
                // Sender name always visible in team chat
                if showSenderName {
                    Text(resolvedSenderName)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(agentColor)
                        .padding(.horizontal, 4)
                }

                switch message.type {
                case .text:
                    switch message.provenance {
                    case .meetingBrief:
                        MeetingBriefBubble(message: message)
                    case .scheduledInjection:
                        ScheduledInjectionBubble(message: message)
                    case .meetingSystem:
                        SystemMessageView(message: message)
                    default:
                        TextBubble(message: message, incomingBubbleColor: incomingBubbleColor)
                    }
                case .system:
                    SystemMessageView(message: message)
                case .embeddedCard:
                    if let card = message.embeddedCard {
                        EmbeddedCardView(card: card, onTap: { onCardTap(card) })
                            .frame(maxWidth: 300, alignment: isFromUser ? .trailing : .leading)
                    }
                case .attachment:
                    AttachmentBubble(message: message, incomingBubbleColor: incomingBubbleColor)
                case .unknown:
                    TextBubble(message: message, incomingBubbleColor: incomingBubbleColor)
                }
            }

            if !isFromUser {
                Spacer(minLength: 60)
            }
        }
        .padding(.horizontal, 12)
        .padding(.top, topPadding)
        .padding(.bottom, 1)
    }
}

// MARK: - Preview

#Preview {
    let teamThread = Thread(
        id: "t3",
        title: "Sales Team",
        type: .team,
        workspaceId: "ws1",
        avatarUrl: nil,
        lastMessage: nil,
        unreadCount: 5,
        isPinned: true,
        isMuted: false,
        participantIds: ["u1", "a1", "a2", "a3"],
        createdAt: Date(),
        updatedAt: Date(),
        teamId: "team-sales",
        departmentId: nil,
        agentIds: ["a1", "a2", "a3"],
        status: .active
    )
    return NavigationStack {
        TeamChatView(thread: teamThread)
            .environmentObject(AppStore.preview)
    }
}
