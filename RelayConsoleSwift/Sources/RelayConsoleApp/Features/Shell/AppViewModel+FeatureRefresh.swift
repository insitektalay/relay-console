import Foundation
import RelayConsoleCore

extension AppViewModel {
  func refreshChatState(preferredThreadId: RelayId? = nil) async {
    guard let services, let workspace, !isRefreshingChat else {
      if isRefreshingChat {
        scheduleRefresh(.chat, preferredThreadId: preferredThreadId)
      }
      return
    }

    chatFeatureStore.beginRefresh()
    isRefreshingChat = true
    defer {
      isRefreshingChat = false
      chatFeatureStore.finishRefresh()
    }

    do {
      let context = chatContext(
        workspaceId: workspace.id,
        profileId: appState?.activeProfile?.id
      )
      let nextAgents = try services.data.listAgents(workspaceId: workspace.id)
        .filter { [.hermes, .openclaw].contains($0.harness.runtimeType) }
      let nextThreads = try services.chat.listThreads(context: context)
      let nextThreadAgentIdsByThreadId = try loadThreadAgentIdsByThreadId(
        services: services,
        threads: nextThreads
      )
      let nextVisibleAgents =
        showRelayCloudAgents ? nextAgents : nextAgents.filter { !isRelayCloudAgent($0) }
      let nextVisibleAgentIds = Set(nextVisibleAgents.map(\.id))
      let nextVisibleThreads = nextThreads.filter { thread in
        guard !showRelayCloudAgents else { return true }
        let agentIds =
          nextThreadAgentIdsByThreadId[thread.id]
          ?? thread.selectedAgentId.map { [$0] }
          ?? []
        return agentIds.isEmpty || agentIds.contains(where: nextVisibleAgentIds.contains)
      }
      let nextSelectedAgentId =
        nextVisibleAgents.contains(where: { $0.id == selectedAgentId })
        ? selectedAgentId
        : (nextVisibleAgents.first?.id ?? "")
      let previousSelectedThreadId = selectedThreadId
      let candidate = preferredThreadId ?? selectedThreadId
      let nextSelectedThreadId =
        candidate.flatMap { id in nextVisibleThreads.contains(where: { $0.id == id }) ? id : nil }
        ?? nextVisibleThreads.first?.id

      agents = nextAgents
      threads = nextThreads
      threadAgentIdsByThreadId = nextThreadAgentIdsByThreadId
      selectedAgentId = nextSelectedAgentId
      selectedThreadId = nextSelectedThreadId

      if nextSelectedThreadId != previousSelectedThreadId {
        selectedWrapUpReportId = nil
        resetMessageWindowSelection()
      }

      guard let nextSelectedThreadId else {
        selectedThreadDetail = nil
        selectedWrapUpReportId = nil
        resetMessageWindowSelection()
        messages = []
        dispatches = []
        composerText = ""
        composerAttachments = []
        composerUploadInProgress = false
        composerMentionAvailability = nil
        loadedComposerThreadId = nil
        loadedComposerProfileId = nil
        return
      }

      let threadDetail = try services.chat.getThread(nextSelectedThreadId, context: context)
      selectedThreadDetail = threadDetail
      if let selectedWrapUpReportId,
        !threadDetail.wrapUpReports.contains(where: { $0.id == selectedWrapUpReportId })
      {
        self.selectedWrapUpReportId = nil
      }
      let displaySessionId =
        selectedWrapUpReportId.flatMap { reportId in
          threadDetail.wrapUpReports.first { $0.id == reportId }?.sessionId
        } ?? threadDetail.activeSessionId
      try refreshMessageWindow(
        services: services,
        threadId: nextSelectedThreadId,
        sessionId: displaySessionId
      )

      let nextDispatches = try services.data.listDispatchesForThread(nextSelectedThreadId)
      dispatches = nextDispatches
      runtimeActionCapabilities = try services.runtimeActions.refreshCapabilities(
        context: context,
        dispatchId: nextDispatches.last?.id
      )

      let profileId = appState?.activeProfile?.id
      if loadedComposerThreadId != nextSelectedThreadId || loadedComposerProfileId != profileId {
        let draft = try services.chat.getComposerDraft(
          context: context,
          threadId: nextSelectedThreadId,
          profileId: profileId
        )
        composerText = draft?.content ?? ""
        loadedComposerThreadId = nextSelectedThreadId
        loadedComposerProfileId = profileId
      }
      composerAttachments = try services.chat.listComposerAttachments(
        context: context,
        threadId: nextSelectedThreadId,
        profileId: profileId
      )
      composerUploadInProgress = composerAttachments.contains { $0.status == .importing }
      composerMentionAvailability = try services.chat.mentionAvailability(
        context: context,
        threadId: nextSelectedThreadId
      )
      error = nil
    } catch {
      let message = error.localizedDescription
      chatFeatureStore.fail(message)
      self.error = message
    }
  }

  func refreshAgentsState() async {
    guard let services, let workspace, !isRefreshingAgents else {
      if isRefreshingAgents { scheduleRefresh(.agents) }
      return
    }

    agentFeatureStore.beginRefresh()
    isRefreshingAgents = true
    defer {
      isRefreshingAgents = false
      agentFeatureStore.finishRefresh()
    }

    do {
      let context = chatContext(
        workspaceId: workspace.id,
        profileId: appState?.activeProfile?.id
      )
      let nextAgents = try services.data.listAgents(workspaceId: workspace.id)
        .filter { [.hermes, .openclaw].contains($0.harness.runtimeType) }
      let nextVisibleAgents =
        showRelayCloudAgents ? nextAgents : nextAgents.filter { !isRelayCloudAgent($0) }
      let nextSelectedAgentId =
        nextVisibleAgents.contains(where: { $0.id == selectedAgentId })
        ? selectedAgentId
        : (nextVisibleAgents.first?.id ?? "")
      let nextPreferences = try services.data.listAgentPreferences(workspaceId: workspace.id)
      let nextProvisioningJobs = try services.data.listAgentProvisioningJobs(
        workspaceId: workspace.id
      )
      let nextCompanies = try services.data.listAgentOrgCompanies(workspaceId: workspace.id)
      let nextDepartments = try services.data.listAgentOrgDepartments(workspaceId: workspace.id)
      let nextTeams = try services.data.listAgentOrgTeams(workspaceId: workspace.id)
      let nextOrgCounts = try services.organization.dashboardCounts(context: context)
      let nextStructureDashboard = try services.work.structureDashboard(context: context)
      let nextTeamMemory = try services.work.allTeamMemory(context: context)
      let nextTeamHandovers = try services.work.allTeamHandovers(context: context)
      let nextAgentOpsSnapshot = try services.agentOps.liveStateSnapshot(
        context: context,
        selectedAgentIds: agentOpsSelectedIds
      )
      var nextAgentOpsSceneSnapshot = services.agentOps.visualSceneSnapshot(
        from: nextAgentOpsSnapshot,
        selectedEntityId: selectedAgentOpsSceneEntityId.isEmpty
          ? selectedAgentOpsAgentId : selectedAgentOpsSceneEntityId
      )
      loadAgentOpsLayoutDraftIfNeeded(workspaceId: workspace.id)
      nextAgentOpsSceneSnapshot = applyAgentOpsLayoutDraft(to: nextAgentOpsSceneSnapshot)
      let nextRuntimeDashboardSnapshot = try services.runtimeDashboard.latestSnapshot(
        context: context
      )
      let nextRuntimeActionCapabilities = try services.runtimeActions.refreshCapabilities(
        context: context
      )
      let nextRuntimeActionRuns = try services.runtimeActions.listRuns(context: context)
      let nextRuntimeStructuredJobs = try services.runtimeRecovery.structuredJobs(context: context)
      let nextRuntimeMissingTools = try services.runtimeRecovery.missingTools(context: context)
      let nextRuntimeRecoveryRecords = try services.runtimeRecovery.recoveryRecords(context: context)
      let nextCalendarGroup = resolvedCalendarGroup(
        agents: nextAgents,
        selectedAgentId: nextSelectedAgentId
      )
      let nextAgentTasks = try services.work.tasksForWorkspace(context: context)
      let nextSelectedTaskId =
        nextAgentTasks.contains(where: { $0.id == selectedAgentTaskId })
        ? selectedAgentTaskId
        : (nextAgentTasks.first?.id ?? "")
      let nextTaskRuns =
        nextSelectedTaskId.isEmpty
        ? []
        : try services.work.taskRuns(context: context, taskId: nextSelectedTaskId)
      let nextWorkCalendar = try services.work.workCalendar(
        context: context,
        groupType: nextCalendarGroup.groupType,
        dayCount: 30,
        now: Date()
      )

      agents = nextAgents
      selectedAgentId = nextSelectedAgentId
      agentPreferences = Dictionary(uniqueKeysWithValues: nextPreferences.map { ($0.agentId, $0) })
      provisioningJobs = nextProvisioningJobs
      orgCompanies = nextCompanies
      orgDepartments = nextDepartments
      orgTeams = nextTeams
      orgDashboardCounts = nextOrgCounts
      agentStructureDashboard = nextStructureDashboard
      teamMemoryEntries = nextTeamMemory
      teamHandovers = nextTeamHandovers
      agentOpsSnapshot = nextAgentOpsSnapshot
      agentOpsSceneSnapshot = nextAgentOpsSceneSnapshot
      runtimeDashboardSnapshot = nextRuntimeDashboardSnapshot
      runtimeActionCapabilities = nextRuntimeActionCapabilities
      runtimeActionRuns = nextRuntimeActionRuns
      runtimeStructuredJobs = nextRuntimeStructuredJobs
      runtimeMissingTools = nextRuntimeMissingTools
      runtimeRecoveryRecords = nextRuntimeRecoveryRecords
      selectedAgentOpsSceneEntityId = nextAgentOpsSceneSnapshot.selectedEntityId ?? ""
      selectedAgentOpsAgentId =
        nextAgentOpsSceneSnapshot.entities.first { $0.id == selectedAgentOpsSceneEntityId }?.agentId
        ?? (nextAgentOpsSnapshot.agents.contains(where: { $0.agentId == selectedAgentOpsAgentId })
          ? selectedAgentOpsAgentId : (nextAgentOpsSnapshot.agents.first?.agentId ?? ""))
      agentTasks = nextAgentTasks
      selectedAgentTaskId = nextSelectedTaskId
      agentTaskRuns = nextTaskRuns
      selectedCalendarGroup = nextCalendarGroup
      persistCalendarPreferences()
      agentWorkCalendar = nextWorkCalendar
      error = nil
      await refreshChatState(preferredThreadId: selectedThreadId)
    } catch {
      let message = error.localizedDescription
      agentFeatureStore.fail(message)
      self.error = message
    }
  }

  func refreshApprovalsState() async {
    guard let services, let workspace, !isRefreshingApprovals else {
      if isRefreshingApprovals { scheduleRefresh(.approvals) }
      return
    }

    approvalsFeatureStore.beginRefresh()
    isRefreshingApprovals = true
    defer {
      isRefreshingApprovals = false
      approvalsFeatureStore.finishRefresh()
    }

    let context = chatContext(
      workspaceId: workspace.id,
      profileId: appState?.activeProfile?.id
    )
    let nextProviderApproval = await loadProviderApprovalInbox(
      services: services,
      context: context
    )
    providerApprovalInbox = nextProviderApproval.inbox
    selectedProviderApprovalId = nextProviderApproval.selectedApprovalId
  }

  func refreshInsightsState() async {
    guard let services, let workspace, !isRefreshingInsights else {
      if isRefreshingInsights { scheduleRefresh(.insights) }
      return
    }

    insightsFeatureStore.beginRefresh()
    isRefreshingInsights = true
    defer {
      isRefreshingInsights = false
      insightsFeatureStore.finishRefresh()
    }

    do {
      let context = chatContext(
        workspaceId: workspace.id,
        profileId: appState?.activeProfile?.id
      )
      let nextList = try services.insights.reportList(
        context: context,
        searchQuery: insightsSearch,
        sourceFilter: insightsSourceFilter,
        sort: insightsSort,
        includeArchived: insightsIncludeArchived,
        selectedReportId: insightsSelectedReportId.nilIfEmpty
      )
      let nextSelectedId = nextList.selectedReportId ?? ""
      let nextDetail =
        nextSelectedId.isEmpty
        ? nil
        : try services.insights.reportDetail(context: context, reportId: nextSelectedId)
      let nextAnalytics = try services.insights.analytics(
        context: context,
        threadId: nextDetail?.row.threadId,
        activityGapMinutes: insightsActivityGapMinutes
      )
      insightsReportList = nextList
      insightsSelectedReportId = nextSelectedId
      insightsReportDetail = nextDetail
      insightsAnalytics = nextAnalytics
      error = nil
    } catch {
      let message = error.localizedDescription
      insightsFeatureStore.fail(message)
      self.error = message
    }
  }

  func refreshSettingsState() async {
    guard let services, !isRefreshingSettings else {
      if isRefreshingSettings { scheduleRefresh(.settings) }
      return
    }

    settingsFeatureStore.beginRefresh()
    isRefreshingSettings = true
    defer {
      isRefreshingSettings = false
      settingsFeatureStore.finishRefresh()
    }

    do {
      let nextState = try services.data.getAppState()
      guard nextState.activeWorkspace?.id == appState?.activeWorkspace?.id else {
        scheduleRefresh(.full)
        return
      }
      let previousProfile = appState?.activeProfile
      appState = nextState
      if let profile = nextState.activeProfile {
        syncUserProfileDraft(from: profile, previousProfile: previousProfile)
        telemetry.applyConsent(
          .init(
            productAnalytics: profile.telemetryEnabled,
            crashReporting: profile.crashReportingEnabled
          ),
          profileId: profile.id
        )
      }
      guard let workspace = nextState.activeWorkspace else {
        settingsIntegrationSummary = nil
        settingsNotificationPreferences = nil
        settingsSecuritySummary = nil
        settingsAlerts = []
        settingsUnreadAlertCount = 0
        return
      }

      workspaceSettingsDraft = WorkspaceSettingsDraft(workspace: workspace)
      let context = chatContext(
        workspaceId: workspace.id,
        profileId: nextState.activeProfile?.id
      )
      settingsIntegrationSummary = try services.settingsStatus.integrationSummary(context: context)
      settingsNotificationPreferences = try services.settingsStatus.notificationPreferences(
        context: context,
        profileId: nextState.activeProfile?.id
      )
      settingsAlerts = try services.settingsStatus.alerts(
        context: context,
        unreadOnly: settingsAlertsUnreadOnly
      )
      settingsUnreadAlertCount = try services.settingsStatus.unreadAlertCount(context: context)
      settingsSecuritySummary = try services.settingsSecurity.securitySummary(
        context: context,
        profileId: nextState.activeProfile?.id
      )
      error = nil
    } catch {
      let message = error.localizedDescription
      settingsFeatureStore.fail(message)
      self.error = message
    }
  }
}
