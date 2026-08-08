import AppKit
import OSLog
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

enum ChatScrollDiagnostics {
  private static let logger = Logger(
    subsystem: Bundle.main.bundleIdentifier ?? "RelayConsole",
    category: "ChatScroll"
  )

  static func log(_ event: String, threadId: String?, _ details: String = "") {
    logger.notice(
      "[CHAT-SCROLL] event=\(event, privacy: .public) thread=\(threadId ?? "nil", privacy: .public) \(details, privacy: .public)"
    )
  }
}

extension View {
  func chatTimelineRow(verticalPadding: CGFloat = 9) -> some View {
    self
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 24)
      .padding(.vertical, verticalPadding)
  }
}

struct ChatScreen: View {
  @EnvironmentObject var model: AppViewModel
  @Binding var navigationPanelsVisible: Bool
  @State private var showWrapUpConfirm = false
  @State private var showTranscriptHistory = false
  @State private var isMessageStreamAtBottom = true
  @State private var historyPagingReady = false
  @State private var initialScrollPending = false
  @State private var initialScrollRequestID = UUID()
  @State private var showCustomRelayLimit = false
  @State private var customRelayLimitText = ""

  var activeDispatch: RuntimeDispatch? {
    model.dispatches.first { isActiveDispatch($0.status) }
  }

  var selectedAgent: AgentWithBinding? {
    model.selectedChatAgent
  }

  func messageHistoryLoadingRow(text: String) -> some View {
    HStack(spacing: 8) {
      ProgressView()
        .controlSize(.small)
      Text(text)
        .font(.caption)
        .foregroundStyle(RCTheme.muted)
    }
    .frame(maxWidth: .infinity, alignment: .center)
    .padding(.vertical, 6)
  }

  var body: some View {
    if model.usableAgents.isEmpty {
      unavailableChatStage
    } else {
      VStack(spacing: 0) {
        chatHeader
        ScrollViewReader { proxy in
          GeometryReader { scrollArea in
            ZStack(alignment: .bottomTrailing) {
              ScrollView {
                VStack(spacing: 0) {
                  if model.messageHistoryHasOlder {
                    messageHistoryLoadingRow(
                      text: model.messageHistoryLoadingOlder
                        ? "Loading earlier messages…" : "Scroll up for earlier messages"
                    )
                    .id("older-\(model.messages.first?.id ?? "empty")")
                    .chatTimelineRow()
                  }
                  if let error = model.error {
                    Text(error)
                      .font(.callout)
                      .foregroundStyle(RCTheme.text)
                      .padding(12)
                      .background(RCTheme.accentRed.opacity(0.12))
                      .clipShape(RoundedRectangle(cornerRadius: 4))
                      .overlay(
                        RoundedRectangle(cornerRadius: 4).stroke(RCTheme.accentRed.opacity(0.34))
                      )
                      .chatTimelineRow()
                  }
                  if model.messages.isEmpty {
                    EmptyMiniLight(title: emptyStateTitle, body: emptyStateBody)
                      .chatTimelineRow()
                  }
                  ForEach(Array(model.messages.enumerated()), id: \.element.id) { index, message in
                    MessageGroup(index: index, message: message)
                      .id(message.id)
                      .onAppear {
                        if historyPagingReady, index == 0, model.messageHistoryHasOlder {
                          model.loadOlderMessages()
                        }
                        if historyPagingReady, index == model.messages.count - 1,
                          model.messageHistoryHasNewer
                        {
                          model.loadNewerMessages()
                        }
                      }
                      .chatTimelineRow()
                  }
                  if model.messageHistoryHasNewer {
                    messageHistoryLoadingRow(
                      text: model.messageHistoryLoadingNewer
                        ? "Loading newer messages…" : "Continue toward newer messages"
                    )
                    .id("newer-\(model.messages.last?.id ?? "empty")")
                    .chatTimelineRow()
                  }
                  Color.clear
                    .frame(height: 1)
                    .id("end")
                    .onAppear {
                      ChatScrollDiagnostics.log(
                        "end-anchor-appear",
                        threadId: model.selectedThreadId,
                        scrollStateDetails()
                      )
                      settleInitialScrollIfReady(proxy, reason: "end-anchor-appear")
                    }
                    .background(
                      GeometryReader { marker in
                        Color.clear.preference(
                          key: ChatMessageEndOffsetPreferenceKey.self,
                          value: marker.frame(in: .named("chat-message-scroll")).minY
                        )
                      }
                    )
                    .chatTimelineRow(verticalPadding: 10)
                }
              }
              .coordinateSpace(name: "chat-message-scroll")
              .id(messageTimelineIdentity)
              .onPreferenceChange(ChatMessageEndOffsetPreferenceKey.self) { markerY in
                guard markerY.isFinite, markerY < .greatestFiniteMagnitude else {
                  ChatScrollDiagnostics.log(
                    "bottom-marker-unavailable",
                    threadId: model.selectedThreadId,
                    "markerY=\(markerY) \(scrollStateDetails())"
                  )
                  return
                }
                let isAtBottom = markerY <= scrollArea.size.height + 48
                if isMessageStreamAtBottom != isAtBottom {
                  ChatScrollDiagnostics.log(
                    "bottom-state-change",
                    threadId: model.selectedThreadId,
                    "from=\(isMessageStreamAtBottom) to=\(isAtBottom) markerY=\(markerY) viewportHeight=\(scrollArea.size.height) \(scrollStateDetails())"
                  )
                  isMessageStreamAtBottom = isAtBottom
                }
              }
              if shouldShowJumpToLatestButton {
                Button {
                  ChatScrollDiagnostics.log(
                    "jump-to-latest-click",
                    threadId: model.selectedThreadId,
                    scrollStateDetails()
                  )
                  if model.messageHistoryHasNewer {
                    beginInitialScroll(reason: "jump-button-newer-page")
                    model.jumpToLatestMessageWindow()
                    settleInitialScrollIfReady(proxy, reason: "jump-button-newer-page")
                  } else {
                    scrollToLatest(proxy, animated: false, reason: "jump-button")
                  }
                } label: {
                  HStack(spacing: 5) {
                    Image(systemName: "arrow.down")
                    if model.messageHistoryUnseenNewerCount > 0 {
                      Text("\(model.messageHistoryUnseenNewerCount)")
                        .font(.system(size: 10, weight: .bold))
                    }
                  }
                }
                .buttonStyle(IconButtonStyle())
                .help("Jump to latest message")
                .accessibilityLabel("Jump to latest message")
                .padding(.trailing, 20)
                .padding(.bottom, 16)
                .transition(.opacity)
              }
            }
            .animation(.easeOut(duration: 0.14), value: shouldShowJumpToLatestButton)
          }
          .onAppear {
            ChatScrollDiagnostics.log(
              "chat-screen-appear",
              threadId: model.selectedThreadId,
              scrollStateDetails()
            )
            beginInitialScroll(reason: "chat-screen-appear")
            settleInitialScrollIfReady(proxy, reason: "chat-screen-appear")
          }
          .onChange(of: model.selectedThreadId) { previousThreadId, currentThreadId in
            ChatScrollDiagnostics.log(
              "selected-thread-change",
              threadId: currentThreadId,
              "previousThread=\(previousThreadId ?? "nil") \(scrollStateDetails())"
            )
            beginInitialScroll(reason: "selected-thread-change")
          }
          .onChange(of: model.selectedWrapUpReportId) { previousReportId, currentReportId in
            ChatScrollDiagnostics.log(
              "selected-transcript-change",
              threadId: model.selectedThreadId,
              "previousReport=\(previousReportId ?? "nil") currentReport=\(currentReportId ?? "nil") \(scrollStateDetails())"
            )
            beginInitialScroll(reason: "selected-transcript-change")
          }
          .onChange(of: model.messageHistoryRevision) { previousRevision, currentRevision in
            ChatScrollDiagnostics.log(
              "history-revision-change",
              threadId: model.selectedThreadId,
              "previous=\(previousRevision) current=\(currentRevision) prependAnchor=\(model.messageHistoryPrependAnchorId ?? "nil") \(scrollStateDetails())"
            )
            if let anchorId = model.messageHistoryPrependAnchorId {
              initialScrollPending = false
              historyPagingReady = true
              isMessageStreamAtBottom = false
              DispatchQueue.main.async {
                ChatScrollDiagnostics.log(
                  "scroll-to-prepend-anchor",
                  threadId: model.selectedThreadId,
                  "anchor=\(anchorId) \(scrollStateDetails())"
                )
                proxy.scrollTo(anchorId, anchor: .top)
              }
            } else {
              settleInitialScrollIfReady(proxy, reason: "history-revision")
            }
          }
          .onChange(of: model.messages.map(\.id)) { previousIds, currentIds in
            ChatScrollDiagnostics.log(
              "message-ids-change",
              threadId: model.selectedThreadId,
              "previousCount=\(previousIds.count) currentCount=\(currentIds.count) previousLast=\(previousIds.last ?? "nil") currentLast=\(currentIds.last ?? "nil") \(scrollStateDetails())"
            )
            if initialScrollPending {
              settleInitialScrollIfReady(proxy, reason: "message-ids-initial-pending")
              return
            }
            let appendedMessage =
              previousIds.last != currentIds.last
              && currentIds.count >= previousIds.count
            if appendedMessage && isMessageStreamAtBottom && !model.messageHistoryHasNewer {
              scrollToLatest(proxy, animated: false, reason: "message-appended-at-bottom")
            }
          }
        }
        .padding(.top, 0)
        if !model.composerMentionSuggestions.isEmpty {
          MentionSuggestionsView(agents: model.composerMentionSuggestions) { agent in
            model.insertComposerMention(agent)
          }
          .padding(.horizontal, 16)
          .padding(.top, 8)
        }
        ComposerTextView(
          text: Binding(
            get: { model.composerText },
            set: { model.updateComposerDraft($0) }
          ),
          placeholder: "Send a message to this conversation",
          disabled: composerDisabledReason != nil,
          disabledReason: composerDisabledReason,
          statusText: composerStatusText,
          attachments: model.visibleComposerAttachments,
          canSend: composerCanSend,
          isSending: model.busy == "send-message",
          approvalMode: model.runtimeApprovalMode,
          modelSelection: composerModelSelection,
          modelOptions: composerModelOptions,
          isUpdatingModel: composerModelAgent.map { model.busy == "update-agent-model-\($0.id)" }
            ?? false,
          onAttachFiles: { model.stageComposerAttachments(mediaOnly: false) },
          onAttachMedia: { model.stageComposerAttachments(mediaOnly: true) },
          onSelectApprovalMode: { model.setRuntimeApprovalMode($0) },
          onSelectModel: composerModelAgent.map { agent in
            { selectedModel in model.updateAgentModel(agent, model: selectedModel) }
          },
          onRemoveAttachment: { model.removeComposerAttachment($0) }
        ) {
          submit()
        }
        .frame(maxWidth: .infinity)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 24)
        .padding(.top, 10)
        .padding(.bottom, 24)
      }
      .background(RCTheme.chatCanvas)
    }
  }

  @ViewBuilder
  private var unavailableChatStage: some View {
    if model.chatReadyRecords.isEmpty {
      EmptyStage(
        title: "Connect a runtime to start",
        body:
          "Install and authenticate Hermes Agent or OpenClaw yourself, then connect that existing runtime in Settings."
      ) {
        model.selectNav(.settings)
        model.selectSettingsPanel(.harnesses)
      }
    } else if model.visibleAgents.isEmpty {
      EmptyStage(
        title: "Create an agent to start",
        body: "Your runtime is connected. Create an agent in this workspace to begin chatting.",
        actionTitle: "Create Agent"
      ) {
        model.beginCreateAgent(type: model.chatReadyRecords.first?.harnessKey)
      }
    } else {
      EmptyStage(
        title: "Finish setting up an agent",
        body:
          "Your runtime is connected, but no agent in this workspace is ready for chat.",
        actionTitle: "Open Agents"
      ) {
        model.selectNav(.agents)
      }
    }
  }

  var activeAgentName: String {
    activeDispatch.flatMap { dispatch in model.agents.first { $0.id == dispatch.agentId } }.map(
      model.resolveAgentDisplayName) ?? selectedAgent.map(model.resolveAgentDisplayName) ?? "Agent"
  }

  var composerModelAgent: AgentWithBinding? {
    guard model.selectedThread?.threadType == .direct else { return nil }
    return selectedAgent
  }

  var composerModelOptions: [HarnessModelOption] {
    guard let agent = composerModelAgent else { return [] }
    return model.modelOptions(for: agent.binding.runtimeType == .hermes ? .hermes : .openclaw)
  }

  var composerModelSelection: String? {
    guard let agent = composerModelAgent else { return nil }
    return agent.model ?? stringValue(agent.binding.config["model"])
  }

  var composerDisabledReason: String? {
    if model.isViewingWrapUpTranscript {
      return "Historical transcripts are read-only."
    }
    if model.composerUploadInProgress {
      return "Attachment upload in progress."
    }
    if model.busy == "send-message" {
      return "Sending your message"
    }
    if selectedAgent == nil {
      return "Select an agent before sending."
    }
    if model.selectedThread?.isArchived == true {
      return "Archived threads are read-only."
    }
    return nil
  }

  var messageTimelineIdentity: String {
    [
      model.selectedThreadId ?? "new-thread",
      model.selectedWrapUpReportId ?? "current-cycle",
    ].joined(separator: ":")
  }

  var shouldShowJumpToLatestButton: Bool {
    !model.messages.isEmpty && (!isMessageStreamAtBottom || model.messageHistoryHasNewer)
  }

  var emptyStateTitle: String {
    model.isViewingWrapUpTranscript ? "No transcript messages" : "Start chat"
  }

  var emptyStateBody: String {
    if model.isViewingWrapUpTranscript {
      return "No transcript messages were found for this wrapped-up cycle."
    }
    if let reports = model.selectedThreadDetail?.wrapUpReports, !reports.isEmpty,
      let currentCycle = model.currentChatCycleNumber
    {
      let latestWrapped = model.sortedWrapUpReports.first.flatMap(cycleNumber)
      return latestWrapped.map {
        "Cycle \(currentCycle) is now open and empty. The previous conversation is under Cycle \($0) transcript."
      } ?? "Cycle \(currentCycle) is now open and empty."
    }
    return "Send your first message."
  }

  var composerCanSend: Bool {
    guard model.busy != "send-message" else { return false }
    return composerHasSendableContent
  }

  var composerStatusText: String? {
    if let composerDisabledReason {
      return composerDisabledReason
    }
    if let availability = model.composerMentionAvailability, !availability.isAvailable {
      return availability.message
    }
    if let targetSummary = model.composerMentionTargetSummary {
      return "Will notify \(targetSummary)."
    }
    if model.selectedThread?.threadType == .team,
      model.composerMentionAvailability?.isAvailable == true,
      composerHasSendableContent
    {
      return "No mention: will pick one team agent."
    }
    if activeDispatch != nil {
      return "\(activeAgentName) is thinking. New messages will be injected."
    }
    if model.busy == "send-message" {
      return "Sending your message"
    }
    return nil
  }

  var composerHasSendableContent: Bool {
    !model.composerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
      || model.composerAttachments.contains { [.staged, .uploaded].contains($0.status) }
  }

  var composerNeedsTeamMentionTarget: Bool {
    false
  }

  var chatHeader: some View {
    let isTeamThread = model.selectedThread?.threadType == .team
    return HStack(spacing: 12) {
      ChatHeaderAvatarCluster(
        isTeamThread: isTeamThread,
        selectedAgent: selectedAgent,
        teamAgents: model.selectedTeamAgents
      )
      .layoutPriority(0)

      Spacer(minLength: 8)

      HStack(spacing: 6) {
        transcriptHistoryControl
        if isTeamThread, model.selectedTeamRelaySession != nil {
          teamRelayControls
        }
        Button {
          model.copyThreadTranscript()
        } label: {
          HeaderIconControl(symbolName: "doc.on.doc")
        }
        .buttonStyle(.plain)
        .help("Copy thread")
        .accessibilityLabel("Copy thread")
        .disabled(model.messages.isEmpty)

        if model.selectedThread?.threadType == .direct || model.selectedThread?.threadType == .team
        {
          Button {
            showWrapUpConfirm = true
          } label: {
            HeaderIconControl(symbolName: "arrow.triangle.2.circlepath")
          }
          .buttonStyle(.plain)
          .help("Wrap up and reset")
          .accessibilityLabel("Wrap up and reset")
          .disabled(wrapUpDisabled)
        }
      }
      .layoutPriority(3)

      Rectangle()
        .fill(RCTheme.borderLow)
        .frame(width: 1, height: 24)

      HStack(spacing: 6) {
        currentCycleInfo
        RuntimeContextUsageStrip(rows: model.chatRuntimeContextUsageRows)
        HeaderMessageCountChip(count: model.messages.count)
      }
      .fixedSize(horizontal: true, vertical: false)
      .layoutPriority(3)
    }
    .padding(.bottom, RCChromeMetrics.topHeaderContentBottomPadding)
    .frame(height: RCChromeMetrics.topReservedHeight, alignment: .bottom)
    .padding(.horizontal, 16)
    .padding(.leading, navigationPanelsVisible ? 0 : 44)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(RCTheme.chatCanvas)
    .alert("Reset this \(isTeamThread ? "team" : "direct") chat?", isPresented: $showWrapUpConfirm)
    {
      Button("Cancel", role: .cancel) {}
      Button("Wrap up and reset") {
        model.wrapUpAndResetSelectedThread()
      }
      .disabled(model.busy == "wrap-up-thread")
    } message: {
      Text(
        isTeamThread
          ? "This will generate a wrap-up report for the current conversation, keep the same team name, avatar, and agents, and reopen the chat on a blank canvas."
          : "This will generate a wrap-up report for the current conversation, keep the same chat name, avatar, and agent, and reopen the chat on a blank canvas."
      )
    }
  }

  @ViewBuilder
  var teamRelayControls: some View {
    if let session = model.selectedTeamRelaySession {
      let isPaused = session.relayRunState == .paused
      let replyCount = model.teamRelayAgentReplyCount
      let replyLimit = session.relayReplyLimit
      HStack(spacing: 6) {
        Button {
          if isPaused {
            model.continueSelectedTeamRelay()
          } else {
            model.pauseSelectedTeamRelay()
          }
        } label: {
          Image(systemName: isPaused ? "play.fill" : "pause.fill")
        }
        .buttonStyle(IconLightButtonStyle())
        .help(isPaused ? "Continue team relay" : "Pause team relay")
        .accessibilityLabel(isPaused ? "Continue team relay" : "Pause team relay")
        .disabled(teamRelayControlDisabled)

        Menu {
          ForEach(TeamRelayReplyLimits.presets, id: \.self) { preset in
            Button("\(preset)") {
              model.setSelectedTeamRelayReplyLimit(preset)
            }
          }
          Divider()
          Button("Custom...") {
            customRelayLimitText = "\(replyLimit)"
            showCustomRelayLimit = true
          }
        } label: {
          HeaderControlChip(
            icon: "timer",
            text: "\(replyCount)/\(replyLimit)",
            interactive: true,
            showsChevron: true
          )
        }
        .menuStyle(.borderlessButton)
        .buttonStyle(.plain)
        .help("Team relay reply limit")
        .accessibilityLabel("Team relay reply limit")
        .disabled(teamRelayControlDisabled)
        .popover(isPresented: $showCustomRelayLimit, arrowEdge: .bottom) {
          customRelayLimitPopover
        }
      }
    }
  }

  var customRelayLimitPopover: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("Reply limit")
        .font(.system(size: 13, weight: .semibold))
        .foregroundStyle(RCTheme.text)
      TextField("Limit", text: $customRelayLimitText)
        .textFieldStyle(.roundedBorder)
        .frame(width: 160)
      HStack(spacing: 8) {
        Button("Cancel") {
          showCustomRelayLimit = false
        }
        Spacer()
        Button("Apply") {
          applyCustomRelayLimit()
        }
        .buttonStyle(PrimaryLightButtonStyle())
        .disabled(parsedCustomRelayLimit == nil)
      }
    }
    .padding(12)
    .frame(width: 220)
    .background(RCTheme.sidebarSurface)
  }

  var parsedCustomRelayLimit: Int? {
    let trimmed = customRelayLimitText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let value = Int(trimmed), value > 0 else { return nil }
    return TeamRelayReplyLimits.normalized(value)
  }

  var teamRelayControlDisabled: Bool {
    model.busy == "pause-team-relay"
      || model.busy == "continue-team-relay"
      || model.busy == "team-relay-limit"
      || model.busy == "select-thread"
      || model.busy == "wrap-up-thread"
  }

  func applyCustomRelayLimit() {
    guard let value = parsedCustomRelayLimit else { return }
    model.setSelectedTeamRelayReplyLimit(value)
    showCustomRelayLimit = false
  }

  var cycleControls: some View {
    HStack(spacing: 6) {
      if let currentCycle = model.currentChatCycleNumber {
        Button {
          model.viewCurrentChatCycle()
        } label: {
          HeaderControlChip(
            icon: "message",
            text: "\(currentCycle)",
            interactive: false
          )
        }
        .buttonStyle(.plain)
        .help("Current chat, cycle \(currentCycle)")
        .accessibilityLabel("Current chat, cycle \(currentCycle)")
      }
    }
  }

  @ViewBuilder
  var currentCycleInfo: some View {
    if let currentCycle = model.currentChatCycleNumber {
      Button {
        if model.isViewingWrapUpTranscript {
          model.viewCurrentChatCycle()
        }
      } label: {
        HeaderControlChip(
          icon: "message",
          text: "\(currentCycle)",
          interactive: false
        )
      }
      .buttonStyle(.plain)
      .help("Current chat, cycle \(currentCycle)")
      .accessibilityLabel("Current chat, cycle \(currentCycle)")
    }
  }

  @ViewBuilder
  var transcriptHistoryControl: some View {
    if !model.sortedWrapUpReports.isEmpty {
      Button {
        showTranscriptHistory.toggle()
      } label: {
        HeaderControlChip(
          icon: "doc.text",
          text: "\(model.sortedWrapUpReports.count)",
          interactive: true,
          showsChevron: true,
          minWidth: 56
        )
      }
      .buttonStyle(.plain)
      .frame(minWidth: 56)
      .frame(height: ChatHeaderControlStyle.height)
      .popover(isPresented: $showTranscriptHistory, arrowEdge: .bottom) {
        TranscriptHistoryPopover(
          reports: model.sortedWrapUpReports,
          titleForReport: cycleMenuTitle
        ) { report in
          model.viewWrapUpTranscript(report)
          showTranscriptHistory = false
        }
      }
      .help("Open transcript history")
      .accessibilityLabel("Open transcript history")
    }
  }

  var wrapUpDisabled: Bool {
    model.busy == "wrap-up-thread"
      || model.busy == "select-thread"
      || model.isViewingWrapUpTranscript
      || model.messages.isEmpty
      || model.selectedThread == nil
  }

  func submit() {
    let text = model.composerText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard model.busy != "send-message", composerCanSend, composerDisabledReason == nil,
      let agent = selectedAgent
    else { return }
    model.sendMessage(agentId: agent.id, content: text)
  }

  func scrollToLatest(_ proxy: ScrollViewProxy, animated: Bool, reason: String) {
    let targetThreadId = model.selectedThreadId
    DispatchQueue.main.async {
      guard model.selectedThreadId == targetThreadId else { return }
      ChatScrollDiagnostics.log(
        "scroll-to-end",
        threadId: model.selectedThreadId,
        "reason=\(reason) animated=\(animated) \(scrollStateDetails())"
      )
      if animated {
        withAnimation(.easeOut(duration: 0.18)) {
          proxy.scrollTo("end", anchor: .bottom)
        }
      } else {
        proxy.scrollTo("end", anchor: .bottom)
      }
    }
  }

  func beginInitialScroll(reason: String) {
    ChatScrollDiagnostics.log(
      "begin-initial-scroll",
      threadId: model.selectedThreadId,
      "reason=\(reason) \(scrollStateDetails())"
    )
    historyPagingReady = false
    isMessageStreamAtBottom = true
    initialScrollRequestID = UUID()
    initialScrollPending = true
  }

  func settleInitialScrollIfReady(_ proxy: ScrollViewProxy, reason: String) {
    guard initialScrollPending,
      model.messageWindowThreadId == model.selectedThreadId,
      !model.messageHistoryHasNewer
    else { return }

    initialScrollPending = false
    historyPagingReady = true
    let targetThreadId = model.selectedThreadId
    let requestID = initialScrollRequestID
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
      guard model.selectedThreadId == targetThreadId,
        initialScrollRequestID == requestID,
        !initialScrollPending
      else { return }
      ChatScrollDiagnostics.log(
        "scroll-to-end",
        threadId: model.selectedThreadId,
        "reason=settle-initial-scroll:\(reason) \(scrollStateDetails())"
      )
      proxy.scrollTo("end", anchor: .bottom)
    }
  }

  func scrollStateDetails() -> String {
    "messages=\(model.messages.count) first=\(model.messages.first?.id ?? "nil") last=\(model.messages.last?.id ?? "nil") atBottom=\(isMessageStreamAtBottom) initialPending=\(initialScrollPending) pagingReady=\(historyPagingReady) hasOlder=\(model.messageHistoryHasOlder) hasNewer=\(model.messageHistoryHasNewer) revision=\(model.messageHistoryRevision)"
  }

  func cycleMenuTitle(_ report: ThreadWrapUpReport) -> String {
    let cycle = cycleNumber(report).map { "Cycle \($0)" } ?? "Cycle ?"
    switch report.status {
    case .pending, .generating:
      return "\(cycle) transcript (\(report.status.rawValue))"
    case .failed, .unavailable:
      return "\(cycle) transcript (\(report.status.rawValue))"
    case .completed:
      return "\(cycle) transcript"
    }
  }

  func cycleNumber(_ report: ThreadWrapUpReport) -> Int? {
    guard let sessionId = report.sessionId else { return nil }
    return model.selectedThreadDetail?.sessions.first { $0.id == sessionId }?.sequenceNumber
  }
}
