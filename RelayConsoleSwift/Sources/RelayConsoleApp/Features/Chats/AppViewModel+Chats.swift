import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func runAction(
    _ label: String,
    refresh refreshMode: AppViewModelActionRefresh = .full,
    _ action: @escaping () async throws -> String?
  ) {
    let startedAt = Date()
    let featureStore = featureOperationStore(for: label, refreshMode: refreshMode)
    telemetry.actionStarted(label)
    featureStore.begin(label)
    busy = label
    error = nil
    Task {
      do {
        let preferred = try await action()
        featureStore.finish()
        busy = nil
        await Task.yield()
        switch refreshMode {
        case .full:
          await refresh(preferredThreadId: preferred)
        case .chat:
          await refreshChatState(preferredThreadId: preferred)
        case .agents:
          await refreshAgentsState()
        case .operationalOutputs:
          await refreshOperationalOutputs()
        case .applications:
          await refreshApplicationsState()
        case .approvals:
          await refreshApprovalsState()
        case .insights:
          await refreshInsightsState()
        case .settings:
          await refreshSettingsState()
        case .none:
          break
        }
        telemetry.actionSucceeded(
          label,
          elapsed: Date().timeIntervalSince(startedAt)
        )
      } catch {
        let message = error.localizedDescription
        featureStore.fail(message)
        busy = nil
        telemetry.actionFailed(
          label,
          elapsed: Date().timeIntervalSince(startedAt),
          error: error
        )
        switch label {
        case "save-x-personal-tokens":
          xConnectionStatus = message
        case "save-linkedin-manual-token":
          linkedinConnectionStatus = message
        case "save-notion-api-token":
          notionConnectionStatus = message
        case "save-google-calendar-oauth-credentials":
          googleCalendarConnectionStatus = message
        case "connect-google-docs-oauth":
          googleDocsConnectionStatus = message
        case "connect-google-calendar-oauth":
          googleCalendarConnectionStatus = message
        case let value where value.hasPrefix("test-google-calendar-connection-"):
          googleCalendarConnectionStatus = message
        case "connect-google-drive-oauth":
          googleDriveConnectionStatus = message
        case "save-google-drive-oauth-credentials":
          googleDriveConnectionStatus = message
        case "connect-google-sheets-oauth":
          googleSheetsConnectionStatus = message
        case "connect-google-slides-oauth":
          googleSlidesConnectionStatus = message
        case "connect-google-forms-oauth":
          googleFormsConnectionStatus = message
        case "connect-google-tasks-oauth":
          googleTasksConnectionStatus = message
        case "connect-google-contacts-oauth":
          googleContactsConnectionStatus = message
        case "connect-google-photos-oauth":
          googlePhotosConnectionStatus = message
        case "connect-google-meet-oauth":
          googleMeetConnectionStatus = message
        case "connect-google-chat-oauth":
          googleChatConnectionStatus = message
        case "connect-google-ads-oauth":
          googleAdsConnectionStatus = message
        case "connect-google-search-console-oauth", "save-google-search-console-oauth-credentials":
          googleSearchConsoleConnectionStatus = message
        case let value where value.hasPrefix("test-google-search-console-connection-"):
          googleSearchConsoleConnectionStatus = message
        case "connect-google-analytics-oauth", "save-google-analytics-oauth-credentials":
          googleAnalyticsConnectionStatus = message
        case "connect-posthog-oauth", "save-posthog-personal-api-key":
          postHogConnectionStatus = message
        case let value where value.hasPrefix("test-posthog-connection-"):
          postHogConnectionStatus = message
        case "save-microsoft-clarity-api-token":
          microsoftClarityConnectionStatus = message
        case let value where value.hasPrefix("test-microsoft-clarity-connection-"):
          microsoftClarityConnectionStatus = message
        case "save-telemetrydeck-pat":
          telemetryDeckConnectionStatus = message
        case let value where value.hasPrefix("test-telemetrydeck-connection-"):
          telemetryDeckConnectionStatus = message
        case let value where value.hasPrefix("test-notion-connection-"):
          notionConnectionStatus = message
        case let value where value.hasPrefix("toggle-slack-agent-"):
          slackConnectionStatus = message
        case let value where value.hasPrefix("toggle-github-agent-"):
          githubConnectionStatus = message
        case let value where value.hasPrefix("toggle-gitlab-agent-"):
          gitLabConnectionStatus = message
        case let value where value.hasPrefix("toggle-bitbucket-agent-"):
          bitbucketConnectionStatus = message
        case let value where value.hasPrefix("toggle-linear-agent-"):
          linearConnectionStatus = message
        case let value where value.hasPrefix("toggle-asana-agent-"):
          asanaConnectionStatus = message
        case let value where value.hasPrefix("toggle-trello-agent-"):
          trelloConnectionStatus = message
        case let value where value.hasPrefix("toggle-clickup-agent-"):
          clickUpConnectionStatus = message
        case let value where value.hasPrefix("toggle-monday-agent-"):
          mondayConnectionStatus = message
        case let value where value.hasPrefix("toggle-airtable-agent-"):
          airtableConnectionStatus = message
        case "add-exa-api-connection", "test-exa-api-key":
          exaConnectionStatus = message
        case let value where value.hasPrefix("connect-manifest-provider-"):
          marketplaceManifestConnectionStatus = "Connection failed: \(message)"
        case let value where value.hasPrefix("start-provider-setup-"):
          marketplaceOAuthConnectionStatus = message
        case let value where value.hasPrefix("disconnect-provider-oauth-"):
          marketplaceOAuthConnectionStatus = message
        case let value where value.hasPrefix("toggle-shared-marketplace-agent-"):
          marketplaceAgentAssignmentStatus = "Assignment failed: \(message)"
        default:
          break
        }
        if refreshMode != .applications
          && (label.hasPrefix("save-") || label.hasPrefix("settings-"))
        {
          services?.eventBus.emit(
            .settingsSaveFailed,
            [
              "label": .string(label),
              "message": .string(message),
            ] as JSONRecord)
        }
        self.error = message
        await Task.yield()
        switch refreshMode {
        case .full:
          await refresh()
        case .chat:
          await refreshChatState()
        case .agents:
          await refreshAgentsState()
        case .operationalOutputs:
          await refreshOperationalOutputs()
        case .applications:
          await refreshApplicationsState()
        case .approvals:
          await refreshApprovalsState()
        case .insights:
          await refreshInsightsState()
        case .settings:
          await refreshSettingsState()
        case .none:
          break
        }
      }
    }
  }

  func featureOperationStore(
    for label: String,
    refreshMode: AppViewModelActionRefresh
  ) -> FeatureOperationStore {
    if refreshMode == .applications {
      return applicationsFeatureStore
    }
    if label.hasPrefix("approval-") || label.contains("provider-approval") {
      return approvalsFeatureStore
    }
    if label.hasPrefix("insights-") {
      return insightsFeatureStore
    }
    if label.hasPrefix("save-account-") || label.hasPrefix("save-appearance-")
      || label.hasPrefix("save-workspace-") || label.hasPrefix("settings-")
    {
      return settingsFeatureStore
    }
    if label.contains("agent") || label.contains("task") || label.contains("cron")
      || label.contains("artifact") || label.contains("agentops")
    {
      return agentFeatureStore
    }
    return chatFeatureStore
  }

  func refreshMessageWindow(
    services: RelayConsoleServices,
    threadId: RelayId,
    sessionId: RelayId?
  ) throws {
    let contextChanged = messageWindowThreadId != threadId || messageWindowSessionId != sessionId
    if contextChanged || messages.isEmpty {
      let page = try services.data.listMessagePage(
        threadId: threadId,
        sessionId: sessionId,
        limit: Self.messagePageSize
      )
      messageWindowThreadId = threadId
      messageWindowSessionId = sessionId
      messages = page.messages
      messageHistoryHasOlder = page.hasOlder
      messageHistoryHasNewer = false
      messageHistoryUnseenNewerCount = 0
      messageHistoryPrependAnchorId = nil
      messageHistoryRevision += 1
      return
    }

    guard !messageHistoryHasNewer else {
      messageHistoryUnseenNewerCount =
        try messages.last.map {
          try services.data.countMessages(
            threadId: threadId,
            sessionId: sessionId,
            after: MessageCursor(message: $0)
          )
        } ?? 0
      return
    }

    let latest = try services.data.listMessagePage(
      threadId: threadId,
      sessionId: sessionId,
      limit: Self.messagePageSize
    )
    var reconciled = mergedMessages(messages, latest.messages)
    let overflow = max(0, reconciled.count - Self.messageWindowLimit)
    if overflow > 0 { reconciled.removeFirst(overflow) }
    messages = reconciled
    messageHistoryHasOlder = messageHistoryHasOlder || latest.hasOlder || overflow > 0
    messageHistoryHasNewer = false
    messageHistoryUnseenNewerCount = 0
  }

  func loadOlderMessages() {
    guard !messageHistoryLoadingOlder, messageHistoryHasOlder,
      let services,
      let threadId = messageWindowThreadId,
      threadId == selectedThreadId,
      let first = messages.first
    else { return }
    messageHistoryLoadingOlder = true
    defer { messageHistoryLoadingOlder = false }
    do {
      let generation = messageWindowGeneration
      let anchorId = first.id
      let page = try services.data.listMessagePage(
        threadId: threadId,
        sessionId: messageWindowSessionId,
        limit: Self.messagePageSize,
        before: MessageCursor(message: first)
      )
      guard generation == messageWindowGeneration, threadId == selectedThreadId else { return }
      var reconciled = mergedMessages(page.messages, messages)
      let overflow = max(0, reconciled.count - Self.messageWindowLimit)
      if overflow > 0 { reconciled.removeLast(overflow) }
      messages = reconciled
      messageHistoryHasOlder = page.hasOlder
      messageHistoryHasNewer = messageHistoryHasNewer || overflow > 0
      if messageHistoryHasNewer, let last = messages.last {
        messageHistoryUnseenNewerCount = try services.data.countMessages(
          threadId: threadId,
          sessionId: messageWindowSessionId,
          after: MessageCursor(message: last)
        )
      }
      messageHistoryPrependAnchorId = anchorId
      messageHistoryRevision += 1
    } catch {
      self.error = error.localizedDescription
    }
  }

  func loadNewerMessages() {
    guard !messageHistoryLoadingNewer, messageHistoryHasNewer,
      let services,
      let threadId = messageWindowThreadId,
      threadId == selectedThreadId,
      let last = messages.last
    else { return }
    messageHistoryLoadingNewer = true
    defer { messageHistoryLoadingNewer = false }
    do {
      let generation = messageWindowGeneration
      let page = try services.data.listMessagePage(
        threadId: threadId,
        sessionId: messageWindowSessionId,
        limit: Self.messagePageSize,
        after: MessageCursor(message: last)
      )
      guard generation == messageWindowGeneration, threadId == selectedThreadId else { return }
      var reconciled = mergedMessages(messages, page.messages)
      let overflow = max(0, reconciled.count - Self.messageWindowLimit)
      if overflow > 0 { reconciled.removeFirst(overflow) }
      messages = reconciled
      messageHistoryHasOlder = messageHistoryHasOlder || overflow > 0
      messageHistoryHasNewer = page.hasNewer
      messageHistoryUnseenNewerCount =
        messageHistoryHasNewer
        ? try services.data.countMessages(
          threadId: threadId,
          sessionId: messageWindowSessionId,
          after: MessageCursor(message: messages.last ?? last)
        ) : 0
      messageHistoryPrependAnchorId = nil
      messageHistoryRevision += 1
    } catch {
      self.error = error.localizedDescription
    }
  }

  func jumpToLatestMessageWindow() {
    guard let services,
      let threadId = messageWindowThreadId,
      threadId == selectedThreadId
    else { return }
    do {
      let page = try services.data.listMessagePage(
        threadId: threadId,
        sessionId: messageWindowSessionId,
        limit: Self.messagePageSize
      )
      messages = page.messages
      messageHistoryHasOlder = page.hasOlder
      messageHistoryHasNewer = false
      messageHistoryUnseenNewerCount = 0
      messageHistoryPrependAnchorId = nil
      messageHistoryRevision += 1
    } catch {
      self.error = error.localizedDescription
    }
  }

  func mergedMessages(_ lhs: [Message], _ rhs: [Message]) -> [Message] {
    var byId: [RelayId: Message] = [:]
    for message in lhs { byId[message.id] = message }
    for message in rhs { byId[message.id] = message }
    return byId.values.sorted {
      if $0.createdAt != $1.createdAt { return $0.createdAt < $1.createdAt }
      return $0.id < $1.id
    }
  }

  func resetMessageWindowSelection() {
    messageWindowGeneration += 1
    messageWindowThreadId = nil
    messageWindowSessionId = nil
    messageHistoryHasOlder = false
    messageHistoryHasNewer = false
    messageHistoryLoadingOlder = false
    messageHistoryLoadingNewer = false
    messageHistoryUnseenNewerCount = 0
    messageHistoryPrependAnchorId = nil
  }

  func selectThread(_ threadId: String) {
    resetMessageWindowSelection()
    selectedThreadId = threadId
    selectedWrapUpReportId = nil
    if let threadAgentId = threads.first(where: { $0.id == threadId })?.selectedAgentId,
      agents.contains(where: { $0.id == threadAgentId })
    {
      selectedAgentId = threadAgentId
    }
    Task { await refreshChatState(preferredThreadId: threadId) }
  }

  func viewCurrentChatCycle() {
    resetMessageWindowSelection()
    selectedWrapUpReportId = nil
    scheduleRefresh(.chat, preferredThreadId: selectedThreadId)
  }

  func viewWrapUpTranscript(_ report: ThreadWrapUpReport) {
    resetMessageWindowSelection()
    selectedWrapUpReportId = report.id
    scheduleRefresh(.chat, preferredThreadId: selectedThreadId)
  }

  func wrapUpAndResetSelectedThread() {
    runAction("wrap-up-thread", refresh: .chat) {
      guard let services = self.services, let workspace = self.workspace,
        let threadId = self.selectedThreadId
      else {
        throw RelayError(.workspaceMissing, "Select a thread before wrapping up.")
      }
      _ = try services.chat.requestWrapUpReport(
        context: self.chatContext(workspaceId: workspace.id),
        threadId: threadId
      )
      self.selectedWrapUpReportId = nil
      return threadId
    }
  }

  func pauseSelectedTeamRelay() {
    runAction("pause-team-relay", refresh: .chat) {
      guard let services = self.services, let threadId = self.selectedThreadId else {
        throw RelayError(.invalidInput, "Select a team chat before pausing relay.")
      }
      _ = try services.dispatch.pauseTeamRelay(threadId: threadId)
      return threadId
    }
  }

  func continueSelectedTeamRelay() {
    runAction("continue-team-relay", refresh: .chat) {
      guard let services = self.services, let threadId = self.selectedThreadId else {
        throw RelayError(.invalidInput, "Select a team chat before continuing relay.")
      }
      _ = try await services.dispatch.continueTeamRelay(threadId: threadId)
      return threadId
    }
  }

  func setSelectedTeamRelayReplyLimit(_ replyLimit: Int) {
    runAction("team-relay-limit", refresh: .chat) {
      guard let services = self.services, let threadId = self.selectedThreadId else {
        throw RelayError(.invalidInput, "Select a team chat before changing the relay limit.")
      }
      _ = try await services.dispatch.setTeamRelayReplyLimit(
        threadId: threadId, replyLimit: replyLimit)
      return threadId
    }
  }

  func connectExistingHarness(_ record: HarnessInstallRecord) {
    let panel = NSOpenPanel()
    panel.allowsMultipleSelection = false
    panel.canChooseDirectories = true
    panel.canChooseFiles = record.harnessKey == .openclaw
    panel.canCreateDirectories = false
    panel.prompt = "Connect"
    panel.message =
      record.harnessKey == .hermes
      ? "Choose the Hermes Agent folder that contains run_agent.py."
      : "Choose the OpenClaw folder that contains openclaw.mjs, or the openclaw command."
    panel.begin { response in
      guard response == .OK, let url = panel.url else { return }
      let bookmark = try? url.bookmarkData(
        options: [.withSecurityScope],
        includingResourceValuesForKeys: nil,
        relativeTo: nil
      ).base64EncodedString()
      Task { @MainActor in
        self.runAction("connect-existing-\(record.harnessKey.rawValue)", refresh: .full) {
          guard let services = self.services else { return nil }
          let accessed = url.startAccessingSecurityScopedResource()
          defer { if accessed { url.stopAccessingSecurityScopedResource() } }
          _ = try await services.harnessInstall.connectExisting(
            harnessKey: record.harnessKey,
            location: url,
            securityScopedBookmark: bookmark
          )
          return nil
        }
      }
    }
  }

  func discoverExistingHarnesses(force: Bool = false) async {
    guard force || (!runtimeDiscoveryInProgress && !runtimeDiscoveryCompleted) else { return }
    runtimeDiscoveryInProgress = true
    runtimeDiscoveryCompleted = false
    let candidates = await RuntimeInstallationDiscovery.discover()
    guard !Task.isCancelled else {
      runtimeDiscoveryInProgress = false
      return
    }
    runtimeDiscoveryCandidates = candidates
    runtimeDiscoveryInProgress = false
    runtimeDiscoveryCompleted = true
  }

  func connectDiscoveredHarness(_ candidate: RuntimeDiscoveryCandidate) {
    let key = candidate.harnessKey
    guard !runtimeConnectionsInProgress.contains(key) else { return }
    let label = "connect-discovered-\(key.rawValue)"
    let startedAt = Date()
    runtimeConnectionsInProgress.insert(key)
    runtimeConnectionMessages[key] = "Checking the \(candidate.runtimeName) installation…"
    error = nil
    settingsFeatureStore.begin(label)
    telemetry.actionStarted(label)
    Task {
      do {
        guard let services = self.services else {
          throw RelayError(.internalError, "Relay services are unavailable.")
        }
        let result = try await services.harnessInstall.connectExisting(
          harnessKey: key,
          location: candidate.location
        )
        runtimeConnectionMessages[key] = discoveredHarnessConnectionMessage(
          result,
          runtimeName: candidate.runtimeName
        )
        settingsFeatureStore.finish()
        runtimeConnectionsInProgress.remove(key)
        await refresh()
        telemetry.actionSucceeded(label, elapsed: Date().timeIntervalSince(startedAt))
      } catch {
        let message = "Relay could not connect \(candidate.runtimeName): \(error.localizedDescription)"
        runtimeConnectionMessages[key] = message
        self.error = message
        settingsFeatureStore.fail(message)
        runtimeConnectionsInProgress.remove(key)
        telemetry.actionFailed(
          label,
          elapsed: Date().timeIntervalSince(startedAt),
          error: error
        )
      }
    }
  }

  func recheckDiscoveredHarness(
    _ record: HarnessInstallRecord,
    candidate: RuntimeDiscoveryCandidate
  ) {
    let key = candidate.harnessKey
    guard !runtimeConnectionsInProgress.contains(key) else { return }
    let label = "check-discovered-\(key.rawValue)"
    let startedAt = Date()
    runtimeConnectionsInProgress.insert(key)
    runtimeConnectionMessages[key] = "Checking \(candidate.runtimeName) and its gateway…"
    error = nil
    settingsFeatureStore.begin(label)
    telemetry.actionStarted(label)
    Task {
      do {
        guard let services = self.services else {
          throw RelayError(.internalError, "Relay services are unavailable.")
        }
        let result = try await services.harnessInstall.check(harnessKey: record.harnessKey)
        runtimeConnectionMessages[key] = discoveredHarnessConnectionMessage(
          result,
          runtimeName: candidate.runtimeName
        )
        settingsFeatureStore.finish()
        runtimeConnectionsInProgress.remove(key)
        await refresh()
        telemetry.actionSucceeded(label, elapsed: Date().timeIntervalSince(startedAt))
      } catch {
        let message = "Relay could not re-check \(candidate.runtimeName): \(error.localizedDescription)"
        runtimeConnectionMessages[key] = message
        self.error = message
        settingsFeatureStore.fail(message)
        runtimeConnectionsInProgress.remove(key)
        telemetry.actionFailed(
          label,
          elapsed: Date().timeIntervalSince(startedAt),
          error: error
        )
      }
    }
  }

  private func discoveredHarnessConnectionMessage(
    _ result: HarnessActionResult,
    runtimeName: String
  ) -> String {
    if result.health?.status == .healthy || result.record.lifecycleState == .connected {
      return "\(runtimeName) is connected and ready."
    }
    if result.record.harnessKey == .openclaw,
      let detail = result.health?.message ?? result.record.lastError,
      detail.localizedCaseInsensitiveContains("gateway")
    {
      return "Relay found and saved this OpenClaw installation. Its gateway service still needs to be installed and started."
    }
    return result.health?.message
      ?? result.record.lastError
      ?? "Relay saved the \(runtimeName) installation, but it is not ready yet."
  }

  func recheckHarness(_ record: HarnessInstallRecord) {
    runAction("check-\(record.harnessKey.rawValue)", refresh: .agents) {
      guard let services = self.services else { return nil }
      _ = try await services.harnessInstall.check(harnessKey: record.harnessKey)
      return nil
    }
  }

  func removeLegacyManagedHarness(_ record: HarnessInstallRecord) {
    runAction("remove-legacy-managed-\(record.harnessKey.rawValue)", refresh: .agents) {
      guard let services = self.services else { return nil }
      _ = try services.harnessInstall.removeLegacyManagedRuntime(harnessKey: record.harnessKey)
      return nil
    }
  }

  func beginNewChat() {
    selectNav(.chat)
    isStartingChat = true
    if newChatSelectedAgentId.isEmpty {
      newChatSelectedAgentId = visibleAgents.first?.id ?? ""
    }
    if newChatTeamDepartmentId.isEmpty {
      newChatTeamDepartmentId = orgDepartments.first?.id ?? ""
    }
  }

  func toggleNewChatPanel() {
    if isStartingChat {
      closeNewChatPanel()
    } else {
      beginNewChat()
    }
  }

  func closeNewChatPanel() {
    isStartingChat = false
    newChatSearch = ""
  }

  func selectNewChatKind(_ kind: NewChatKind) {
    newChatKind = kind
    newChatSearch = ""
    if kind == .direct, newChatSelectedAgentId.isEmpty {
      newChatSelectedAgentId = visibleAgents.first?.id ?? ""
    }
    if kind == .team, newChatTeamDepartmentId.isEmpty {
      newChatTeamDepartmentId = orgDepartments.first?.id ?? ""
    }
  }

  func setNewChatTeamDepartment(_ departmentId: String) {
    newChatTeamDepartmentId = departmentId
  }

  func selectNewChatDirectAgent(_ agent: AgentWithBinding) {
    newChatSelectedAgentId = agent.id
  }

  func toggleNewChatTeamAgent(_ agent: AgentWithBinding) {
    if newChatTeamAgentIds.contains(agent.id) {
      newChatTeamAgentIds.remove(agent.id)
    } else {
      newChatTeamAgentIds.insert(agent.id)
    }
  }

  func selectNewChatTeamAgents(_ agentIds: [String]) {
    newChatTeamAgentIds = Set(agentIds)
  }

  func clearNewChatTeamAgents() {
    newChatTeamAgentIds = []
  }

  func createSelectedDirectChat() {
    runAction("create-direct-chat", refresh: .chat) {
      guard let agent = self.agents.first(where: { $0.id == self.newChatSelectedAgentId }) else {
        throw RelayError(.invalidInput, "Select an agent before creating a direct chat.")
      }
      return try await self.openDirectChat(for: agent)
    }
  }

  func createSelectedTeamChat() {
    let departmentId = newChatTeamDepartmentId
    let title = newChatTeamName
    let agentIds = newChatTeamAgentIds
    runAction("create-team-chat", refresh: .chat) {
      try await self.openTeamChat(departmentId: departmentId, title: title, agentIds: agentIds)
    }
  }

  func openDirectChat(for agent: AgentWithBinding) async throws -> String {
    guard let services, let workspace else {
      throw RelayError(.workspaceMissing, "Workspace unavailable.")
    }
    let display = resolveAgentDisplayName(agent)
    let thread = try services.chat.createOrReuseDirectThread(
      context: chatContext(workspaceId: workspace.id),
      selectedAgentId: agent.id,
      title: display
    )
    selectedThreadId = thread.id
    selectedAgentId = agent.id
    selectNav(.chat)
    resetNewChatDraft(closePanel: true)
    return thread.id
  }

  func startDirectChat(_ agent: AgentWithBinding) {
    runAction("start-direct-chat", refresh: .chat) {
      try await self.openDirectChat(for: agent)
    }
  }

  func openTeamChat(departmentId: String, title: String, agentIds: Set<String>) async throws
    -> String
  {
    guard let services, let workspace else {
      throw RelayError(.workspaceMissing, "Workspace unavailable.")
    }
    let orderedAgentIds = agents.filter { agentIds.contains($0.id) }.map(\.id)
    let thread = try services.chat.createTeamThread(
      context: chatContext(workspaceId: workspace.id),
      departmentId: departmentId,
      title: title,
      selectedAgentIds: orderedAgentIds
    )
    selectedThreadId = thread.id
    if let selectedAgentId = thread.selectedAgentId {
      self.selectedAgentId = selectedAgentId
    }
    selectNav(.chat)
    resetNewChatDraft(closePanel: true)
    return thread.id
  }

  func resetNewChatDraft(closePanel: Bool) {
    if closePanel {
      isStartingChat = false
    }
    newChatKind = .direct
    newChatSearch = ""
    newChatSelectedAgentId = ""
    newChatTeamDepartmentId = ""
    newChatTeamName = ""
    newChatTeamAgentIds = []
  }
}
