import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func configureWindow() {
    if let window = NSApplication.shared.windows.first {
      configureWindowChrome(window)
      let minimumContentSize = NSSize(width: 980, height: 640)
      let preferredContentSize = NSSize(width: 1700, height: 1180)
      let screenMargin: CGFloat = 24

      window.minSize = minimumContentSize

      if let screen = window.screen ?? NSScreen.main {
        let visibleFrame = screen.visibleFrame
        let contentSize = NSSize(
          width: min(
            preferredContentSize.width,
            max(minimumContentSize.width, visibleFrame.width - screenMargin * 2)),
          height: min(
            preferredContentSize.height,
            max(minimumContentSize.height, visibleFrame.height - screenMargin * 2))
        )
        let contentRect = NSRect(origin: .zero, size: contentSize)
        var frame = window.frameRect(forContentRect: contentRect)
        frame.origin.x = visibleFrame.minX + screenMargin
        frame.origin.y = max(
          visibleFrame.minY + screenMargin, visibleFrame.maxY - frame.height - screenMargin)
        window.setFrame(frame, display: true)
      } else {
        window.setContentSize(preferredContentSize)
      }

      RelayConsoleWindowPresenter.present(window)
    }
  }

  func configureWindowChrome(_ window: NSWindow?) {
    guard let window else { return }
    window.title = "Relay Console"
    window.titleVisibility = .hidden
    window.titlebarAppearsTransparent = true
    window.styleMask.insert(.fullSizeContentView)
    window.toolbar = nil
    window.backgroundColor = .clear
    window.isOpaque = false
    window.isMovableByWindowBackground = true
    window.collectionBehavior.insert(.fullScreenPrimary)
    if #available(macOS 11.0, *) {
      window.titlebarSeparatorStyle = .none
    }
    makeTitlebarChromeTransparent(window)
  }

  func makeTitlebarChromeTransparent(_ window: NSWindow) {
    guard let frameView = window.contentView?.superview else { return }
    for subview in frameView.subviews {
      makeTitlebarSubviewTransparent(subview)
    }
  }

  func makeTitlebarSubviewTransparent(_ view: NSView) {
    let className = String(describing: type(of: view))
    let isTitlebarChrome = className.contains("Titlebar") || className.contains("Toolbar")
    if isTitlebarChrome {
      view.wantsLayer = true
      view.layer?.backgroundColor = NSColor.clear.cgColor
      if let visualEffectView = view as? NSVisualEffectView {
        visualEffectView.material = .windowBackground
        visualEffectView.blendingMode = .behindWindow
        visualEffectView.state = .inactive
      }
    }
    for subview in view.subviews {
      makeTitlebarSubviewTransparent(subview)
    }
  }

  func registerEvents() {
    guard let services else { return }
    services.eventBus.on(.harnessInstallProgress) { [weak self] payload in
      guard let event = payload as? HarnessInstallProgressEvent else { return }
      Task { @MainActor in
        self?.installProgress[event.harnessKey] = event
        self?.scheduleRefresh(.agents)
        self?.scheduleRefresh(.chat)
      }
    }
    for event in [
      RelayEventName.messageCreated,
      .threadUpdated,
      .chatMessageNew,
      .chatThreadUpdate,
      .chatReadStateUpdate,
      .chatThreadArchived,
      .chatWrapUpUpdate,
      .dispatchUpdated,
    ] {
      services.eventBus.on(event) { [weak self] _ in
        Task { @MainActor in self?.scheduleRefresh(.chat) }
      }
    }
    for event in [
      RelayEventName.runtimeEvent,
      .runtimeMissingToolUpdated,
      .runtimeRecoveryUpdated,
      .harnessHealthChanged,
      .agentProvisioningUpdated,
      .agentOrganizationUpdated,
      .agentWorkUpdated,
    ] {
      services.eventBus.on(event) { [weak self] _ in
        Task { @MainActor in
          self?.scheduleRefresh(.agents)
          self?.scheduleRefresh(.chat)
        }
      }
    }
    services.eventBus.on(.insightsReportsUpdated) { [weak self] _ in
      Task { @MainActor in self?.scheduleRefresh(.insights) }
    }
    services.eventBus.on(.settingsProfileUpdated) { [weak self] _ in
      Task { @MainActor in
        self?.scheduleRefresh(.settings)
        self?.scheduleRefresh(.chat)
      }
    }
    services.eventBus.on(.settingsWorkspaceUpdated) { [weak self] _ in
      Task { @MainActor in
        self?.scheduleRefresh(.settings)
        self?.scheduleRefresh(.agents)
        self?.scheduleRefresh(.chat)
      }
    }
    for event in [
      RelayEventName.settingsAlertUpdated,
      .settingsNotificationPreferencesUpdated,
      .settingsIntegrationSummaryUpdated,
      .settingsSecurityUpdated,
      .settingsLocalExportPrepared,
      .settingsSaveFailed,
    ] {
      services.eventBus.on(event) { [weak self] _ in
        Task { @MainActor in self?.scheduleRefresh(.settings) }
      }
    }
    services.eventBus.on(.appStateChanged) { [weak self] payload in
      Task { @MainActor in
        guard let self else { return }
        if let state = payload as? AppState,
          state.activeWorkspace?.id != self.workspace?.id
        {
          self.scheduleRefresh(.full)
          return
        }
        self.scheduleRefresh(.settings)
        self.scheduleRefresh(.agents)
        self.scheduleRefresh(.chat)
        if payload is JSONRecord {
          self.scheduleRefresh(.applications)
          self.scheduleRefresh(.approvals)
          self.scheduleRefresh(.insights)
          self.scheduleRefresh(.operationalOutputs)
        }
      }
    }
    for event in [
      RelayEventName.applicationsCatalogUpdated,
      .applicationsProviderConnectionUpdated,
      .applicationsMarketplaceInstallUpdated,
      .applicationsNeededToolsUpdated,
      .applicationsProviderActionUpdated,
    ] {
      services.eventBus.on(event) { [weak self] _ in
        Task { @MainActor in self?.scheduleApplicationsRefresh() }
      }
    }
  }

  func scheduleRefresh(
    _ scope: AppViewModelActionRefresh = .full,
    preferredThreadId: String? = nil
  ) {
    guard scope != .applications else {
      scheduleApplicationsRefresh()
      return
    }
    scheduledFeatureRefreshTasks[scope]?.cancel()
    scheduledFeatureRefreshTasks[scope] = Task { [weak self] in
      try? await Task.sleep(nanoseconds: 250_000_000)
      guard !Task.isCancelled else { return }
      guard let self else { return }
      switch scope {
      case .full:
        await self.refresh(preferredThreadId: preferredThreadId)
      case .chat:
        await self.refreshChatState(preferredThreadId: preferredThreadId)
      case .agents:
        await self.refreshAgentsState()
      case .operationalOutputs:
        await self.refreshOperationalOutputs()
      case .applications:
        await self.refreshApplicationsState()
      case .approvals:
        await self.refreshApprovalsState()
      case .insights:
        await self.refreshInsightsState()
      case .settings:
        await self.refreshSettingsState()
      case .none:
        break
      }
    }
  }

  func scheduleApplicationsRefresh(selectedConnectionId: RelayId? = nil) {
    scheduledApplicationsRefreshTask?.cancel()
    scheduledApplicationsRefreshTask = Task { [weak self] in
      try? await Task.sleep(nanoseconds: 150_000_000)
      guard !Task.isCancelled else { return }
      await self?.refreshApplicationsState(selectedConnectionId: selectedConnectionId)
    }
  }

  func refreshOperationalOutputs() async {
    guard let services, let workspace else { return }
    guard !isRefreshingOperationalOutputs else {
      scheduleRefresh(.operationalOutputs)
      return
    }
    let workspaceId = workspace.id
    isRefreshingOperationalOutputs = true
    defer { isRefreshingOperationalOutputs = false }

    do {
      try services.artifacts.reconcileCronArtifactDirectories(agents: agents)
      let includeUnownedLocalArtifacts =
        workspace.settings["accountIsolatedLocalData"] != .bool(true)
          && !agents.isEmpty
      var nextArtifacts = try services.artifacts.artifactsSnapshot(
        agents: agents,
        selectedArtifactId: selectedArtifactId.nilIfEmpty,
        includeUnownedLocalArtifacts: includeUnownedLocalArtifacts
      )
      let localArtifactCatalogueWasEmpty = nextArtifacts.artifacts.isEmpty
      if !nextArtifacts.artifacts.isEmpty {
        do {
          try await services.cloudSync.synchronizeArtifacts(
            localWorkspaceId: workspaceId,
            artifacts: nextArtifacts.artifacts
          )
          artifactCatalogueSyncError = nil
        } catch {
          artifactCatalogueSyncError = error.localizedDescription
        }
      }
      do {
        nextArtifacts.artifacts = try await services.cloudSync.remoteArtifactCatalogue(
          localWorkspaceId: workspaceId,
          localArtifacts: nextArtifacts.artifacts
        )
        if localArtifactCatalogueWasEmpty {
          artifactCatalogueSyncError = nil
        }
      } catch {
        if artifactCatalogueSyncError == nil {
          artifactCatalogueSyncError = error.localizedDescription
        }
      }
      nextArtifacts.artifacts.sort { lhs, rhs in
        if lhs.updatedAt != rhs.updatedAt {
          return (lhs.updatedAt ?? "") > (rhs.updatedAt ?? "")
        }
        return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
      }
      if let selected = nextArtifacts.selectedArtifactId,
        !nextArtifacts.artifacts.contains(where: { $0.id == selected })
      {
        nextArtifacts.selectedArtifactId = nextArtifacts.artifacts.first?.id
      }

      var nextCronJobs = try services.artifacts.cronJobsSnapshot(
        agents: agents,
        selectedJobId: selectedCronJobId.nilIfEmpty,
        includeUnownedLocalArtifacts: includeUnownedLocalArtifacts
      )
      for agent in agents where agent.binding.runtimeType == .openclaw {
        guard let native = try? await services.harnessInstall.nativeCronJobs(for: agent),
          let jobs = native["jobs"] as? [[String: Any]]
        else { continue }
        nextCronJobs.jobs.append(
          contentsOf: services.artifacts.openClawCronJobRecords(agent: agent, jobs: jobs)
        )
      }
      nextCronJobs.jobs.sort { lhs, rhs in
        if lhs.enabled != rhs.enabled { return lhs.enabled && !rhs.enabled }
        return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
      }

      artifactsSnapshot = nextArtifacts
      artifacts = nextArtifacts.artifacts
      selectedArtifactId = nextArtifacts.selectedArtifactId ?? ""
      cronJobsSnapshot = nextCronJobs
      cronJobs = nextCronJobs.jobs
      if agentPanelMode == .detail, agentSubview == .cronJobs {
        selectedCronJobId =
          nextCronJobs.jobs.contains { $0.id == selectedCronJobId } ? selectedCronJobId : ""
      } else {
        selectedCronJobId = nextCronJobs.selectedJobId ?? ""
      }
    } catch {
      _ = try? services.data.log(
        severity: "warn",
        category: "operational_outputs",
        message: "Artifact and cron refresh failed.",
        detail: ["error": .string(error.localizedDescription)]
      )
    }
  }

  func startAutomaticCloudLinkRecovery() {
    guard automaticCloudLinkTask == nil,
      let services,
      ((try? services.cloudConnections.listAccounts().isEmpty) == false)
    else { return }
    automaticCloudLinkTask = Task { [weak self] in
      var idleChecksUntilPull = 0
      while !Task.isCancelled {
        guard let self else { return }
        guard (try? services.cloudConnections.listAccounts().isEmpty) == false else { return }
        let localWorkspaceId = self.workspace?.id
        let link = try? services.cloudSync.listLinks().first {
          $0.localWorkspaceId == localWorkspaceId
            && ![CloudSyncLinkState.unlinked, .revoked].contains($0.state)
        }
        let status = link.flatMap { try? services.cloudSync.status(syncLinkId: $0.id) }
        let needsImmediateSync =
          link == nil
          || (link?.state != .linked && link?.state != .paused)
          || (status?.pendingMutationCount ?? 0) > 0
        let shouldPull = link?.state != .paused && idleChecksUntilPull <= 0
        var delay: UInt64 = 5_000_000_000
        if needsImmediateSync || shouldPull {
          let succeeded = await self.ensureAutomaticCloudLinkIfPossible()
          idleChecksUntilPull = succeeded ? 12 : 0
          if !succeeded { delay = 15_000_000_000 }
        } else {
          idleChecksUntilPull -= 1
        }
        try? await Task.sleep(nanoseconds: delay)
      }
    }
  }

  /// Keeps the launch surface stable while a signed-in account is checked
  /// against Relay. Cached or transitional entitlement state must never route
  /// through recovery before this first online attempt has completed.
  func resolveRelayAccessBeforePresentingGate() async {
    defer { relayLaunchAccessCheckInProgress = false }
    guard hasSignedInRelayAccount,
      !relayEntitlementAccess.allowsOrdinaryUse
    else { return }
    await retryRelayEntitlementVerification()
  }

  /// Repairs the historical signed-in-but-unlinked state. Failure is deliberately
  /// quiet here: Railway can be temporarily unavailable and local use must remain
  /// intact while this bounded background retry continues.
  func ensureAutomaticCloudLinkIfPossible() async -> Bool {
    guard let services,
      let localWorkspaceId = workspace?.id,
      let account = try? services.cloudConnections.listAccounts().first,
      let deployment = try? services.cloudConnections.listDeployments().first(where: {
        $0.id == account.deploymentId || $0.active
      }),
      let apiURL = URL(string: deployment.apiBaseURL)
    else { return true }

    let existingLink = try? services.cloudSync.listLinks().first {
      $0.localWorkspaceId == localWorkspaceId
        && ![CloudSyncLinkState.unlinked, .revoked].contains($0.state)
    }
    if existingLink == nil,
      (try? services.data.listAgents(workspaceId: localWorkspaceId).isEmpty) == true
    {
      _ = try? services.data.markWorkspaceAsAccountIsolated(localWorkspaceId)
    }

    do {
      let transport = try URLSessionRelayCloudTransport(apiBaseURL: apiURL)
      let rawManifest = try await transport.send(
        method: "GET",
        path: "deployment/manifest",
        body: nil,
        accessToken: nil
      )
      let manifest = try JSONDecoder().decode(
        CloudDeploymentManifest.self,
        from: JSONSerialization.data(withJSONObject: rawManifest)
      )
      _ = try services.cloudConnections.saveDeployment(manifest: manifest)
      let token = try await services.cloudConnections.validAccessToken(
        accountId: account.id,
        transport: transport
      )
      let response = try await transport.send(
        method: "GET",
        path: "workspaces",
        body: nil,
        accessToken: token
      )
      let workspaces =
        (response["data"] as? [[String: Any]])
        ?? (response["workspaces"] as? [[String: Any]])
        ?? []
      let cachedWorkspaceId = try services.entitlement.currentAccess().workspaceId
      let remoteWorkspaceId =
        cachedWorkspaceId.flatMap { candidate in
          workspaces.contains { ($0["id"] as? String) == candidate } ? candidate : nil
        }
        ?? (workspaces.first?["id"] as? String ?? "")
      guard !remoteWorkspaceId.isEmpty else {
        throw RelayError(.notFound, "This Relay account has no workspace available for synchronization.")
      }

      _ = try await services.entitlement.refreshOnlineAccess(
        accountId: account.id,
        workspaceId: remoteWorkspaceId,
        transport: transport,
        manifest: manifest
      )
      let linked = try await services.cloudSync.ensureAutomaticWorkspaceLink(
        localWorkspaceId: localWorkspaceId,
        accountId: account.id,
        remoteWorkspaceId: remoteWorkspaceId,
        manifest: manifest,
        transport: transport
      )
      if automaticRuntimeBridge == nil,
        let websocketURL = URL(string: manifest.origins.websocket)
      {
        let bridge = services.cloudRuntimeDeviceTransport(using: transport)
        try await bridge.ensureConnected(
          syncLinkId: linked.id,
          workspaceId: remoteWorkspaceId,
          userAccessToken: token,
          websocketBaseURL: websocketURL,
          deviceLabel: Host.current().localizedName ?? "Mac"
        )
        automaticRuntimeBridge = bridge
      }
      if existingLink?.state != .linked {
        await refresh()
      }
      return true
    } catch {
      _ = try? services.data.log(
        severity: "info",
        category: "relay_cloud",
        message: "Automatic workspace connection will retry.",
        detail: ["error": .string(error.localizedDescription)]
      )
      if (try? services.cloudConnections.listAccounts().isEmpty) == true {
        await refresh()
        return true
      }
      return false
    }
  }

  func resolvedCalendarGroup(agents: [AgentWithBinding], selectedAgentId: String)
    -> AgentWorkCalendarGroupFilter
  {
    guard agentSubview == .workCalendar,
      !calendarGroupUserSelected,
      selectedCalendarGroup != .all,
      let selected = agents.first(where: { $0.id == selectedAgentId })
    else { return selectedCalendarGroup }

    let currentGroupHasAgents = agents.contains { agent in
      agent.status == "active"
        && selectedCalendarGroup.groupType.map { effectiveCalendarGroup(for: agent) == $0 } ?? true
    }
    return currentGroupHasAgents
      ? selectedCalendarGroup
      : AgentWorkCalendarGroupFilter(groupType: effectiveCalendarGroup(for: selected))
  }

  func effectiveCalendarGroup(for agent: AgentWithBinding) -> AgentGroupType {
    switch agent.groupType {
    case .business:
      return .business
    case .family:
      return .family
    case .personal:
      return .personal
    case .unassigned, nil:
      return .personal
    }
  }

  func chatContext(workspaceId: String, profileId: String? = nil) -> ServiceRequestContext {
    ServiceRequestContext(
      actorId: profileId ?? appState?.activeProfile?.id ?? "local-profile",
      workspaceId: workspaceId,
      roles: [.owner],
      correlationId: UUID().uuidString
    )
  }

  private func clearWorkspacePresentationForTransition() {
    agents = []
    threads = []
    threadAgentIdsByThreadId = [:]
    selectedThreadId = nil
    messages = []
    dispatches = []
    artifactsSnapshot = nil
    artifacts = []
    artifactCatalogueSyncError = nil
    selectedArtifactId = ""
    selectedArtifactGroupId = ""
    cronJobsSnapshot = nil
    cronJobs = []
    selectedCronJobId = ""
    applicationsCatalogSnapshot = nil
    applicationsCatalogApps = []
    applicationsSelectedAppId = ""
    providerConnectionSnapshot = nil
    providerConnectionsByAppId = [:]
    exaInstallSnapshot = nil
    marketplaceActionPermissionMapsByInstallId = [:]
  }

  func refresh(preferredThreadId: String? = nil) async {
    guard let services else { return }
    guard !isRefreshing else {
      scheduleRefresh(preferredThreadId: preferredThreadId)
      return
    }
    let featureStores = [
      chatFeatureStore,
      agentFeatureStore,
      applicationsFeatureStore,
      approvalsFeatureStore,
      insightsFeatureStore,
      settingsFeatureStore,
    ]
    featureStores.forEach { $0.beginRefresh() }
    isRefreshing = true
    defer {
      isRefreshing = false
      featureStores.forEach { $0.finishRefresh() }
    }
    do {
      try services.data.migrateLegacyUserProfilePreference(Self.readLegacyProfile()?.snapshot)
      let nextState = try services.data.getAppState()
      let activeWorkspaceId = nextState.activeWorkspace?.id
      let signedInButUnlinked =
        ((try? services.cloudConnections.listAccounts().isEmpty) == false)
        && activeWorkspaceId.map { workspaceId in
          (try? services.cloudSync.listLinks().contains(where: {
            $0.localWorkspaceId == workspaceId
              && ![CloudSyncLinkState.unlinked, .revoked].contains($0.state)
          })) != true
        } == true
      let entitlementAccess: RelayEntitlementAccess
      if signedInButUnlinked {
        entitlementAccess = RelayEntitlementAccess(
          state: .verificationRequired,
          message: "Relay is finishing this Mac's workspace connection."
        )
      } else {
        entitlementAccess = try services.entitlement.currentAccess()
      }
      relayEntitlementAccess = entitlementAccess
      let nextRecords = try services.harnessInstall.listRecords()
      let previousProfile = appState?.activeProfile
      if appState?.activeWorkspace?.id != nextState.activeWorkspace?.id {
        clearWorkspacePresentationForTransition()
      }
      appState = nextState
      records = nextRecords
      let shouldRefreshModelCatalog =
        runtimeModelCatalogLastRefreshedAt.map {
          Date().timeIntervalSince($0) >= 300
        } ?? true
      if shouldRefreshModelCatalog,
        nextRecords.contains(where: {
          $0.harnessKey == .hermes && $0.lifecycleState == .connected
        })
      {
        let catalog = await services.harnessInstall.refreshRuntimeModelCatalog(
          for: .hermes)
        runtimeModelCatalogs[.hermes] = catalog
        runtimeModelCatalogLastRefreshedAt = Date()
      }
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
      if let workspace = nextState.activeWorkspace {
        workspaceSettingsDraft = WorkspaceSettingsDraft(workspace: workspace)
        let context = chatContext(workspaceId: workspace.id, profileId: nextState.activeProfile?.id)
        let existingWorkspaceAgents = try services.data.listAgents(workspaceId: workspace.id)
          .filter { $0.harness.runtimeType == .hermes || $0.harness.runtimeType == .openclaw }
        if entitlementAccess.allowsOrdinaryUse,
          !existingWorkspaceAgents.isEmpty,
          workspace.settings["residentAgentAutoBootstrap"] != .bool(false),
          nextRecords.contains(where: {
            $0.harnessKey == .hermes
              && $0.lifecycleState == .connected
              && $0.modelAuthStatus == .connected
              && $0.harnessId != nil
          })
        {
          do {
            _ = try await services.residentAgents.ensureDefaultResidentAgent(
              workspaceId: workspace.id,
              requestedByProfileId: nextState.activeProfile?.id
            )
          } catch {
            _ = try? services.data.log(
              severity: "warning",
              category: "resident-agent",
              message: "Resident Relay Console agent bootstrap deferred.",
              detail: ["error": .string(error.localizedDescription)]
            )
          }
        }
        let nextAgents = try services.data.listAgents(workspaceId: workspace.id)
          .filter { $0.harness.runtimeType == .hermes || $0.harness.runtimeType == .openclaw }
        let nextThreads = try services.chat.listThreads(context: context)
        let nextThreadAgentIdsByThreadId = try loadThreadAgentIdsByThreadId(
          services: services, threads: nextThreads)
        let nextVisibleAgents =
          showRelayCloudAgents
          ? nextAgents
          : nextAgents.filter { !isRelayCloudAgent($0) }
        let nextVisibleAgentIds = Set(nextVisibleAgents.map(\.id))
        let nextVisibleThreads = nextThreads.filter { thread in
          guard !showRelayCloudAgents else { return true }
          let agentIds =
            nextThreadAgentIdsByThreadId[thread.id]
            ?? thread.selectedAgentId.map { [$0] }
            ?? []
          guard !agentIds.isEmpty else { return true }
          return agentIds.contains(where: nextVisibleAgentIds.contains)
        }
        let nextSelectedAgentId =
          nextVisibleAgents.contains(where: { $0.id == selectedAgentId })
          ? selectedAgentId
          : (nextVisibleAgents.first?.id ?? "")
        let previousSelectedThreadId = selectedThreadId
        let candidate = preferredThreadId ?? selectedThreadId
        selectedThreadId =
          candidate.flatMap { id in nextVisibleThreads.contains(where: { $0.id == id }) ? id : nil }
          ?? nextVisibleThreads.first?.id
        if selectedThreadId != previousSelectedThreadId {
          selectedWrapUpReportId = nil
          resetMessageWindowSelection()
        }
        agents = nextAgents
        threads = nextThreads
        threadAgentIdsByThreadId = nextThreadAgentIdsByThreadId
        selectedAgentId = nextSelectedAgentId
        let nextPreferences = try services.data.listAgentPreferences(workspaceId: workspace.id)
        let nextProvisioningJobs = try services.data.listAgentProvisioningJobs(
          workspaceId: workspace.id)
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
          context: context)
        let nextRuntimeActionCapabilities = try services.runtimeActions.refreshCapabilities(
          context: context)
        let nextRuntimeActionRuns = try services.runtimeActions.listRuns(context: context)
        let nextRuntimeStructuredJobs = try services.runtimeRecovery.structuredJobs(
          context: context)
        let nextRuntimeMissingTools = try services.runtimeRecovery.missingTools(context: context)
        let nextRuntimeRecoveryRecords = try services.runtimeRecovery.recoveryRecords(
          context: context)
        let appFilter = ApplicationsCatalogFilter(
          view: .all,
          searchQuery: applicationsSearch,
          category: applicationsSelectedCategory,
          riskLevel: nil
        )
        let nextApplicationsCatalog: ApplicationsCatalogSnapshot
        if let inMemoryApplicationsCatalog = applicationsCatalogSnapshot {
          nextApplicationsCatalog = inMemoryApplicationsCatalog
        } else if let persistedApplicationsCatalog = try services.applications.latestSnapshot(
          context: context
        ) {
          nextApplicationsCatalog = persistedApplicationsCatalog
        } else {
          nextApplicationsCatalog = try await services.applications.refreshCatalogSnapshot(
            context: context,
            filter: appFilter,
            selectedAppId: applicationsSelectedAppId.isEmpty ? nil : applicationsSelectedAppId
          )
        }
        let nextApplicationsCatalogApps =
          applicationsCatalogApps.isEmpty
          ? try loadUnfilteredApplicationsCatalogApps(services: services, context: context)
          : applicationsCatalogApps
        let selectedAppSlug = nextApplicationsCatalog.selectedApp?.slug
        let selectedConnectionId: RelayId?
        if selectedAppSlug == "exa-search" {
          selectedConnectionId = exaSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "x" {
          selectedConnectionId = xSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "facebook-pages" {
          selectedConnectionId = facebookPagesSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "zoho-mail" {
          selectedConnectionId = zohoMailSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "gmail" {
          selectedConnectionId = gmailSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-docs" {
          selectedConnectionId = googleDocsSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-calendar" {
          selectedConnectionId = googleCalendarSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-drive" {
          selectedConnectionId = googleDriveSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-sheets" {
          selectedConnectionId = googleSheetsSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-slides" {
          selectedConnectionId = googleSlidesSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-forms" {
          selectedConnectionId = googleFormsSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-tasks" {
          selectedConnectionId = googleTasksSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-contacts" {
          selectedConnectionId = googleContactsSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-photos" {
          selectedConnectionId = googlePhotosSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-meet" {
          selectedConnectionId = googleMeetSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-chat" {
          selectedConnectionId = googleChatSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-ads" {
          selectedConnectionId = googleAdsSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-search-console" {
          selectedConnectionId = googleSearchConsoleSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-analytics" {
          selectedConnectionId = googleAnalyticsSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-merchant-center" {
          selectedConnectionId = googleMerchantCenterSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "youtube" {
          selectedConnectionId = youTubeSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "google-classroom" {
          selectedConnectionId = googleClassroomSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "outlook" {
          selectedConnectionId = outlookSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "microsoft-teams" {
          selectedConnectionId = microsoftTeamsSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "onedrive" {
          selectedConnectionId = oneDriveSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "sharepoint" {
          selectedConnectionId = sharePointSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "microsoft-planner" {
          selectedConnectionId = microsoftPlannerSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "microsoft-to-do" {
          selectedConnectionId = microsoftToDoSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "microsoft-lists" {
          selectedConnectionId = microsoftListsSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "onenote" {
          selectedConnectionId = oneNoteSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "microsoft-bookings" {
          selectedConnectionId = microsoftBookingsSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "microsoft-power-bi" {
          selectedConnectionId = microsoftPowerBISelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "microsoft-dynamics-365" {
          selectedConnectionId = microsoftDynamics365SelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "microsoft-viva-engage" {
          selectedConnectionId = microsoftVivaEngageSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "zoom" {
          selectedConnectionId = zoomSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "discord" {
          selectedConnectionId = discordSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "posthog" {
          selectedConnectionId = postHogSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "microsoft-clarity" {
          selectedConnectionId = microsoftClaritySelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "telemetrydeck" {
          selectedConnectionId = telemetryDeckSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "sentry" {
          selectedConnectionId = sentrySelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "datadog" {
          selectedConnectionId = datadogSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "pagerduty" {
          selectedConnectionId = pagerDutySelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "cloudflare" {
          selectedConnectionId = cloudflareSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "vercel" {
          selectedConnectionId = vercelSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "heroku" {
          selectedConnectionId = herokuSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "digitalocean" {
          selectedConnectionId = digitalOceanSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "firebase" {
          selectedConnectionId = firebaseSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "supabase" {
          selectedConnectionId = supabaseSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "okta" {
          selectedConnectionId = oktaSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "bamboohr" {
          selectedConnectionId = bambooHRSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "greenhouse" {
          selectedConnectionId = greenhouseSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "lever" {
          selectedConnectionId = leverSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "notion" {
          selectedConnectionId = notionSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "slack" {
          selectedConnectionId = slackSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "github" {
          selectedConnectionId = githubSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "gitlab" {
          selectedConnectionId = gitLabSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "bitbucket" {
          selectedConnectionId = bitbucketSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "linear" {
          selectedConnectionId = linearSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "asana" {
          selectedConnectionId = asanaSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "trello" {
          selectedConnectionId = trelloSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "clickup" {
          selectedConnectionId = clickUpSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "monday-com" {
          selectedConnectionId = mondaySelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "airtable" {
          selectedConnectionId = airtableSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "dropbox" {
          selectedConnectionId = dropboxSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "box" {
          selectedConnectionId = boxSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "figma" {
          selectedConnectionId = figmaSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "miro" {
          selectedConnectionId = miroSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "canva" {
          selectedConnectionId = canvaSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "webflow" {
          selectedConnectionId = webflowSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "wordpress-com" {
          selectedConnectionId = wordpressComSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "contentful" {
          selectedConnectionId = contentfulSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "shopify" {
          selectedConnectionId = shopifySelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "woocommerce" {
          selectedConnectionId = wooCommerceSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "stripe" {
          selectedConnectionId = stripeSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "xero" {
          selectedConnectionId = xeroSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "quickbooks" {
          selectedConnectionId = quickBooksSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "freshbooks" {
          selectedConnectionId = freshBooksSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "wave" {
          selectedConnectionId = waveSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "freeagent" {
          selectedConnectionId = freeAgentSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "salesforce" {
          selectedConnectionId = salesforceSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "hubspot" {
          selectedConnectionId = hubSpotSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "pipedrive" {
          selectedConnectionId = pipedriveSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "copper" {
          selectedConnectionId = copperSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "close" {
          selectedConnectionId = closeSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "zendesk" {
          selectedConnectionId = zendeskSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "intercom" {
          selectedConnectionId = intercomSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "help-scout" {
          selectedConnectionId = helpScoutSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "front" {
          selectedConnectionId = frontSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "groove" {
          selectedConnectionId = grooveSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "teamwork" {
          selectedConnectionId = teamworkSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "basecamp" {
          selectedConnectionId = basecampSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "wrike" {
          selectedConnectionId = wrikeSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "smartsheet" {
          selectedConnectionId = smartsheetSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "todoist" {
          selectedConnectionId = todoistSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "harvest" {
          selectedConnectionId = harvestSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "calendly" {
          selectedConnectionId = calendlySelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "cal-com" {
          selectedConnectionId = calComSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "docusign" {
          selectedConnectionId = docusignSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "dropbox-sign" {
          selectedConnectionId = dropboxSignSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "pandadoc" {
          selectedConnectionId = pandaDocSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "typeform" {
          selectedConnectionId = typeformSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "surveymonkey" {
          selectedConnectionId = surveyMonkeySelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "fillout" {
          selectedConnectionId = filloutSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "mailchimp" {
          selectedConnectionId = mailchimpSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "klaviyo" {
          selectedConnectionId = klaviyoSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "convertkit" {
          selectedConnectionId = convertKitSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "campaign-monitor" {
          selectedConnectionId = campaignMonitorSelectedConnectionId.nilIfEmpty
        } else if selectedAppSlug == "constant-contact" {
          selectedConnectionId = constantContactSelectedConnectionId.nilIfEmpty
        } else {
          selectedConnectionId = nil
        }
        let nextProviderConnectionSnapshot = try services.providerConnections.snapshot(
          context: context,
          appIdOrSlug: nextApplicationsCatalog.selectedApp?.id,
          selectedConnectionId: selectedConnectionId
        )
        let nextProviderConnectionsByAppId = try loadProviderConnectionsByAppId(
          services: services,
          workspaceId: workspace.id
        )
        var nextExaInstallSnapshot = try services.marketplaceInstalls.snapshot(
          context: context,
          appIdOrSlug: nextApplicationsCatalog.selectedApp?.id
        )
        if selectedAppSlug == "exa-search" || selectedAppSlug == "x" {
          let repairedAgents = try repairConnectedExaSearchSkillFiles(
            services: services,
            context: context,
            snapshot: nextExaInstallSnapshot
          )
          if !repairedAgents.isEmpty {
            for repairedAgent in repairedAgents {
              self.recordUserManagedRuntimeRestartRequired(
                services: services,
                agent: repairedAgent,
                reason: "Marketplace files changed"
              )
            }
            nextExaInstallSnapshot = try services.marketplaceInstalls.snapshot(
              context: context,
              appIdOrSlug: nextApplicationsCatalog.selectedApp?.id
            )
          }
        }
        let nextMarketplaceActionPermissionMapsByInstallId =
          try loadMarketplaceActionPermissionMapsByInstallId(
            services: services,
            context: context,
            appId: nextApplicationsCatalog.selectedApp?.id
          )
        let nextProviderApproval = await loadProviderApprovalInbox(
          services: services,
          context: context
        )
        let nextInsightsList = try services.insights.reportList(
          context: context,
          searchQuery: insightsSearch,
          sourceFilter: insightsSourceFilter,
          sort: insightsSort,
          includeArchived: insightsIncludeArchived,
          selectedReportId: insightsSelectedReportId.isEmpty ? nil : insightsSelectedReportId
        )
        let nextInsightsSelectedId = nextInsightsList.selectedReportId ?? ""
        let nextInsightsDetail =
          nextInsightsSelectedId.isEmpty
          ? nil
          : try services.insights.reportDetail(context: context, reportId: nextInsightsSelectedId)
        let nextInsightsAnalytics = try services.insights.analytics(
          context: context,
          threadId: nextInsightsDetail?.row.threadId,
          activityGapMinutes: insightsActivityGapMinutes
        )
        let nextSettingsIntegrationSummary = try services.settingsStatus.integrationSummary(
          context: context)
        let nextSettingsNotificationPreferences = try services.settingsStatus
          .notificationPreferences(
            context: context,
            profileId: nextState.activeProfile?.id
          )
        let nextSettingsAlerts = try services.settingsStatus.alerts(
          context: context,
          unreadOnly: settingsAlertsUnreadOnly
        )
        let nextSettingsUnreadAlertCount = try services.settingsStatus.unreadAlertCount(
          context: context)
        let nextSettingsSecuritySummary = try services.settingsSecurity.securitySummary(
          context: context,
          profileId: nextState.activeProfile?.id
        )
        let nextCalendarGroup = resolvedCalendarGroup(
          agents: nextAgents, selectedAgentId: nextSelectedAgentId)
        let nextAgentTasks = try services.work.tasksForWorkspace(context: context)
        let nextSelectedTaskId =
          nextAgentTasks.contains(where: { $0.id == selectedAgentTaskId })
          ? selectedAgentTaskId
          : (nextAgentTasks.first?.id ?? "")
        let nextTaskRuns =
          nextSelectedTaskId.isEmpty
          ? []
          : try services.work.taskRuns(context: context, taskId: nextSelectedTaskId)
        try services.artifacts.reconcileCronArtifactDirectories(agents: nextAgents)
        let includeUnownedLocalArtifacts =
          workspace.settings["accountIsolatedLocalData"] != .bool(true)
            && !nextAgents.isEmpty
        var nextArtifactsSnapshot = try services.artifacts.artifactsSnapshot(
          agents: nextAgents,
          selectedArtifactId: selectedArtifactId.nilIfEmpty,
          includeUnownedLocalArtifacts: includeUnownedLocalArtifacts
        )
        let localArtifactCatalogueWasEmpty = nextArtifactsSnapshot.artifacts.isEmpty
        // An empty automatic scan can mean the app was launched with
        // an unexpected working directory or a source volume is
        // temporarily unavailable. Never let that transient state
        // erase the machine's last published catalogue.
        if !nextArtifactsSnapshot.artifacts.isEmpty {
          do {
            try await services.cloudSync.synchronizeArtifacts(
              localWorkspaceId: context.workspaceId,
              artifacts: nextArtifactsSnapshot.artifacts
            )
            artifactCatalogueSyncError = nil
          } catch {
            artifactCatalogueSyncError = error.localizedDescription
          }
        }
        do {
          nextArtifactsSnapshot.artifacts = try await services.cloudSync.remoteArtifactCatalogue(
            localWorkspaceId: context.workspaceId,
            localArtifacts: nextArtifactsSnapshot.artifacts
          )
          if localArtifactCatalogueWasEmpty {
            artifactCatalogueSyncError = nil
          }
          nextArtifactsSnapshot.artifacts.sort { lhs, rhs in
            if lhs.updatedAt != rhs.updatedAt {
              return (lhs.updatedAt ?? "") > (rhs.updatedAt ?? "")
            }
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
          }
          if let selected = nextArtifactsSnapshot.selectedArtifactId,
            !nextArtifactsSnapshot.artifacts.contains(where: { $0.id == selected })
          {
            nextArtifactsSnapshot.selectedArtifactId = nextArtifactsSnapshot.artifacts.first?.id
          }
        } catch {
          if artifactCatalogueSyncError == nil {
            artifactCatalogueSyncError = error.localizedDescription
          }
        }
        var nextCronJobsSnapshot = try services.artifacts.cronJobsSnapshot(
          agents: nextAgents,
          selectedJobId: selectedCronJobId.nilIfEmpty,
          includeUnownedLocalArtifacts: includeUnownedLocalArtifacts
        )
        for agent in nextAgents where agent.binding.runtimeType == .openclaw {
          guard let native = try? await services.harnessInstall.nativeCronJobs(for: agent),
            let jobs = native["jobs"] as? [[String: Any]]
          else { continue }
          nextCronJobsSnapshot.jobs.append(
            contentsOf: services.artifacts.openClawCronJobRecords(agent: agent, jobs: jobs))
        }
        nextCronJobsSnapshot.jobs.sort { lhs, rhs in
          if lhs.enabled != rhs.enabled { return lhs.enabled && !rhs.enabled }
          return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
        if !nextCronJobsSnapshot.jobs.contains(where: {
          $0.id == nextCronJobsSnapshot.selectedJobId
        }) {
          nextCronJobsSnapshot.selectedJobId = nextCronJobsSnapshot.jobs.first?.id
        }
        let nextWorkCalendar = try services.work.workCalendar(
          context: context,
          groupType: nextCalendarGroup.groupType,
          dayCount: 30,
          now: Date()
        )
        agentPreferences = Dictionary(
          uniqueKeysWithValues: nextPreferences.map { ($0.agentId, $0) })
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
        applicationsCatalogSnapshot = nextApplicationsCatalog
        applicationsCatalogApps = nextApplicationsCatalogApps
        providerConnectionSnapshot = nextProviderConnectionSnapshot
        providerConnectionsByAppId = nextProviderConnectionsByAppId
        exaInstallSnapshot = nextExaInstallSnapshot
        marketplaceActionPermissionMapsByInstallId = nextMarketplaceActionPermissionMapsByInstallId
        providerApprovalInbox = nextProviderApproval.inbox
        selectedProviderApprovalId = nextProviderApproval.selectedApprovalId
        insightsReportList = nextInsightsList
        insightsSelectedReportId = nextInsightsSelectedId
        insightsReportDetail = nextInsightsDetail
        insightsAnalytics = nextInsightsAnalytics
        settingsIntegrationSummary = nextSettingsIntegrationSummary
        settingsNotificationPreferences = nextSettingsNotificationPreferences
        settingsSecuritySummary = nextSettingsSecuritySummary
        settingsAlerts = nextSettingsAlerts
        settingsUnreadAlertCount = nextSettingsUnreadAlertCount
        applicationsSelectedAppId = nextApplicationsCatalog.selectedApp?.id ?? ""
        if nextApplicationsCatalog.selectedApp?.slug == "exa-search" {
          exaSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "x" {
          xSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "facebook-pages" {
          facebookPagesSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "gmail" {
          gmailSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "google-docs" {
          googleDocsSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "google-calendar" {
          googleCalendarSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "google-drive" {
          googleDriveSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "google-search-console" {
          googleSearchConsoleSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "google-analytics" {
          googleAnalyticsSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "posthog" {
          postHogSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "microsoft-clarity" {
          microsoftClaritySelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "telemetrydeck" {
          telemetryDeckSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "sentry" {
          sentrySelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          notionSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "datadog" {
          datadogSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "pagerduty" {
          pagerDutySelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "cloudflare" {
          cloudflareSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "vercel" {
          vercelSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "heroku" {
          herokuSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "digitalocean" {
          digitalOceanSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "firebase" {
          firebaseSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "supabase" {
          supabaseSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "okta" {
          oktaSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "bamboohr" {
          bambooHRSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "greenhouse" {
          greenhouseSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "lever" {
          leverSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "notion" {
          notionSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          slackSelectedConnectionId = ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "slack" {
          slackSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
          githubSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "github" {
          githubSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
          slackSelectedConnectionId = ""
          gitLabSelectedConnectionId = ""
          bitbucketSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "gitlab" {
          gitLabSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
          slackSelectedConnectionId = ""
          githubSelectedConnectionId = ""
          bitbucketSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "bitbucket" {
          bitbucketSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "linear" {
          linearSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "asana" {
          asanaSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "trello" {
          trelloSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "clickup" {
          clickUpSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "monday-com" {
          mondaySelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "airtable" {
          airtableSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "dropbox" {
          dropboxSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "box" {
          boxSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "figma" {
          figmaSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "miro" {
          miroSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "canva" {
          canvaSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "webflow" {
          webflowSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "wordpress-com" {
          wordpressComSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "contentful" {
          contentfulSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "shopify" {
          shopifySelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "woocommerce" {
          wooCommerceSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "stripe" {
          stripeSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
          slackSelectedConnectionId = ""
          githubSelectedConnectionId = ""
          gitLabSelectedConnectionId = ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "xero" {
          xeroSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "quickbooks" {
          quickBooksSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "freshbooks" {
          freshBooksSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "wave" {
          waveSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "freeagent" {
          freeAgentSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "salesforce" {
          salesforceSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "hubspot" {
          hubSpotSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "pipedrive" {
          pipedriveSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "copper" {
          copperSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "close" {
          closeSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "zendesk" {
          zendeskSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "intercom" {
          intercomSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "help-scout" {
          helpScoutSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "front" {
          frontSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "groove" {
          grooveSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "teamwork" {
          teamworkSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "basecamp" {
          basecampSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "wrike" {
          wrikeSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "smartsheet" {
          smartsheetSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "todoist" {
          todoistSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "harvest" {
          harvestSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "calendly" {
          calendlySelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "cal-com" {
          calComSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "docusign" {
          docusignSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "dropbox-sign" {
          dropboxSignSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "pandadoc" {
          pandaDocSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "typeform" {
          typeformSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "surveymonkey" {
          surveyMonkeySelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "fillout" {
          filloutSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "mailchimp" {
          mailchimpSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "klaviyo" {
          klaviyoSelectedConnectionId = nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "convertkit" {
          convertKitSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "campaign-monitor" {
          campaignMonitorSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else if nextApplicationsCatalog.selectedApp?.slug == "constant-contact" {
          constantContactSelectedConnectionId =
            nextProviderConnectionSnapshot.selectedConnection?.id ?? ""
        } else {
          exaSelectedConnectionId = ""
          xSelectedConnectionId = ""
          gmailSelectedConnectionId = ""
          googleDocsSelectedConnectionId = ""
          googleCalendarSelectedConnectionId = ""
          googleDriveSelectedConnectionId = ""
          googleSearchConsoleSelectedConnectionId = ""
          googleAnalyticsSelectedConnectionId = ""
          microsoftClaritySelectedConnectionId = ""
          sentrySelectedConnectionId = ""
          notionSelectedConnectionId = ""
          slackSelectedConnectionId = ""
          githubSelectedConnectionId = ""
          gitLabSelectedConnectionId = ""
          bitbucketSelectedConnectionId = ""
        }
        selectedAgentOpsSceneEntityId = nextAgentOpsSceneSnapshot.selectedEntityId ?? ""
        selectedAgentOpsAgentId =
          nextAgentOpsSceneSnapshot.entities.first { $0.id == selectedAgentOpsSceneEntityId }?
          .agentId
          ?? (nextAgentOpsSnapshot.agents.contains(where: { $0.agentId == selectedAgentOpsAgentId })
            ? selectedAgentOpsAgentId : (nextAgentOpsSnapshot.agents.first?.agentId ?? ""))
        agentTasks = nextAgentTasks
        selectedAgentTaskId = nextSelectedTaskId
        agentTaskRuns = nextTaskRuns
        artifactsSnapshot = nextArtifactsSnapshot
        artifacts = nextArtifactsSnapshot.artifacts
        selectedArtifactId = nextArtifactsSnapshot.selectedArtifactId ?? ""
        cronJobsSnapshot = nextCronJobsSnapshot
        cronJobs = nextCronJobsSnapshot.jobs
        if agentPanelMode == .detail, agentSubview == .cronJobs {
          selectedCronJobId =
            nextCronJobsSnapshot.jobs.contains { $0.id == selectedCronJobId }
            ? selectedCronJobId : ""
        } else {
          selectedCronJobId = nextCronJobsSnapshot.selectedJobId ?? ""
        }
        selectedCalendarGroup = nextCalendarGroup
        persistCalendarPreferences()
        agentWorkCalendar = nextWorkCalendar
        if let selectedThreadId {
          let threadDetail = try services.chat.getThread(selectedThreadId, context: context)
          selectedThreadDetail = threadDetail
          if let selectedWrapUpReportId,
            !threadDetail.wrapUpReports.contains(where: { $0.id == selectedWrapUpReportId })
          {
            self.selectedWrapUpReportId = nil
          }
          let displaySessionId =
            self.selectedWrapUpReportId
            .flatMap { reportId in threadDetail.wrapUpReports.first { $0.id == reportId }?.sessionId
            }
            ?? threadDetail.activeSessionId
          try refreshMessageWindow(
            services: services,
            threadId: selectedThreadId,
            sessionId: displaySessionId
          )
          let nextDispatches = try services.data.listDispatchesForThread(selectedThreadId)
          dispatches = nextDispatches
          let actionDispatchId = nextDispatches.last?.id
          runtimeActionCapabilities = try services.runtimeActions.refreshCapabilities(
            context: context, dispatchId: actionDispatchId)
          runtimeActionRuns = try services.runtimeActions.listRuns(context: context)
          runtimeStructuredJobs = try services.runtimeRecovery.structuredJobs(context: context)
          runtimeMissingTools = try services.runtimeRecovery.missingTools(context: context)
          runtimeRecoveryRecords = try services.runtimeRecovery.recoveryRecords(context: context)
          let selectedProviderConnectionId: RelayId?
          switch applicationsCatalogSnapshot?.selectedApp?.slug {
          case "exa-search":
            selectedProviderConnectionId = exaSelectedConnectionId.nilIfEmpty
          case "x":
            selectedProviderConnectionId = xSelectedConnectionId.nilIfEmpty
          case "facebook-pages":
            selectedProviderConnectionId = facebookPagesSelectedConnectionId.nilIfEmpty
          case "instagram-business":
            selectedProviderConnectionId = instagramBusinessSelectedConnectionId.nilIfEmpty
          case "threads":
            selectedProviderConnectionId = threadsSelectedConnectionId.nilIfEmpty
          case "pinterest":
            selectedProviderConnectionId = pinterestSelectedConnectionId.nilIfEmpty
          case "tumblr":
            selectedProviderConnectionId = tumblrSelectedConnectionId.nilIfEmpty
          case "mastodon":
            selectedProviderConnectionId = mastodonSelectedConnectionId.nilIfEmpty
          case "nextdoor":
            selectedProviderConnectionId = nextdoorSelectedConnectionId.nilIfEmpty
          case "meetup":
            selectedProviderConnectionId = meetupSelectedConnectionId.nilIfEmpty
          case "eventbrite":
            selectedProviderConnectionId = eventbriteSelectedConnectionId.nilIfEmpty
          case "webex":
            selectedProviderConnectionId = webexSelectedConnectionId.nilIfEmpty
          case "goto-meeting":
            selectedProviderConnectionId = goToMeetingSelectedConnectionId.nilIfEmpty
          case "ringcentral":
            selectedProviderConnectionId = ringCentralSelectedConnectionId.nilIfEmpty
          case "dialpad":
            selectedProviderConnectionId = dialpadSelectedConnectionId.nilIfEmpty
          case "aircall":
            selectedProviderConnectionId = aircallSelectedConnectionId.nilIfEmpty
          case "openphone":
            selectedProviderConnectionId = openPhoneSelectedConnectionId.nilIfEmpty
          case "twilio":
            selectedProviderConnectionId = twilioSelectedConnectionId.nilIfEmpty
          case "vonage":
            selectedProviderConnectionId = vonageSelectedConnectionId.nilIfEmpty
          case "messagebird":
            selectedProviderConnectionId = messageBirdSelectedConnectionId.nilIfEmpty
          case "fred":
            selectedProviderConnectionId = fredSelectedConnectionId.nilIfEmpty
          case "line":
            selectedProviderConnectionId = lineSelectedConnectionId.nilIfEmpty
          case "twist":
            selectedProviderConnectionId = twistSelectedConnectionId.nilIfEmpty
          case "zoho-mail":
            selectedProviderConnectionId = zohoMailSelectedConnectionId.nilIfEmpty
          case "gmail":
            selectedProviderConnectionId = gmailSelectedConnectionId.nilIfEmpty
          case "google-docs":
            selectedProviderConnectionId = googleDocsSelectedConnectionId.nilIfEmpty
          case "google-calendar":
            selectedProviderConnectionId = googleCalendarSelectedConnectionId.nilIfEmpty
          case "google-drive":
            selectedProviderConnectionId = googleDriveSelectedConnectionId.nilIfEmpty
          case "google-sheets":
            selectedProviderConnectionId = googleSheetsSelectedConnectionId.nilIfEmpty
          case "google-slides":
            selectedProviderConnectionId = googleSlidesSelectedConnectionId.nilIfEmpty
          case "google-forms":
            selectedProviderConnectionId = googleFormsSelectedConnectionId.nilIfEmpty
          case "google-tasks":
            selectedProviderConnectionId = googleTasksSelectedConnectionId.nilIfEmpty
          case "google-contacts":
            selectedProviderConnectionId = googleContactsSelectedConnectionId.nilIfEmpty
          case "google-photos":
            selectedProviderConnectionId = googlePhotosSelectedConnectionId.nilIfEmpty
          case "google-meet":
            selectedProviderConnectionId = googleMeetSelectedConnectionId.nilIfEmpty
          case "google-chat":
            selectedProviderConnectionId = googleChatSelectedConnectionId.nilIfEmpty
          case "google-ads":
            selectedProviderConnectionId = googleAdsSelectedConnectionId.nilIfEmpty
          case "google-search-console":
            selectedProviderConnectionId = googleSearchConsoleSelectedConnectionId.nilIfEmpty
          case "google-analytics":
            selectedProviderConnectionId = googleAnalyticsSelectedConnectionId.nilIfEmpty
          case "posthog":
            selectedProviderConnectionId = postHogSelectedConnectionId.nilIfEmpty
          case "microsoft-clarity":
            selectedProviderConnectionId = microsoftClaritySelectedConnectionId.nilIfEmpty
          case "telemetrydeck":
            selectedProviderConnectionId = telemetryDeckSelectedConnectionId.nilIfEmpty
          case "sentry":
            selectedProviderConnectionId = sentrySelectedConnectionId.nilIfEmpty
          case "datadog":
            selectedProviderConnectionId = datadogSelectedConnectionId.nilIfEmpty
          case "pagerduty":
            selectedProviderConnectionId = pagerDutySelectedConnectionId.nilIfEmpty
          case "cloudflare":
            selectedProviderConnectionId = cloudflareSelectedConnectionId.nilIfEmpty
          case "vercel":
            selectedProviderConnectionId = vercelSelectedConnectionId.nilIfEmpty
          case "heroku":
            selectedProviderConnectionId = herokuSelectedConnectionId.nilIfEmpty
          case "digitalocean":
            selectedProviderConnectionId = digitalOceanSelectedConnectionId.nilIfEmpty
          case "firebase":
            selectedProviderConnectionId = firebaseSelectedConnectionId.nilIfEmpty
          case "supabase":
            selectedProviderConnectionId = supabaseSelectedConnectionId.nilIfEmpty
          case "okta":
            selectedProviderConnectionId = oktaSelectedConnectionId.nilIfEmpty
          case "bamboohr":
            selectedProviderConnectionId = bambooHRSelectedConnectionId.nilIfEmpty
          case "greenhouse":
            selectedProviderConnectionId = greenhouseSelectedConnectionId.nilIfEmpty
          case "lever":
            selectedProviderConnectionId = leverSelectedConnectionId.nilIfEmpty
          case "notion":
            selectedProviderConnectionId = notionSelectedConnectionId.nilIfEmpty
          case "slack":
            selectedProviderConnectionId = slackSelectedConnectionId.nilIfEmpty
          case "github":
            selectedProviderConnectionId = githubSelectedConnectionId.nilIfEmpty
          case "gitlab":
            selectedProviderConnectionId = gitLabSelectedConnectionId.nilIfEmpty
          case "bitbucket":
            selectedProviderConnectionId = bitbucketSelectedConnectionId.nilIfEmpty
          case "linear":
            selectedProviderConnectionId = linearSelectedConnectionId.nilIfEmpty
          case "asana":
            selectedProviderConnectionId = asanaSelectedConnectionId.nilIfEmpty
          case "trello":
            selectedProviderConnectionId = trelloSelectedConnectionId.nilIfEmpty
          case "clickup":
            selectedProviderConnectionId = clickUpSelectedConnectionId.nilIfEmpty
          case "monday-com":
            selectedProviderConnectionId = mondaySelectedConnectionId.nilIfEmpty
          case "airtable":
            selectedProviderConnectionId = airtableSelectedConnectionId.nilIfEmpty
          case "dropbox":
            selectedProviderConnectionId = dropboxSelectedConnectionId.nilIfEmpty
          case "box":
            selectedProviderConnectionId = boxSelectedConnectionId.nilIfEmpty
          case "figma":
            selectedProviderConnectionId = figmaSelectedConnectionId.nilIfEmpty
          case "miro":
            selectedProviderConnectionId = miroSelectedConnectionId.nilIfEmpty
          case "canva":
            selectedProviderConnectionId = canvaSelectedConnectionId.nilIfEmpty
          case "webflow":
            selectedProviderConnectionId = webflowSelectedConnectionId.nilIfEmpty
          case "wordpress-com":
            selectedProviderConnectionId = wordpressComSelectedConnectionId.nilIfEmpty
          case "contentful":
            selectedProviderConnectionId = contentfulSelectedConnectionId.nilIfEmpty
          case "shopify":
            selectedProviderConnectionId = shopifySelectedConnectionId.nilIfEmpty
          case "woocommerce":
            selectedProviderConnectionId = wooCommerceSelectedConnectionId.nilIfEmpty
          case "stripe":
            selectedProviderConnectionId = stripeSelectedConnectionId.nilIfEmpty
          case "xero":
            selectedProviderConnectionId = xeroSelectedConnectionId.nilIfEmpty
          case "quickbooks":
            selectedProviderConnectionId = quickBooksSelectedConnectionId.nilIfEmpty
          case "freshbooks":
            selectedProviderConnectionId = freshBooksSelectedConnectionId.nilIfEmpty
          case "wave":
            selectedProviderConnectionId = waveSelectedConnectionId.nilIfEmpty
          case "freeagent":
            selectedProviderConnectionId = freeAgentSelectedConnectionId.nilIfEmpty
          case "salesforce":
            selectedProviderConnectionId = salesforceSelectedConnectionId.nilIfEmpty
          case "hubspot":
            selectedProviderConnectionId = hubSpotSelectedConnectionId.nilIfEmpty
          case "pipedrive":
            selectedProviderConnectionId = pipedriveSelectedConnectionId.nilIfEmpty
          case "copper":
            selectedProviderConnectionId = copperSelectedConnectionId.nilIfEmpty
          case "close":
            selectedProviderConnectionId = closeSelectedConnectionId.nilIfEmpty
          case "zendesk":
            selectedProviderConnectionId = zendeskSelectedConnectionId.nilIfEmpty
          case "intercom":
            selectedProviderConnectionId = intercomSelectedConnectionId.nilIfEmpty
          case "help-scout":
            selectedProviderConnectionId = helpScoutSelectedConnectionId.nilIfEmpty
          case "front":
            selectedProviderConnectionId = frontSelectedConnectionId.nilIfEmpty
          case "groove":
            selectedProviderConnectionId = grooveSelectedConnectionId.nilIfEmpty
          case "teamwork":
            selectedProviderConnectionId = teamworkSelectedConnectionId.nilIfEmpty
          case "basecamp":
            selectedProviderConnectionId = basecampSelectedConnectionId.nilIfEmpty
          case "wrike":
            selectedProviderConnectionId = wrikeSelectedConnectionId.nilIfEmpty
          case "smartsheet":
            selectedProviderConnectionId = smartsheetSelectedConnectionId.nilIfEmpty
          case "todoist":
            selectedProviderConnectionId = todoistSelectedConnectionId.nilIfEmpty
          case "harvest":
            selectedProviderConnectionId = harvestSelectedConnectionId.nilIfEmpty
          case "calendly":
            selectedProviderConnectionId = calendlySelectedConnectionId.nilIfEmpty
          case "cal-com":
            selectedProviderConnectionId = calComSelectedConnectionId.nilIfEmpty
          case "docusign":
            selectedProviderConnectionId = docusignSelectedConnectionId.nilIfEmpty
          case "dropbox-sign":
            selectedProviderConnectionId = dropboxSignSelectedConnectionId.nilIfEmpty
          case "pandadoc":
            selectedProviderConnectionId = pandaDocSelectedConnectionId.nilIfEmpty
          case "typeform":
            selectedProviderConnectionId = typeformSelectedConnectionId.nilIfEmpty
          case "surveymonkey":
            selectedProviderConnectionId = surveyMonkeySelectedConnectionId.nilIfEmpty
          case "fillout":
            selectedProviderConnectionId = filloutSelectedConnectionId.nilIfEmpty
          case "mailchimp":
            selectedProviderConnectionId = mailchimpSelectedConnectionId.nilIfEmpty
          case "klaviyo":
            selectedProviderConnectionId = klaviyoSelectedConnectionId.nilIfEmpty
          case "convertkit":
            selectedProviderConnectionId = convertKitSelectedConnectionId.nilIfEmpty
          case "campaign-monitor":
            selectedProviderConnectionId = campaignMonitorSelectedConnectionId.nilIfEmpty
          case "constant-contact":
            selectedProviderConnectionId = constantContactSelectedConnectionId.nilIfEmpty
          default:
            selectedProviderConnectionId = nil
          }
          providerConnectionSnapshot = try services.providerConnections.snapshot(
            context: context,
            appIdOrSlug: applicationsCatalogSnapshot?.selectedApp?.id,
            selectedConnectionId: selectedProviderConnectionId
          )
          providerConnectionsByAppId = try loadProviderConnectionsByAppId(
            services: services,
            workspaceId: workspace.id
          )
          exaInstallSnapshot = try services.marketplaceInstalls.snapshot(
            context: context,
            appIdOrSlug: applicationsCatalogSnapshot?.selectedApp?.id
          )
          marketplaceActionPermissionMapsByInstallId =
            try loadMarketplaceActionPermissionMapsByInstallId(
              services: services,
              context: context,
              appId: applicationsCatalogSnapshot?.selectedApp?.id
            )
          let providerApproval = await loadProviderApprovalInbox(
            services: services,
            context: context
          )
          providerApprovalInbox = providerApproval.inbox
          selectedProviderApprovalId = providerApproval.selectedApprovalId
          if applicationsCatalogSnapshot?.selectedApp?.slug == "exa-search" {
            exaSelectedConnectionId = providerConnectionSnapshot?.selectedConnection?.id ?? ""
            xSelectedConnectionId = ""
            gmailSelectedConnectionId = ""
            googleDocsSelectedConnectionId = ""
            googleCalendarSelectedConnectionId = ""
            googleDriveSelectedConnectionId = ""
            googleSearchConsoleSelectedConnectionId = ""
            googleAnalyticsSelectedConnectionId = ""
            microsoftClaritySelectedConnectionId = ""
          } else if applicationsCatalogSnapshot?.selectedApp?.slug == "x" {
            xSelectedConnectionId = providerConnectionSnapshot?.selectedConnection?.id ?? ""
            exaSelectedConnectionId = ""
            gmailSelectedConnectionId = ""
            googleDocsSelectedConnectionId = ""
            googleCalendarSelectedConnectionId = ""
            googleDriveSelectedConnectionId = ""
            googleSearchConsoleSelectedConnectionId = ""
            googleAnalyticsSelectedConnectionId = ""
            microsoftClaritySelectedConnectionId = ""
          } else if applicationsCatalogSnapshot?.selectedApp?.slug == "gmail" {
            gmailSelectedConnectionId = providerConnectionSnapshot?.selectedConnection?.id ?? ""
            exaSelectedConnectionId = ""
            xSelectedConnectionId = ""
            googleDocsSelectedConnectionId = ""
            googleCalendarSelectedConnectionId = ""
            googleDriveSelectedConnectionId = ""
            googleSearchConsoleSelectedConnectionId = ""
            googleAnalyticsSelectedConnectionId = ""
            microsoftClaritySelectedConnectionId = ""
            notionSelectedConnectionId = ""
          } else if applicationsCatalogSnapshot?.selectedApp?.slug == "google-docs" {
            googleDocsSelectedConnectionId =
              providerConnectionSnapshot?.selectedConnection?.id ?? ""
            exaSelectedConnectionId = ""
            xSelectedConnectionId = ""
            gmailSelectedConnectionId = ""
            googleCalendarSelectedConnectionId = ""
            googleDriveSelectedConnectionId = ""
            googleSearchConsoleSelectedConnectionId = ""
            googleAnalyticsSelectedConnectionId = ""
            microsoftClaritySelectedConnectionId = ""
            notionSelectedConnectionId = ""
          } else if applicationsCatalogSnapshot?.selectedApp?.slug == "google-calendar" {
            googleCalendarSelectedConnectionId =
              providerConnectionSnapshot?.selectedConnection?.id ?? ""
            exaSelectedConnectionId = ""
            xSelectedConnectionId = ""
            gmailSelectedConnectionId = ""
            googleDocsSelectedConnectionId = ""
            googleDriveSelectedConnectionId = ""
            googleSearchConsoleSelectedConnectionId = ""
            googleAnalyticsSelectedConnectionId = ""
            microsoftClaritySelectedConnectionId = ""
            notionSelectedConnectionId = ""
          } else if applicationsCatalogSnapshot?.selectedApp?.slug == "google-drive" {
            googleDriveSelectedConnectionId =
              providerConnectionSnapshot?.selectedConnection?.id ?? ""
            exaSelectedConnectionId = ""
            xSelectedConnectionId = ""
            gmailSelectedConnectionId = ""
            googleDocsSelectedConnectionId = ""
            googleCalendarSelectedConnectionId = ""
            googleSearchConsoleSelectedConnectionId = ""
            googleAnalyticsSelectedConnectionId = ""
            microsoftClaritySelectedConnectionId = ""
            notionSelectedConnectionId = ""
          } else if applicationsCatalogSnapshot?.selectedApp?.slug == "google-search-console" {
            googleSearchConsoleSelectedConnectionId =
              providerConnectionSnapshot?.selectedConnection?.id ?? ""
            exaSelectedConnectionId = ""
            xSelectedConnectionId = ""
            gmailSelectedConnectionId = ""
            googleDocsSelectedConnectionId = ""
            googleCalendarSelectedConnectionId = ""
            googleDriveSelectedConnectionId = ""
            googleAnalyticsSelectedConnectionId = ""
            microsoftClaritySelectedConnectionId = ""
            notionSelectedConnectionId = ""
          } else if applicationsCatalogSnapshot?.selectedApp?.slug == "google-analytics" {
            googleAnalyticsSelectedConnectionId =
              providerConnectionSnapshot?.selectedConnection?.id ?? ""
            exaSelectedConnectionId = ""
            xSelectedConnectionId = ""
            gmailSelectedConnectionId = ""
            googleDocsSelectedConnectionId = ""
            googleCalendarSelectedConnectionId = ""
            googleDriveSelectedConnectionId = ""
            googleSearchConsoleSelectedConnectionId = ""
            microsoftClaritySelectedConnectionId = ""
            notionSelectedConnectionId = ""
          } else if applicationsCatalogSnapshot?.selectedApp?.slug == "microsoft-clarity" {
            microsoftClaritySelectedConnectionId =
              providerConnectionSnapshot?.selectedConnection?.id ?? ""
            exaSelectedConnectionId = ""
            xSelectedConnectionId = ""
            gmailSelectedConnectionId = ""
            googleDocsSelectedConnectionId = ""
            googleCalendarSelectedConnectionId = ""
            googleDriveSelectedConnectionId = ""
            googleSearchConsoleSelectedConnectionId = ""
            googleAnalyticsSelectedConnectionId = ""
            notionSelectedConnectionId = ""
          } else if applicationsCatalogSnapshot?.selectedApp?.slug == "telemetrydeck" {
            telemetryDeckSelectedConnectionId =
              providerConnectionSnapshot?.selectedConnection?.id ?? ""
            exaSelectedConnectionId = ""
            xSelectedConnectionId = ""
            gmailSelectedConnectionId = ""
            googleDocsSelectedConnectionId = ""
            googleCalendarSelectedConnectionId = ""
            googleDriveSelectedConnectionId = ""
            googleSearchConsoleSelectedConnectionId = ""
            googleAnalyticsSelectedConnectionId = ""
            microsoftClaritySelectedConnectionId = ""
            notionSelectedConnectionId = ""
          } else if applicationsCatalogSnapshot?.selectedApp?.slug == "notion" {
            notionSelectedConnectionId = providerConnectionSnapshot?.selectedConnection?.id ?? ""
            exaSelectedConnectionId = ""
            xSelectedConnectionId = ""
            gmailSelectedConnectionId = ""
            googleDocsSelectedConnectionId = ""
            googleCalendarSelectedConnectionId = ""
            googleDriveSelectedConnectionId = ""
            googleSearchConsoleSelectedConnectionId = ""
            googleAnalyticsSelectedConnectionId = ""
            microsoftClaritySelectedConnectionId = ""
            slackSelectedConnectionId = ""
          } else if applicationsCatalogSnapshot?.selectedApp?.slug == "slack" {
            slackSelectedConnectionId = providerConnectionSnapshot?.selectedConnection?.id ?? ""
            exaSelectedConnectionId = ""
            xSelectedConnectionId = ""
            gmailSelectedConnectionId = ""
            googleDocsSelectedConnectionId = ""
            googleCalendarSelectedConnectionId = ""
            googleDriveSelectedConnectionId = ""
            googleSearchConsoleSelectedConnectionId = ""
            googleAnalyticsSelectedConnectionId = ""
            microsoftClaritySelectedConnectionId = ""
            notionSelectedConnectionId = ""
          } else {
            exaSelectedConnectionId = ""
            xSelectedConnectionId = ""
            gmailSelectedConnectionId = ""
            googleDocsSelectedConnectionId = ""
            googleCalendarSelectedConnectionId = ""
            googleDriveSelectedConnectionId = ""
            googleSearchConsoleSelectedConnectionId = ""
            googleAnalyticsSelectedConnectionId = ""
            microsoftClaritySelectedConnectionId = ""
            notionSelectedConnectionId = ""
            slackSelectedConnectionId = ""
          }
          insightsReportList = try services.insights.reportList(
            context: context,
            searchQuery: insightsSearch,
            sourceFilter: insightsSourceFilter,
            sort: insightsSort,
            includeArchived: insightsIncludeArchived,
            selectedReportId: insightsSelectedReportId.isEmpty ? nil : insightsSelectedReportId
          )
          insightsSelectedReportId = insightsReportList?.selectedReportId ?? ""
          insightsReportDetail =
            insightsSelectedReportId.isEmpty
            ? nil
            : try services.insights.reportDetail(
              context: context, reportId: insightsSelectedReportId)
          insightsAnalytics = try services.insights.analytics(
            context: context,
            threadId: insightsReportDetail?.row.threadId,
            activityGapMinutes: insightsActivityGapMinutes
          )
          settingsIntegrationSummary = try services.settingsStatus.integrationSummary(
            context: context)
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
          if loadedComposerThreadId != selectedThreadId
            || loadedComposerProfileId != nextState.activeProfile?.id
          {
            let draft = try services.chat.getComposerDraft(
              context: context,
              threadId: selectedThreadId,
              profileId: nextState.activeProfile?.id
            )
            composerText = draft?.content ?? ""
            loadedComposerThreadId = selectedThreadId
            loadedComposerProfileId = nextState.activeProfile?.id
          }
          composerAttachments = try services.chat.listComposerAttachments(
            context: context,
            threadId: selectedThreadId,
            profileId: nextState.activeProfile?.id
          )
          composerUploadInProgress = composerAttachments.contains { $0.status == .importing }
          composerMentionAvailability = try services.chat.mentionAvailability(
            context: context, threadId: selectedThreadId)
        } else {
          agentStructureDashboard = nil
          agentWorkCalendar = nil
          agentTasks = []
          agentTaskRuns = []
          selectedAgentTaskId = ""
          teamMemoryEntries = []
          teamHandovers = []
          agentOpsSnapshot = nil
          agentOpsSceneSnapshot = nil
          runtimeDashboardSnapshot = nil
          runtimeActionCapabilities = []
          runtimeActionRuns = []
          runtimeStructuredJobs = []
          runtimeMissingTools = []
          runtimeRecoveryRecords = []
          applicationsCatalogSnapshot = nil
          applicationsCatalogApps = []
          providerConnectionSnapshot = nil
          providerConnectionsByAppId = [:]
          exaInstallSnapshot = nil
          marketplaceActionPermissionMapsByInstallId = [:]
          providerApprovalInbox = nil
          insightsReportList = nil
          insightsReportDetail = nil
          insightsAnalytics = nil
          insightsSelectedReportId = ""
          settingsIntegrationSummary = nil
          settingsNotificationPreferences = nil
          settingsSecuritySummary = nil
          settingsAlerts = []
          settingsUnreadAlertCount = 0
          selectedProviderApprovalId = ""
          applicationsSelectedAppId = ""
          selectedAgentOpsAgentId = ""
          selectedAgentOpsSceneEntityId = ""
          resetMessageWindowSelection()
          messages = []
          dispatches = []
          composerText = ""
          composerAttachments = []
          composerUploadInProgress = false
          composerMentionAvailability = nil
          loadedComposerThreadId = nil
          loadedComposerProfileId = nil
          selectedThreadDetail = nil
          selectedWrapUpReportId = nil
        }
      } else {
        threadAgentIdsByThreadId = [:]
        runtimeDashboardSnapshot = nil
        runtimeActionCapabilities = []
        runtimeActionRuns = []
        runtimeStructuredJobs = []
        runtimeMissingTools = []
        runtimeRecoveryRecords = []
        applicationsCatalogSnapshot = nil
        applicationsCatalogApps = []
        providerConnectionSnapshot = nil
        providerConnectionsByAppId = [:]
        exaInstallSnapshot = nil
        marketplaceActionPermissionMapsByInstallId = [:]
        providerApprovalInbox = nil
        insightsReportList = nil
        insightsReportDetail = nil
        insightsAnalytics = nil
        insightsSelectedReportId = ""
        settingsIntegrationSummary = nil
        settingsNotificationPreferences = nil
        settingsSecuritySummary = nil
        settingsAlerts = []
        settingsUnreadAlertCount = 0
        selectedProviderApprovalId = ""
        applicationsSelectedAppId = ""
        selectedThreadDetail = nil
        selectedWrapUpReportId = nil
      }
      loading = false
    } catch {
      let message = error.localizedDescription
      featureStores.forEach { $0.fail(message) }
      self.error = message
      loading = false
    }
  }

  func retryRelayEntitlementVerification() async {
    guard let services else { return }
    busy = "relay-entitlement-verification"
    error = nil
    defer { busy = nil }
    do {
      let link = try services.cloudSync.listLinks().first {
        ![CloudSyncLinkState.unlinked, .revoked].contains($0.state)
      }
      let savedAccount = try services.cloudConnections.listAccounts().first
      let current = try services.entitlement.currentAccess()
      guard let accountId = current.accountId ?? link?.accountId ?? savedAccount?.id,
        let deployment = try services.cloudConnections.listDeployments().first,
        let apiURL = URL(string: deployment.apiBaseURL)
      else {
        throw RelayError(
          .permissionDenied,
          "Sign in to Relay before retrying subscription verification."
        )
      }
      let transport = try URLSessionRelayCloudTransport(apiBaseURL: apiURL)
      let rawManifest = try await transport.send(
        method: "GET",
        path: "deployment/manifest",
        body: nil,
        accessToken: nil
      )
      let manifest = try JSONDecoder().decode(
        CloudDeploymentManifest.self,
        from: JSONSerialization.data(withJSONObject: rawManifest)
      )
      _ = try services.cloudConnections.saveDeployment(manifest: manifest)
      let token = try await services.cloudConnections.validAccessToken(
        accountId: accountId,
        transport: transport
      )
      let workspaceResponse = try await transport.send(
        method: "GET",
        path: "workspaces",
        body: nil,
        accessToken: token
      )
      let workspaces =
        (workspaceResponse["data"] as? [[String: Any]])
        ?? (workspaceResponse["workspaces"] as? [[String: Any]])
        ?? []
      let workspaceId =
        [current.workspaceId, link?.remoteWorkspaceId].compactMap { $0 }.first {
          candidate in workspaces.contains { ($0["id"] as? String) == candidate }
        }
        ?? (workspaces.first?["id"] as? String ?? "")
      guard !workspaceId.isEmpty else {
        throw RelayError(.permissionDenied, "This Relay account has no workspace available.")
      }
      _ = try await services.entitlement.refreshOnlineAccess(
        accountId: accountId,
        workspaceId: workspaceId,
        transport: transport,
        manifest: manifest
      )
      if let localWorkspaceId = workspace?.id {
        _ = try await services.cloudSync.ensureAutomaticWorkspaceLink(
          localWorkspaceId: localWorkspaceId,
          accountId: accountId,
          remoteWorkspaceId: workspaceId,
          manifest: manifest,
          transport: transport
        )
      }
      await refresh()
    } catch {
      self.error = error.localizedDescription
      self.relayEntitlementAccess =
        (try? services.entitlement.currentAccess())
        ?? RelayEntitlementAccess(
          state: .verificationRequired,
          message: "Relay could not validate subscription access on this Mac."
        )
    }
  }

  func loadProviderApprovalInbox(
    services: RelayConsoleServices,
    context: ServiceRequestContext
  ) async -> (inbox: ProviderActionApprovalInboxSnapshot?, selectedApprovalId: RelayId) {
    let localInbox: ProviderActionApprovalInboxSnapshot?
    do {
      localInbox = try services.providerActionApprovalInbox.snapshot(
        context: context,
        selectedApprovalId: selectedProviderApprovalId.nilIfEmpty
      )
    } catch {
      localInbox = nil
      _ = try? services.data.log(
        severity: "warn",
        category: "applications",
        message: "Local provider approval inbox failed to load.",
        detail: [
          "error": .string(error.localizedDescription)
        ]
      )
    }
    let railwayRecords: [RailwayApprovalRecord]
    do {
      railwayRecords = try await services.cloudSync.railwayApprovals(
        localWorkspaceId: context.workspaceId
      )
    } catch {
      railwayRecords = []
      _ = try? services.data.log(
        severity: "warn",
        category: "applications",
        message: "Railway provider approval inbox failed to load.",
        detail: [
          "error": .string(error.localizedDescription)
        ]
      )
    }
    let inbox = mergeProviderApprovalInbox(
      local: localInbox,
      railwayRecords: railwayRecords,
      context: context,
      selectedApprovalId: selectedProviderApprovalId.nilIfEmpty
    )
    return (inbox, inbox.selectedApprovalId ?? "")
  }

  func loadThreadAgentIdsByThreadId(
    services: RelayConsoleServices,
    threads: [ThreadSummary]
  ) throws -> [RelayId: [RelayId]] {
    var output: [RelayId: [RelayId]] = [:]
    for thread in threads {
      var seen: Set<RelayId> = []
      var agentIds: [RelayId] = []
      func append(_ agentId: RelayId?) {
        guard let agentId, !seen.contains(agentId) else { return }
        seen.insert(agentId)
        agentIds.append(agentId)
      }

      append(thread.selectedAgentId)
      if thread.threadType == .team {
        for participant in try services.data.listThreadParticipants(threadId: thread.id) {
          guard participant.participantType == .agent,
            participant.leftAt == nil
          else { continue }
          append(participant.participantId)
        }
      }
      output[thread.id] = agentIds
    }
    return output
  }

  func loadUnfilteredApplicationsCatalogApps(
    services: RelayConsoleServices,
    context: ServiceRequestContext
  ) throws -> [MarketplaceCatalogApp] {
    try services.data.listMarketplaceCatalogApps(workspaceId: context.workspaceId).filter { app in
      app.sourceType == .externalProvider
        && !app.localAppExcluded
        && !app.reviewExcluded
        && !app.slug.localizedCaseInsensitiveContains("paperclip")
    }
  }
}
