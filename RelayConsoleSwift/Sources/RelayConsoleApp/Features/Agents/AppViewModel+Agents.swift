import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func beginCreateAgent(type: HarnessKey? = nil) {
    if let type {
      createAgentDefaultType = type
    }
    selectNav(.agents)
    agentPanelMode = .create
    agentSubview = .instructions
  }

  func beginEditAgent() {
    selectNav(.agents)
    agentPanelMode = .edit
    agentPickerOpen = false
  }

  func presentCommandPalette() {
    commandPaletteQuery = ""
    commandPalettePresented = true
  }

  func dismissCommandPalette() {
    commandPalettePresented = false
    commandPaletteQuery = ""
  }

  func showToast(_ title: String, message: String? = nil, tone: AppToast.Tone = .info) {
    toastDismissTask?.cancel()
    let toast = AppToast(title: title, message: message, tone: tone)
    appToast = toast
    toastDismissTask = Task { [weak self] in
      try? await Task.sleep(nanoseconds: 2_800_000_000)
      await MainActor.run {
        guard self?.appToast?.id == toast.id else { return }
        self?.appToast = nil
      }
    }
  }

  func dismissToast() {
    toastDismissTask?.cancel()
    appToast = nil
  }

  func selectAgent(_ agent: AgentWithBinding) {
    let shouldStayEditing = agentPanelMode == .edit
    selectedAgentId = agent.id
    if !shouldStayEditing {
      agentPanelMode = .detail
    }
    agentPickerOpen = false
    agentSearch = ""
    Task { await refreshAgentsState() }
  }

  func selectAgentSubview(_ subview: AgentSubviewKey) {
    agentPanelMode = .detail
    agentSubview = subview
    if subview == .cronJobs {
      selectedCronJobId = ""
      Task { await refreshOperationalOutputs() }
    }
    if subview == .workCalendar, !calendarGroupUserSelected {
      selectedCalendarGroup = .all
      persistCalendarPreferences()
      Task { await refreshAgentsState() }
    }
  }

  func selectCalendarGroup(_ groupFilter: AgentWorkCalendarGroupFilter) {
    selectedCalendarGroup = groupFilter
    calendarGroupUserSelected = true
    persistCalendarPreferences()
    Task { await refreshAgentsState() }
  }

  func selectCalendarSortMode(_ sortMode: AgentWorkCalendarSortMode) {
    selectedCalendarSortMode = sortMode
    persistCalendarPreferences()
  }

  func selectAgentTask(_ task: AgentTask) {
    selectedAgentTaskId = task.id
    taskSchedulerOpen = false
    Task { await refreshAgentsState() }
  }

  func selectCronJob(_ job: AgentCronJobRecord) {
    selectedCronJobId = job.id
  }

  func isCronDeliveryErrorDismissed(job: AgentCronJobRecord, error: String) -> Bool {
    dismissedCronDeliveryErrorKeys.contains(cronDeliveryErrorKey(job: job, error: error))
  }

  func dismissCronDeliveryError(job: AgentCronJobRecord, error: String) {
    dismissedCronDeliveryErrorKeys.insert(cronDeliveryErrorKey(job: job, error: error))
    persistCronDeliveryErrorDismissals()
    showToast("Cron delivery error dismissed", tone: .success)
  }

  func selectArtifact(_ artifact: AgentArtifactRecord) {
    selectedArtifactId = artifact.id
    selectedArtifactGroupId = ""
    expandArtifactGroup(containing: artifact)
  }

  func openArtifact(_ artifact: AgentArtifactRecord) {
    selectedArtifactId = artifact.id
    selectedArtifactGroupId = ""
    expandArtifactGroup(containing: artifact)
    _ = selectNav(.artifacts)
  }

  func openMaintainedArtifact(for job: AgentCronJobRecord) {
    guard let artifactId = job.maintainedArtifactId,
      let artifact = artifacts.first(where: { $0.id == artifactId })
    else { return }
    openArtifact(artifact)
  }

  func revealArtifactInFinder(_ artifact: AgentArtifactRecord) {
    guard artifact.isAvailableHere, !artifact.path.isEmpty else {
      showToast(
        "This artifact is stored on \(artifact.sourceMachineLabel ?? "another device")", tone: .info
      )
      return
    }
    NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: artifact.path)])
  }

  func openExternalArtifact(_ artifact: AgentArtifactRecord) {
    guard let destination = ExternalArtifactURLPolicy.destination(artifact.externalURL) else {
      showToast(ExternalArtifactURLPolicy.blockedReason, tone: .error)
      return
    }
    NSWorkspace.shared.open(destination.url)
  }

  func deleteArtifact(_ artifact: AgentArtifactRecord) {
    runAction("delete-artifact-\(artifact.id)", refresh: .operationalOutputs) {
      guard artifact.isAvailableHere else {
        throw RelayError(
          .permissionDenied, "Remote artifacts must be managed on the machine that stores them.")
      }
      guard let services = self.services else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      try services.artifacts.deleteArtifact(artifact)
      self.showToast("Deleted artifact", tone: .success)
      return nil
    }
  }

  func copyCronJobSourcePath(_ job: AgentCronJobRecord) {
    guard let sourcePath = job.sourcePath else { return }
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(sourcePath, forType: .string)
    showToast("Copied cron source path", tone: .success)
  }

  func saveCronJobEdits(
    job: AgentCronJobRecord,
    name: String,
    prompt: String,
    schedule: String,
    nextRunAt: String,
    enabled: Bool
  ) {
    runAction("save-cron-job-\(job.id)", refresh: .operationalOutputs) {
      guard let services = self.services else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      try services.artifacts.updateCronJob(
        job,
        updates: AgentCronJobUpdate(
          name: name,
          prompt: prompt,
          schedule: schedule,
          nextRunAt: nextRunAt,
          enabled: enabled
        )
      )
      await services.harnessInstall.maintainHermesCronSchedulersForActiveWorkspace()
      self.showToast("Cron job saved", message: "Hermes jobs.json was updated.", tone: .success)
      return nil
    }
  }

  func toggleTaskScheduler() {
    taskSchedulerOpen.toggle()
  }

  func createAgentTask(
    title: String,
    message: String,
    priority: AgentTaskPriority,
    targetType: AgentTaskTargetType,
    targetAgentId: String?,
    targetTeamId: String?,
    scheduledAt: Date?,
    timeZone: String?,
    recurrence: String?,
    requiresApproval: Bool
  ) {
    runAction("create-agent-task", refresh: .agents) {
      guard let services = self.services, let workspace = self.workspace else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      let task = try services.work.createTask(
        context: self.chatContext(workspaceId: workspace.id),
        title: title,
        message: message,
        priority: priority,
        targetType: targetType,
        targetAgentId: targetAgentId,
        targetTeamId: targetTeamId,
        preferredThreadId: self.selectedThreadId,
        scheduledAt: scheduledAt.map { ISO8601DateFormatter.relayConsole.string(from: $0) },
        timeZone: timeZone,
        recurrence: recurrence,
        requiresApproval: requiresApproval
      )
      self.selectedAgentTaskId = task.id
      self.taskSchedulerOpen = false
      return self.selectedThreadId
    }
  }

  func startAgentTaskScheduler() {
    agentTaskSchedulerLoop?.cancel()
    agentTaskSchedulerLoop = Task { [weak self] in
      while !Task.isCancelled {
        await self?.processDueAgentTasks()
        try? await Task.sleep(nanoseconds: 15_000_000_000)
      }
    }
  }

  func processDueAgentTasks(now: Date = Date()) async {
    guard let services, let workspace else { return }
    let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
    reconcileInterruptedAgentTasks(services: services, workspaceId: workspace.id, now: now)
    guard let claimed = try? services.data.claimDueAgentTasks(now: timestamp), !claimed.isEmpty
    else {
      return
    }
    let context = chatContext(workspaceId: workspace.id)
    for claimedTask in claimed where !Task.isCancelled {
      var task = claimedTask
      let startedAt = ISO8601DateFormatter.relayConsole.string(from: Date())
      do {
        let thread = try services.work.resolveExecutionThread(context: context, task: task)
        if task.threadId != thread.id {
          let previousThreadId = task.threadId
          task = try services.data.updateAgentTaskDelivery(
            taskId: task.id,
            status: .running,
            scheduledAt: task.scheduledAt,
            threadId: thread.id
          )
          if let previousThreadId,
            let previous = try? services.data.getThread(previousThreadId),
            previous.messages.isEmpty,
            previous.title.hasPrefix("Task: ") || previous.title.hasPrefix("Team task: ")
          {
            _ = try? services.data.archiveThread(threadId: previousThreadId)
          }
        }
        guard let agentId = task.assignedAgentId ?? task.targetAgentId else {
          throw RelayError(.invalidInput, "Scheduled task has no assigned agent.")
        }
        let message = try await services.dispatch.injectScheduledMessage(
          threadId: thread.id,
          agentId: agentId,
          content: task.message,
          metadata: [
            "scheduledTaskId": .string(task.id),
            "scheduledInjection": .bool(true),
            "scheduledFor": task.scheduledAt.map(JSONValue.string) ?? .null,
          ],
          approvalMode: runtimeApprovalMode
        )
        let completedAt = ISO8601DateFormatter.relayConsole.string(from: Date())
        _ = try services.data.createAgentTaskRun(
          workspaceId: task.workspaceId,
          taskId: task.id,
          agentId: agentId,
          status: .completed,
          startedAt: startedAt,
          completedAt: completedAt,
          metadata: ["messageId": .string(message.id)]
        )
        let scheduledDate =
          task.scheduledAt.flatMap(ISO8601DateFormatter.relayConsole.date(from:)) ?? now
        let nextDate = AgentTaskRecurrenceSchedule.nextRun(
          after: scheduledDate,
          recurrence: task.recurrence,
          timeZoneIdentifier: task.timeZone,
          now: now
        )
        _ = try services.data.updateAgentTaskDelivery(
          taskId: task.id,
          status: nextDate == nil ? .completed : .queued,
          scheduledAt: nextDate.map { ISO8601DateFormatter.relayConsole.string(from: $0) },
          threadId: thread.id
        )
      } catch {
        let completedAt = ISO8601DateFormatter.relayConsole.string(from: Date())
        _ = try? services.data.createAgentTaskRun(
          workspaceId: task.workspaceId,
          taskId: task.id,
          agentId: task.assignedAgentId ?? task.targetAgentId,
          status: .failed,
          startedAt: startedAt,
          completedAt: completedAt,
          error: ["message": .string(error.localizedDescription)]
        )
        _ = try? services.data.updateAgentTaskDelivery(
          taskId: task.id,
          status: .failed,
          scheduledAt: task.scheduledAt,
          threadId: task.threadId,
          lastError: error.localizedDescription
        )
      }
    }
  }

  func reconcileInterruptedAgentTasks(
    services: RelayConsoleServices,
    workspaceId: RelayId,
    now: Date
  ) {
    guard
      let runningTasks = try? services.data.listAgentTasks(workspaceId: workspaceId).filter({
        $0.status == .running
      })
    else { return }
    for task in runningTasks {
      if let message = try? services.data.scheduledTaskMessage(taskId: task.id) {
        let existingRuns = (try? services.data.listAgentTaskRuns(taskId: task.id)) ?? []
        if existingRuns.isEmpty {
          _ = try? services.data.createAgentTaskRun(
            workspaceId: task.workspaceId,
            taskId: task.id,
            agentId: task.assignedAgentId ?? task.targetAgentId,
            status: .completed,
            startedAt: message.createdAt,
            completedAt: message.createdAt,
            metadata: ["messageId": .string(message.id), "recoveredAfterRelaunch": .bool(true)]
          )
        }
        let scheduledDate =
          task.scheduledAt.flatMap(ISO8601DateFormatter.relayConsole.date(from:)) ?? now
        let nextDate = AgentTaskRecurrenceSchedule.nextRun(
          after: scheduledDate,
          recurrence: task.recurrence,
          timeZoneIdentifier: task.timeZone,
          now: now
        )
        _ = try? services.data.updateAgentTaskDelivery(
          taskId: task.id,
          status: nextDate == nil ? .completed : .queued,
          scheduledAt: nextDate.map { ISO8601DateFormatter.relayConsole.string(from: $0) },
          threadId: task.threadId
        )
        continue
      }
      if let updatedAt = ISO8601DateFormatter.relayConsole.date(from: task.updatedAt),
        now.timeIntervalSince(updatedAt) >= 5 * 60
      {
        _ = try? services.data.updateAgentTaskDelivery(
          taskId: task.id,
          status: .queued,
          scheduledAt: task.scheduledAt,
          threadId: task.threadId,
          lastError: "Recovered an interrupted scheduled dispatch."
        )
      }
    }
  }

  func selectAgentOpsAgent(_ state: AgentOpsLiveAgentState) {
    selectedAgentOpsAgentId = state.agentId
    selectedAgentOpsSceneEntityId = "agent-\(state.agentId)"
  }

  func selectAgentOpsEntity(_ entity: AgentOpsVisualEntity) {
    selectedAgentOpsSceneEntityId = entity.id
    if let agentId = entity.agentId {
      selectedAgentOpsAgentId = agentId
    } else {
      selectedAgentOpsAgentId = ""
    }
  }

  func refreshAgentOps() {
    Task { await refreshAgentsState() }
  }

  func toggleAgentOpsStatus() {
    agentOpsStatusVisible.toggle()
  }

  func toggleAgentOpsBounds() {
    agentOpsBoundsVisible.toggle()
  }

  func toggleAgentOpsPaths() {
    agentOpsPathsVisible.toggle()
  }

  func toggleAgentOpsLayoutEditor() {
    agentOpsLayoutEditorVisible.toggle()
    if agentOpsLayoutEditorVisible {
      agentOpsBoundsVisible = true
      agentOpsPathsVisible = true
      agentOpsLayoutShowPathNetwork = true
    }
  }

  func toggleAgentOpsLayoutSnapGrid() {
    agentOpsLayoutSnapToGrid.toggle()
  }

  func toggleAgentOpsLayoutLabels() {
    agentOpsLayoutLabelsVisible.toggle()
  }

  func toggleAgentOpsLayoutPathEditing() {
    agentOpsLayoutPathEditing.toggle()
    if agentOpsLayoutPathEditing {
      agentOpsLayoutShowPathNetwork = true
      agentOpsPathsVisible = true
    } else {
      agentOpsLayoutPathAddMode = false
      agentOpsLayoutPathConnectFromId = nil
    }
  }

  func toggleAgentOpsLayoutShowPathNetwork() {
    agentOpsLayoutShowPathNetwork.toggle()
    agentOpsPathsVisible = agentOpsLayoutShowPathNetwork
  }

  func toggleAgentOpsLayoutPathAddMode() {
    agentOpsLayoutPathAddMode.toggle()
    if agentOpsLayoutPathAddMode {
      agentOpsLayoutPathEditing = true
      agentOpsLayoutShowPathNetwork = true
      agentOpsPathsVisible = true
    }
  }

  func toggleAgentOpsLayoutPathTag(_ tag: AgentOpsLayoutPathTag) {
    if agentOpsLayoutActivePathTags.contains(tag) {
      agentOpsLayoutActivePathTags.remove(tag)
    } else {
      agentOpsLayoutActivePathTags.insert(tag)
    }
    if agentOpsLayoutActivePathTags.isEmpty {
      agentOpsLayoutActivePathTags.insert(.main)
    }
  }

  func toggleAgentOpsLayoutAnchorVisibility(_ group: AgentOpsLayoutAnchorGroup) {
    if agentOpsLayoutAnchorVisibility.contains(group) {
      agentOpsLayoutAnchorVisibility.remove(group)
    } else {
      agentOpsLayoutAnchorVisibility.insert(group)
    }
  }

  func updateAgentOpsLayoutCursor(_ point: AgentOpsVisualPoint?) {
    agentOpsLayoutCursorPoint = point.map(normalizedAgentOpsLayoutPoint)
  }

  func addAgentOpsPathWaypointAtCursor() {
    guard let point = agentOpsLayoutCursorPoint else { return }
    addAgentOpsPathWaypoint(at: point)
  }

  func addAgentOpsPathWaypoint(at point: AgentOpsVisualPoint) {
    let id = nextAgentOpsWaypointId()
    let waypoint = AgentOpsLayoutWaypoint(
      id: id,
      position: normalizedAgentOpsLayoutPoint(point),
      tags: agentOpsLayoutActivePathTags
    )
    agentOpsLayoutPathWaypoints.append(waypoint)
    if let fromId = agentOpsLayoutPathConnectFromId, fromId != id {
      connectAgentOpsWaypoints(from: fromId, to: id)
    }
    agentOpsLayoutSelectedPathItem = .waypoint(id)
    agentOpsLayoutPathConnectFromId = id
    agentOpsLayoutSelectedAnchor = nil
    agentOpsLayoutStatus = "Waypoint added"
  }

  func selectAgentOpsPathWaypoint(_ waypointId: RelayId) {
    if let fromId = agentOpsLayoutPathConnectFromId, fromId != waypointId {
      connectAgentOpsWaypoints(from: fromId, to: waypointId)
      agentOpsLayoutPathConnectFromId = waypointId
    }
    agentOpsLayoutSelectedPathItem = .waypoint(waypointId)
    agentOpsLayoutSelectedAnchor = nil
  }

  func selectAgentOpsPathEdge(_ edgeId: RelayId) {
    agentOpsLayoutSelectedPathItem = .edge(edgeId)
    agentOpsLayoutSelectedAnchor = nil
  }

  func moveAgentOpsPathWaypoint(_ waypointId: RelayId, to point: AgentOpsVisualPoint) {
    guard let index = agentOpsLayoutPathWaypoints.firstIndex(where: { $0.id == waypointId }) else {
      return
    }
    agentOpsLayoutPathWaypoints[index].position = normalizedAgentOpsLayoutPoint(point)
    agentOpsLayoutSelectedPathItem = .waypoint(waypointId)
  }

  func toggleAgentOpsPathConnectFromSelected() {
    guard case .waypoint(let waypointId) = agentOpsLayoutSelectedPathItem else { return }
    agentOpsLayoutPathConnectFromId =
      agentOpsLayoutPathConnectFromId == waypointId ? nil : waypointId
  }

  func setSelectedAgentOpsPathTags(_ tags: Set<AgentOpsLayoutPathTag>) {
    let resolvedTags = tags.isEmpty ? Set([AgentOpsLayoutPathTag.main]) : tags
    guard let selection = agentOpsLayoutSelectedPathItem else { return }
    switch selection {
    case .waypoint(let id):
      if let index = agentOpsLayoutPathWaypoints.firstIndex(where: { $0.id == id }) {
        agentOpsLayoutPathWaypoints[index].tags = resolvedTags
      }
    case .edge(let id):
      if let index = agentOpsLayoutPathEdges.firstIndex(where: { $0.id == id }) {
        agentOpsLayoutPathEdges[index].tags = resolvedTags
      }
    }
  }

  func deleteSelectedAgentOpsLayoutItem() {
    if let anchor = agentOpsLayoutSelectedAnchor {
      deleteAgentOpsAnchor(anchor)
      return
    }
    guard let selection = agentOpsLayoutSelectedPathItem else { return }
    switch selection {
    case .waypoint(let waypointId):
      agentOpsLayoutPathWaypoints.removeAll { $0.id == waypointId }
      agentOpsLayoutPathEdges.removeAll { $0.from == waypointId || $0.to == waypointId }
      if agentOpsLayoutPathConnectFromId == waypointId {
        agentOpsLayoutPathConnectFromId = nil
      }
    case .edge(let edgeId):
      agentOpsLayoutPathEdges.removeAll { $0.id == edgeId }
    }
    agentOpsLayoutSelectedPathItem = nil
    agentOpsLayoutStatus = "Selection deleted"
  }

  func selectAgentOpsAnchor(roomId: RelayId, group: AgentOpsLayoutAnchorGroup, index: Int) {
    agentOpsLayoutSelectedAnchor = AgentOpsLayoutAnchorSelection(
      roomId: roomId, group: group, index: index)
    agentOpsLayoutSelectedPathItem = nil
  }

  func addAgentOpsAnchor(_ group: AgentOpsLayoutAnchorGroup) {
    guard let point = agentOpsLayoutCursorPoint,
      let room = selectedAgentOpsRoom
    else { return }
    var selectedIndex: Int?
    updateAgentOpsRoom(room.id) { editableRoom in
      let nextPoint = normalizedAgentOpsLayoutPoint(point)
      switch group {
      case .entryAnchors:
        var anchors = editableRoom.entryAnchors ?? []
        anchors.append(nextPoint)
        editableRoom.entryAnchors = anchors
        selectedIndex = anchors.count - 1
      case .workstations:
        var anchors = editableRoom.workstationAnchors ?? []
        anchors.append(nextPoint)
        editableRoom.workstationAnchors = anchors
        selectedIndex = anchors.count - 1
      case .screenAnchors:
        var anchors = editableRoom.screenAnchors ?? []
        anchors.append(nextPoint)
        editableRoom.screenAnchors = anchors
        selectedIndex = anchors.count - 1
      case .idleAnchors:
        var anchors = editableRoom.idleAnchors ?? []
        anchors.append(nextPoint)
        editableRoom.idleAnchors = anchors
        selectedIndex = anchors.count - 1
      case .lightAnchors:
        var anchors = editableRoom.lightAnchors ?? []
        anchors.append(nextPoint)
        editableRoom.lightAnchors = anchors
        selectedIndex = anchors.count - 1
      }
    }
    if let selectedIndex {
      agentOpsLayoutSelectedAnchor = AgentOpsLayoutAnchorSelection(
        roomId: room.id, group: group, index: selectedIndex)
      agentOpsLayoutStatus = "\(group.title) anchor added"
    }
  }

  func moveAgentOpsAnchor(_ selection: AgentOpsLayoutAnchorSelection, to point: AgentOpsVisualPoint)
  {
    updateAgentOpsRoom(selection.roomId) { room in
      let nextPoint = normalizedAgentOpsLayoutPoint(point)
      switch selection.group {
      case .entryAnchors:
        guard var anchors = room.entryAnchors, anchors.indices.contains(selection.index) else {
          return
        }
        anchors[selection.index] = nextPoint
        room.entryAnchors = anchors
      case .workstations:
        guard var anchors = room.workstationAnchors, anchors.indices.contains(selection.index)
        else { return }
        anchors[selection.index] = nextPoint
        room.workstationAnchors = anchors
      case .screenAnchors:
        guard var anchors = room.screenAnchors, anchors.indices.contains(selection.index) else {
          return
        }
        anchors[selection.index] = nextPoint
        room.screenAnchors = anchors
      case .idleAnchors:
        guard var anchors = room.idleAnchors, anchors.indices.contains(selection.index) else {
          return
        }
        anchors[selection.index] = nextPoint
        room.idleAnchors = anchors
      case .lightAnchors:
        guard var anchors = room.lightAnchors, anchors.indices.contains(selection.index) else {
          return
        }
        anchors[selection.index] = nextPoint
        room.lightAnchors = anchors
      }
    }
    agentOpsLayoutSelectedAnchor = selection
  }

  func copyAgentOpsLayoutJSON() {
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(agentOpsLayoutExportJSON, forType: .string)
    agentOpsLayoutStatus = "Layout JSON copied"
    showToast("Copied layout JSON", tone: .success)
  }

  func saveAgentOpsLayoutDraft() {
    guard let workspaceId = workspace?.id ?? agentOpsSceneSnapshot?.workspaceId else { return }
    let draft = AgentOpsLayoutDraft(
      waypoints: agentOpsLayoutPathWaypoints,
      edges: agentOpsLayoutPathEdges,
      roomAnchorOverrides: currentAgentOpsRoomAnchorDrafts()
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    if let data = try? encoder.encode(draft) {
      UserDefaults.standard.set(data, forKey: agentOpsLayoutDraftKey(workspaceId: workspaceId))
      agentOpsLayoutDraftWorkspaceId = workspaceId
      agentOpsLayoutStatus = "Local layout draft saved"
      showToast("Layout draft saved", tone: .success)
    }
  }

  func resetAgentOpsLayoutDraft() {
    if let workspaceId = workspace?.id ?? agentOpsSceneSnapshot?.workspaceId {
      UserDefaults.standard.removeObject(forKey: agentOpsLayoutDraftKey(workspaceId: workspaceId))
    }
    agentOpsLayoutPathWaypoints = []
    agentOpsLayoutPathEdges = []
    agentOpsLayoutSelectedPathItem = nil
    agentOpsLayoutPathConnectFromId = nil
    agentOpsLayoutSelectedAnchor = nil
    agentOpsLayoutStatus = "Layout draft reset"
    refreshAgentOps()
  }

  func nextAgentOpsWaypointId() -> RelayId {
    var index = agentOpsLayoutPathWaypoints.count + 1
    var id = "wp-\(index)"
    let existing = Set(agentOpsLayoutPathWaypoints.map(\.id))
    while existing.contains(id) {
      index += 1
      id = "wp-\(index)"
    }
    return id
  }

  func connectAgentOpsWaypoints(from: RelayId, to: RelayId) {
    guard from != to else { return }
    let sortedPair = [from, to].sorted()
    let duplicate = agentOpsLayoutPathEdges.contains { edge in
      [edge.from, edge.to].sorted() == sortedPair
    }
    guard !duplicate else { return }
    let id = "edge-\(from)-\(to)"
    agentOpsLayoutPathEdges.append(
      AgentOpsLayoutEdge(
        id: id,
        from: from,
        to: to,
        tags: agentOpsLayoutActivePathTags
      ))
    agentOpsLayoutStatus = "Waypoints connected"
  }

  func normalizedAgentOpsLayoutPoint(_ point: AgentOpsVisualPoint) -> AgentOpsVisualPoint {
    let snappedX = agentOpsLayoutSnapToGrid ? (point.x / 8).rounded() * 8 : point.x.rounded()
    let snappedY = agentOpsLayoutSnapToGrid ? (point.y / 8).rounded() * 8 : point.y.rounded()
    return AgentOpsVisualPoint(x: snappedX, y: snappedY)
  }

  func updateAgentOpsRoom(_ roomId: RelayId, mutate: (inout AgentOpsVisualRoom) -> Void) {
    guard var scene = agentOpsSceneSnapshot,
      let index = scene.rooms.firstIndex(where: { $0.id == roomId })
    else { return }
    var room = scene.rooms[index]
    mutate(&room)
    scene.rooms[index] = room
    agentOpsSceneSnapshot = scene
  }

  func deleteAgentOpsAnchor(_ selection: AgentOpsLayoutAnchorSelection) {
    updateAgentOpsRoom(selection.roomId) { room in
      switch selection.group {
      case .entryAnchors:
        guard var anchors = room.entryAnchors, anchors.indices.contains(selection.index) else {
          return
        }
        anchors.remove(at: selection.index)
        room.entryAnchors = anchors
      case .workstations:
        guard var anchors = room.workstationAnchors, anchors.indices.contains(selection.index)
        else { return }
        anchors.remove(at: selection.index)
        room.workstationAnchors = anchors
      case .screenAnchors:
        guard var anchors = room.screenAnchors, anchors.indices.contains(selection.index) else {
          return
        }
        anchors.remove(at: selection.index)
        room.screenAnchors = anchors
      case .idleAnchors:
        guard var anchors = room.idleAnchors, anchors.indices.contains(selection.index) else {
          return
        }
        anchors.remove(at: selection.index)
        room.idleAnchors = anchors
      case .lightAnchors:
        guard var anchors = room.lightAnchors, anchors.indices.contains(selection.index) else {
          return
        }
        anchors.remove(at: selection.index)
        room.lightAnchors = anchors
      }
    }
    agentOpsLayoutSelectedAnchor = nil
    agentOpsLayoutStatus = "Anchor deleted"
  }

  func currentAgentOpsRoomAnchorDrafts() -> [AgentOpsLayoutRoomAnchorDraft] {
    (agentOpsSceneSnapshot?.rooms ?? []).map { room in
      AgentOpsLayoutRoomAnchorDraft(
        roomId: room.id,
        entryAnchors: room.entryAnchors,
        workstationAnchors: room.workstationAnchors,
        screenAnchors: room.screenAnchors,
        idleAnchors: room.idleAnchors,
        lightAnchors: room.lightAnchors
      )
    }
  }

  func loadAgentOpsLayoutDraftIfNeeded(workspaceId: RelayId) {
    guard agentOpsLayoutDraftWorkspaceId != workspaceId else { return }
    agentOpsLayoutDraftWorkspaceId = workspaceId
    guard
      let data = UserDefaults.standard.data(
        forKey: agentOpsLayoutDraftKey(workspaceId: workspaceId)),
      let draft = try? JSONDecoder().decode(AgentOpsLayoutDraft.self, from: data)
    else {
      agentOpsLayoutPathWaypoints = []
      agentOpsLayoutPathEdges = []
      return
    }
    agentOpsLayoutPathWaypoints = draft.waypoints
    agentOpsLayoutPathEdges = draft.edges
  }

  func applyAgentOpsLayoutDraft(to scene: AgentOpsVisualSceneSnapshot)
    -> AgentOpsVisualSceneSnapshot
  {
    guard
      let workspaceId = workspace?.id ?? appState?.activeWorkspace?.id
        ?? Optional(scene.workspaceId),
      let data = UserDefaults.standard.data(
        forKey: agentOpsLayoutDraftKey(workspaceId: workspaceId)),
      let draft = try? JSONDecoder().decode(AgentOpsLayoutDraft.self, from: data),
      !draft.roomAnchorOverrides.isEmpty
    else {
      return scene
    }
    var scene = scene
    let overrides = Dictionary(
      uniqueKeysWithValues: draft.roomAnchorOverrides.map { ($0.roomId, $0) })
    scene.rooms = scene.rooms.map { room in
      guard let override = overrides[room.id] else { return room }
      var room = room
      room.entryAnchors = override.entryAnchors
      room.workstationAnchors = override.workstationAnchors
      room.screenAnchors = override.screenAnchors
      room.idleAnchors = override.idleAnchors
      room.lightAnchors = override.lightAnchors
      return room
    }
    return scene
  }

  func agentOpsLayoutDraftKey(workspaceId: RelayId) -> String {
    "relay-console.agentops-layout-draft.\(workspaceId)"
  }

  func createRuntimeAgent(_ draft: CreateAgentDraft) {
    runAction("create-agent", refresh: .agents) {
      guard let services = self.services, let workspace = self.workspace else {
        throw RelayError(.workspaceMissing, "Workspace unavailable.")
      }
      let name = try requireNonEmptyString(draft.name, field: "Agent name", maxLength: 120)
      let role = try optionalTrimmedString(draft.role, field: "Role", maxLength: 160)
      let record = self.records.first(where: { $0.harnessKey == draft.agentType })
      let external = slugifyAgentId(name)
      guard !external.isEmpty else {
        throw RelayError(.invalidInput, "Enter a stable runtime identity before creating an agent.")
      }
      guard
        !self.isDuplicateRuntimeIdentity(runtimeType: draft.agentType, externalAgentId: external)
      else {
        throw RelayError(.invalidInput, "That runtime identity is already assigned to an agent.")
      }
      switch draft.groupType {
      case .business:
        guard draft.companyId.nilIfEmpty != nil else {
          throw RelayError(
            .invalidInput, "Choose an organization before creating a Business agent.")
        }
        if draft.teamId.nilIfEmpty != nil {
          guard draft.departmentId.nilIfEmpty != nil else {
            throw RelayError(.invalidInput, "Team must belong to the selected department.")
          }
        }
      case .family:
        guard draft.groupLabel.nilIfEmpty != nil else {
          throw RelayError(.invalidInput, "Enter a family label before creating a Family agent.")
        }
      case .personal, .unassigned:
        break
      }
      if draft.isManager {
        guard draft.groupType == .business else {
          throw RelayError(
            .invalidInput, "Manager assignment is only available for Business agents.")
        }
        guard draft.departmentId.nilIfEmpty != nil else {
          throw RelayError(
            .invalidInput, "Choose a department before setting this agent as its manager.")
        }
        if let departmentId = draft.departmentId.nilIfEmpty,
          self.departmentManager(departmentId: departmentId) != nil,
          !draft.confirmManagerReplacement
        {
          throw RelayError(
            .invalidInput, "Replacing the current department manager requires confirmation.")
        }
      }
      let result = try await services.provisioning.createProvisionedAgent(
        CreateProvisionedAgentRequest(
          workspaceId: workspace.id,
          requestedByProfileId: self.appState?.activeProfile?.id,
          harnessId: record?.harnessId,
          runtimeType: draft.agentType == .hermes ? .hermes : .openclaw,
          name: name,
          role: role,
          externalAgentId: external,
          workspaceFolderPath: nil,
          model: draft.selectedModel,
          avatarReference: draft.avatarUrl?.normalizedAvatarURL,
          avatarState: draft.avatarUrl?.agentAvatarState,
          config: [
            "source": .string(draft.agentType.rawValue),
            "isManager": .bool(draft.isManager),
            "role": role.map(JSONValue.string) ?? .null,
            "placement": .string(draft.placement),
            "groupLabel": draft.groupLabel.nilJSON,
            "companyId": draft.companyId.nilJSON,
            "departmentId": draft.departmentId.nilJSON,
            "teamId": draft.teamId.nilJSON,
          ]
        ))
      let provisioned = result.agent
      let context = self.chatContext(workspaceId: workspace.id)
      _ = try services.organization.updateAgentPlacement(
        context: context,
        agentId: provisioned.id,
        groupType: draft.groupType,
        familyLabel: draft.groupLabel.nilIfEmpty,
        companyId: draft.companyId.nilIfEmpty,
        departmentId: draft.departmentId.nilIfEmpty,
        teamId: draft.teamId.nilIfEmpty,
        classification: role
      )
      if draft.isManager, let departmentId = draft.departmentId.nilIfEmpty {
        _ = try services.organization.assignDepartmentManager(
          context: context,
          departmentId: departmentId,
          managerAgentId: provisioned.id,
          replaceExisting: draft.confirmManagerReplacement
        )
      }
      if let avatar = draft.avatarUrl {
        let preference = try services.data.saveAgentAvatarPreference(
          agentId: provisioned.id,
          avatarReference: avatar.normalizedAvatarURL,
          avatarState: avatar.agentAvatarState
        )
        self.agentPreferences[provisioned.id] = preference
      }
      self.selectedAgentId = provisioned.id
      self.agentPanelMode = .detail
      self.agentSubview = .instructions
      return try await self.openDirectChat(for: provisioned)
    }
  }

  func modelOptions(for harnessKey: HarnessKey) -> [HarnessModelOption] {
    HarnessModelSelectionService.options(for: harnessKey == .hermes ? .hermes : .openclaw)
  }

  func updateAgentModel(_ agent: AgentWithBinding, model: String) {
    runAction("update-agent-model-\(agent.id)", refresh: .agents) {
      guard let services = self.services else { return nil }
      let resolved = try HarnessModelSelectionService.resolve(model, for: agent.binding.runtimeType)
      var config = agent.binding.config
      config["model"] = .string(resolved.selected)
      config["modelFallbackApplied"] = .bool(resolved.fallbackApplied)
      _ = try services.data.updateAgent(agentId: agent.id, model: resolved.selected, config: config)
      return nil
    }
  }

  func sendMessage(agentId: String, content: String) {
    guard busy != "send-message" else { return }
    runAction("send-message", refresh: .chat) {
      guard let services = self.services, let workspace = self.workspace else { return nil }
      let profileId = self.appState?.activeProfile?.id
      let attachments = self.sendableComposerAttachments
      let submittedComposerText = self.composerText
      let submittedAttachmentIds = Set(attachments.map(\.id))
      var threadId = self.selectedThreadId
      var threadWasNew = false
      if threadId == nil {
        let thread = try services.chat.createOrReuseDirectThread(
          context: self.chatContext(workspaceId: workspace.id),
          selectedAgentId: agentId
        )
        threadId = thread.id
        threadWasNew = true
        self.selectedThreadId = thread.id
      }
      guard let id = threadId else { return nil }
      let trimmedContent = content.trimmingCharacters(in: .whitespacesAndNewlines)
      let outboundContent =
        trimmedContent.isEmpty && !attachments.isEmpty
        ? "Attachment\(attachments.count == 1 ? "" : "s")"
        : trimmedContent
      var metadata = self.messageMetadata(for: attachments)
      metadata["runtimeApprovalMode"] = .string(self.runtimeApprovalMode.rawValue)
      metadata["runtimeApprovalModeLabel"] = .string(
        Self.runtimeApprovalModeTitle(self.runtimeApprovalMode))
      var clearedSubmittedComposer = false
      if self.composerText == submittedComposerText {
        try? services.chat.clearComposerDraft(
          context: self.chatContext(workspaceId: workspace.id, profileId: profileId),
          threadId: id,
          profileId: profileId
        )
        self.composerText = ""
        self.loadedComposerThreadId = id
        self.loadedComposerProfileId = profileId
        clearedSubmittedComposer = true
      }
      self.composerSendingAttachmentIds.formUnion(submittedAttachmentIds)
      self.composerAttachments.removeAll { submittedAttachmentIds.contains($0.id) }
      self.composerUploadInProgress = self.composerAttachments.contains { $0.status == .importing }
      do {
        let sentMessage: Message
        if try services.cloudSync.isRailwayAgent(agentId) {
          sentMessage = try await services.cloudSync.sendRailwayMessage(
            localWorkspaceId: workspace.id,
            localThreadId: id,
            localAgentId: agentId,
            content: outboundContent,
            approvalMode: self.runtimeApprovalMode.rawValue
          )
        } else {
          sentMessage = try await services.dispatch.sendMessage(
            threadId: id,
            agentId: agentId,
            content: outboundContent,
            threadWasNew: threadWasNew,
            metadata: metadata,
            approvalMode: self.runtimeApprovalMode
          ).userMessage
        }
        _ = try services.chat.assignAttachmentsToMessage(
          context: self.chatContext(workspaceId: workspace.id, profileId: profileId),
          threadId: id,
          profileId: profileId,
          messageId: sentMessage.id,
          attachmentIds: attachments.map(\.id)
        )
        self.composerSendingAttachmentIds.subtract(submittedAttachmentIds)
        self.composerAttachments.removeAll { submittedAttachmentIds.contains($0.id) }
        self.composerUploadInProgress = self.composerAttachments.contains {
          $0.status == .importing
        }
        self.loadedComposerThreadId = id
        self.loadedComposerProfileId = profileId
      } catch {
        let submittedLocalMessage = try? services.data.listMessages(threadId: id).last { message in
          message.senderType == .user
            && message.content == outboundContent
            && message.metadata["localSendState"] != nil
        }
        let failedMessage = submittedLocalMessage.flatMap { message in
          message.metadata["localSendState"] == .string(LocalSendState.failed.rawValue)
            ? message : nil
        }
        if let failedMessage {
          _ = try? services.chat.assignAttachmentsToMessage(
            context: self.chatContext(workspaceId: workspace.id, profileId: profileId),
            threadId: id,
            profileId: profileId,
            messageId: failedMessage.id,
            attachmentIds: attachments.map(\.id)
          )
          self.composerSendingAttachmentIds.subtract(submittedAttachmentIds)
          self.composerAttachments.removeAll { submittedAttachmentIds.contains($0.id) }
          self.composerUploadInProgress = self.composerAttachments.contains {
            $0.status == .importing
          }
          self.loadedComposerThreadId = id
          self.loadedComposerProfileId = profileId
        } else if submittedLocalMessage != nil {
          self.composerSendingAttachmentIds.subtract(submittedAttachmentIds)
          self.composerAttachments.removeAll { submittedAttachmentIds.contains($0.id) }
          self.composerUploadInProgress = self.composerAttachments.contains {
            $0.status == .importing
          }
          self.loadedComposerThreadId = id
          self.loadedComposerProfileId = profileId
        } else {
          self.composerSendingAttachmentIds.subtract(submittedAttachmentIds)
          if clearedSubmittedComposer, self.composerText.isEmpty {
            self.composerText = submittedComposerText
            if !submittedComposerText.isEmpty {
              _ = try? services.chat.saveComposerDraft(
                context: self.chatContext(workspaceId: workspace.id, profileId: profileId),
                threadId: id,
                profileId: profileId,
                content: submittedComposerText,
                metadata: ["state": .string("draft")]
              )
            }
            self.loadedComposerThreadId = id
            self.loadedComposerProfileId = profileId
          }
          self.composerAttachments =
            (try? services.chat.listComposerAttachments(
              context: self.chatContext(workspaceId: workspace.id, profileId: profileId),
              threadId: id,
              profileId: profileId
            )) ?? self.composerAttachments
          self.composerUploadInProgress = self.composerAttachments.contains {
            $0.status == .importing
          }
        }
        throw error
      }
      return id
    }
  }

  func stageComposerAttachments(mediaOnly: Bool) {
    let panel = NSOpenPanel()
    panel.allowsMultipleSelection = true
    panel.canChooseDirectories = false
    if mediaOnly {
      panel.allowedContentTypes = [.image, .movie, .audio]
    }
    panel.begin { response in
      guard response == .OK else { return }
      let urls = panel.urls
      Task { @MainActor in
        self.runAction("stage-attachments", refresh: .chat) {
          guard let services = self.services, let workspace = self.workspace else { return nil }
          let threadId = try self.ensureComposerThreadForAttachment()
          let profileId = self.appState?.activeProfile?.id
          let context = self.chatContext(workspaceId: workspace.id, profileId: profileId)
          for url in urls {
            let accessed = url.startAccessingSecurityScopedResource()
            defer {
              if accessed { url.stopAccessingSecurityScopedResource() }
            }
            let data = try Data(contentsOf: url)
            let hash = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
            let mimeType = Self.mimeType(for: url)
            let attachment = try services.chat.stageAttachment(
              context: context,
              threadId: threadId,
              profileId: profileId,
              fileName: url.lastPathComponent,
              mimeType: mimeType,
              byteSize: data.count,
              sha256: hash,
              kind: Self.attachmentKind(for: url, mimeType: mimeType),
              status: .importing,
              progress: 0,
              provenance: [
                "source": .string("native-file-picker"),
                "storage": .string("local-authorized"),
                "pathRedacted": .bool(true),
              ]
            )
            do {
              let attachmentStore = NativeChatAttachmentStore(appDataRoot: services.paths.root)
              try attachmentStore.persist(data: data, attachment: attachment)
              _ = try services.chat.updateAttachmentStatus(
                context: context,
                threadId: threadId,
                attachmentId: attachment.id,
                status: .uploaded,
                progress: 100
              )
            } catch {
              _ = try? services.chat.updateAttachmentStatus(
                context: context,
                threadId: threadId,
                attachmentId: attachment.id,
                status: .failed,
                progress: 0,
                error: ["message": .string(error.localizedDescription)]
              )
              throw error
            }
          }
          return threadId
        }
      }
    }
  }

  func removeComposerAttachment(_ attachment: ChatAttachment) {
    runAction("remove-attachment", refresh: .chat) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      try NativeChatAttachmentStore(appDataRoot: services.paths.root).remove(attachment)
      _ = try services.chat.updateAttachmentStatus(
        context: self.chatContext(
          workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id),
        threadId: attachment.threadId,
        attachmentId: attachment.id,
        status: .cancelled,
        progress: 0,
        error: ["message": .string("Upload cancelled")]
      )
      return attachment.threadId
    }
  }

  func updateComposerDraft(_ text: String) {
    guard composerText != text else { return }
    composerText = text
    guard let services, let workspace, let threadId = selectedThreadId else { return }
    let profileId = appState?.activeProfile?.id
    let context = chatContext(workspaceId: workspace.id, profileId: profileId)
    do {
      if text.isEmpty {
        try services.chat.clearComposerDraft(
          context: context, threadId: threadId, profileId: profileId)
      } else {
        _ = try services.chat.saveComposerDraft(
          context: context,
          threadId: threadId,
          profileId: profileId,
          content: text,
          metadata: ["state": .string("draft")]
        )
      }
      loadedComposerThreadId = threadId
      loadedComposerProfileId = profileId
    } catch {
      self.error = error.localizedDescription
    }
  }

  func insertComposerMention(_ agent: AgentWithBinding) {
    let token = composerMentionToken(for: agent)
    let insertion = "@\(token) "
    guard let atIndex = composerText.lastIndex(of: "@"),
      activeComposerMentionQuery != nil
    else {
      let separator = composerText.isEmpty || composerText.last?.isWhitespace == true ? "" : " "
      updateComposerDraft("\(composerText)\(separator)\(insertion)")
      return
    }
    let prefix = composerText[..<atIndex]
    updateComposerDraft("\(prefix)\(insertion)")
  }

  func cancelDispatch(_ dispatch: RuntimeDispatch) {
    runAction("cancel-dispatch", refresh: .chat) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      _ = try await services.dispatch.cancel(
        dispatchId: dispatch.id,
        context: self.chatContext(
          workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      )
      return dispatch.threadId
    }
  }

  func resolveRuntimeApproval(
    _ dispatch: RuntimeDispatch,
    decision: RuntimeApprovalDecision
  ) {
    runAction("runtime-approval-\(dispatch.id)-\(decision.rawValue)", refresh: .chat) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      _ = try await services.dispatch.resolveRuntimeApproval(
        dispatchId: dispatch.id,
        decision: decision,
        context: self.chatContext(
          workspaceId: workspace.id,
          profileId: self.appState?.activeProfile?.id
        )
      )
      return dispatch.threadId
    }
  }

  func confirmRun(_ dispatch: RuntimeDispatch) {
    runAction("confirm-run-\(dispatch.id)", refresh: .chat) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      _ = try await services.dispatch.confirmRun(
        dispatchId: dispatch.id,
        context: self.chatContext(
          workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      )
      return dispatch.threadId
    }
  }

  func rejectRun(_ dispatch: RuntimeDispatch) {
    runAction("reject-run-\(dispatch.id)", refresh: .chat) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      _ = try await services.dispatch.rejectRun(
        dispatchId: dispatch.id,
        context: self.chatContext(
          workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      )
      return dispatch.threadId
    }
  }

  func retryDispatch(_ dispatch: RuntimeDispatch) {
    runAction("retry-dispatch", refresh: .chat) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      _ = try await services.dispatch.retry(
        dispatchId: dispatch.id,
        context: self.chatContext(
          workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      )
      return dispatch.threadId
    }
  }

  func prepareAgentDeletion(_ agent: AgentWithBinding) {
    guard let services, let workspace else {
      pendingAgentDeletionImpact = nil
      return
    }
    do {
      pendingAgentDeletionImpact = try services.agentTeardown.impact(
        context: chatContext(workspaceId: workspace.id, profileId: appState?.activeProfile?.id),
        agentId: agent.id
      )
    } catch {
      pendingAgentDeletionImpact = nil
      self.error = error.localizedDescription
    }
  }

  func agentDeletionConfirmationMessage(for agent: AgentWithBinding) -> String {
    let impact = pendingAgentDeletionImpact?.agentId == agent.id ? pendingAgentDeletionImpact : nil
    var lines = [
      "This removes \(resolveAgentDisplayName(agent)) from Relay Console and its runtime harness.",
      "Its managed workspace and runtime identity will be deleted. Unmanaged folders are skipped.",
    ]
    if let impact {
      lines.append(
        "Direct chats deleted: \(impact.directThreadCount) with \(impact.directMessageCount) messages."
      )
      lines.append(
        "Team chats updated: \(impact.teamThreadCount); agent-authored team messages deleted: \(impact.teamMessageCount)."
      )
      lines.append(
        "Runtime sessions deleted: \(impact.runtimeSessionCount); retained dispatch records deleted: \(impact.runtimeDispatchCount)."
      )
      if impact.activeDispatchCount > 0 {
        lines.append(
          "Active dispatches: \(impact.activeDispatchCount). They will be stopped where supported and purged with the agent."
        )
      }
    } else {
      lines.append(
        "Direct chats, team-chat participation, agent-authored team messages, sessions, and dispatch records will be purged."
      )
    }
    lines.append("This cannot be undone.")
    return lines.joined(separator: "\n\n")
  }

  func deleteAgent(_ agent: AgentWithBinding) {
    runAction("delete-agent-\(agent.id)", refresh: .agents) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let result = try await services.agentTeardown.deleteAgent(
        context: self.chatContext(
          workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id),
        agentId: agent.id
      )
      self.pendingAgentDeletionImpact = nil
      if self.selectedAgentId == agent.id {
        self.selectedAgentId = ""
      }
      if self.selectedAgentOpsAgentId == agent.id {
        self.selectedAgentOpsAgentId = ""
        self.selectedAgentOpsSceneEntityId = ""
      }
      self.newChatSelectedAgentId =
        self.newChatSelectedAgentId == agent.id ? "" : self.newChatSelectedAgentId
      self.newChatTeamAgentIds.remove(agent.id)
      let selectedThreadWasDeleted =
        self.selectedThreadId.map { result.deletedDirectThreadIds.contains($0) } ?? false
      let selectedThreadWasAgentDirect =
        self.selectedThread?.threadType == .direct
        && self.selectedThread?.selectedAgentId == agent.id
      if selectedThreadWasDeleted || selectedThreadWasAgentDirect {
        self.selectedThreadId = nil
        self.selectedThreadDetail = nil
        self.selectedWrapUpReportId = nil
        self.messages = []
        self.dispatches = []
        return nil
      }
      return self.selectedThreadId
    }
  }

  func saveAgentDisplayName(_ agent: AgentWithBinding, value: String) {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    agentDisplayNameSuccess[agent.id] = nil
    runAction("save-agent-display-name", refresh: .agents) {
      guard let services = self.services else { return self.selectedThreadId }
      let saved = try services.data.saveAgentDisplayPreference(
        agentId: agent.id,
        displayName: trimmed.isEmpty || trimmed == agent.name ? nil : trimmed
      )
      self.agentPreferences[agent.id] = saved
      self.agentDisplayNameSuccess[agent.id] = "Saved"
      return self.selectedThreadId
    }
  }

  func saveAgentAvatar(_ agentId: String, value: String?) {
    runAction("save-agent-avatar", refresh: .agents) {
      guard let services = self.services else { return self.selectedThreadId }
      let normalized = value?.normalizedAvatarURL
      let saved = try services.data.saveAgentAvatarPreference(
        agentId: agentId,
        avatarReference: normalized,
        avatarState: normalized?.agentAvatarState ?? .noAvatar
      )
      self.agentPreferences[agentId] = saved
      return self.selectedThreadId
    }
  }

  func saveAgentClassification(
    agent: AgentWithBinding,
    groupType: AgentGroupType,
    familyLabel: String?,
    companyId: String?,
    departmentId: String?,
    teamId: String?
  ) {
    runAction("save-agent-classification-\(agent.id)", refresh: .agents) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      let context = self.chatContext(workspaceId: workspace.id)
      switch groupType {
      case .business:
        guard companyId != nil else {
          throw RelayError(
            .invalidInput, "Choose an organization before creating a Business agent.")
        }
      case .family:
        guard familyLabel != nil else {
          throw RelayError(.invalidInput, "Enter a family label before creating a Family agent.")
        }
      case .personal, .unassigned:
        break
      }
      _ = try services.organization.updateAgentPlacement(
        context: context,
        agentId: agent.id,
        groupType: groupType,
        familyLabel: familyLabel,
        companyId: companyId,
        departmentId: departmentId,
        teamId: teamId,
        classification: agent.role ?? agent.classification
      )
      self.agentClassificationSuccess[agent.id] = "Saved"
      return self.selectedThreadId
    }
  }

  func createAgentStructureCompany(
    name: String,
    onSuccess: @escaping (AgentOrgCompany) -> Void = { _ in }
  ) {
    let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
    runAction("create-agent-structure-company", refresh: .agents) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard !trimmedName.isEmpty else {
        throw RelayError(
          .invalidInput, "Enter an organization name before creating an organization.")
      }
      let company = try services.organization.createCompany(
        context: self.chatContext(workspaceId: workspace.id),
        name: trimmedName,
        metadata: [
          "source": .string("AgentStructurePanel.createOrganization"),
          "screen": .string("agents/agent-structure"),
        ]
      )
      onSuccess(company)
      return self.selectedThreadId
    }
  }

  func deleteAgentStructureCompany(
    companyId: String,
    onSuccess: @escaping () -> Void = {}
  ) {
    let trimmedCompanyId = companyId.trimmingCharacters(in: .whitespacesAndNewlines)
    runAction("delete-agent-structure-company-\(trimmedCompanyId)", refresh: .agents) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard !trimmedCompanyId.isEmpty else {
        throw RelayError(.invalidInput, "Select an organization before deleting an organization.")
      }
      _ = try services.organization.cascadeDeleteCompany(
        context: self.chatContext(workspaceId: workspace.id),
        companyId: trimmedCompanyId
      )
      onSuccess()
      return self.selectedThreadId
    }
  }

  func createAgentStructureDepartment(
    companyId: String,
    name: String,
    colorHex: String,
    agentOpsRoomId: String,
    onSuccess: @escaping (AgentOrgDepartment) -> Void = { _ in }
  ) {
    let trimmedCompanyId = companyId.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedColor = colorHex.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedRoomId = agentOpsRoomId.trimmingCharacters(in: .whitespacesAndNewlines)
    runAction("create-agent-structure-department", refresh: .agents) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard !trimmedCompanyId.isEmpty else {
        throw RelayError(.invalidInput, "Select organization before creating a department.")
      }
      guard !trimmedName.isEmpty else {
        throw RelayError(.invalidInput, "Enter a department name before creating a department.")
      }
      let department = try services.organization.createDepartment(
        context: self.chatContext(workspaceId: workspace.id),
        companyId: trimmedCompanyId,
        name: trimmedName,
        colorHex: trimmedColor.nilIfEmpty,
        agentOpsRoomId: trimmedRoomId.nilIfEmpty,
        metadata: [
          "source": .string("AgentStructurePanel.createDepartment"),
          "screen": .string("agents/agent-structure"),
        ]
      )
      onSuccess(department)
      return self.selectedThreadId
    }
  }

  func deleteAgentStructureDepartment(
    departmentId: String,
    onSuccess: @escaping () -> Void = {}
  ) {
    let trimmedDepartmentId = departmentId.trimmingCharacters(in: .whitespacesAndNewlines)
    runAction("delete-agent-structure-department-\(trimmedDepartmentId)", refresh: .agents) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard !trimmedDepartmentId.isEmpty else {
        throw RelayError(.invalidInput, "Select a department before deleting a department.")
      }
      _ = try services.organization.deleteDepartment(
        context: self.chatContext(workspaceId: workspace.id),
        departmentId: trimmedDepartmentId
      )
      onSuccess()
      return self.selectedThreadId
    }
  }

  func createAgentStructureTeam(
    departmentId: String,
    name: String,
    onSuccess: @escaping (AgentOrgTeam) -> Void = { _ in }
  ) {
    let trimmedDepartmentId = departmentId.trimmingCharacters(in: .whitespacesAndNewlines)
    let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
    runAction("create-agent-structure-team", refresh: .agents) {
      guard let services = self.services, let workspace = self.workspace else {
        return self.selectedThreadId
      }
      guard !trimmedDepartmentId.isEmpty else {
        throw RelayError(.invalidInput, "Select department before creating a team.")
      }
      guard !trimmedName.isEmpty else {
        throw RelayError(.invalidInput, "Enter a team name before creating a team.")
      }
      let team = try services.organization.createTeam(
        context: self.chatContext(workspaceId: workspace.id),
        departmentId: trimmedDepartmentId,
        name: trimmedName,
        inheritDepartmentHeadAsLead: true,
        metadata: [
          "source": .string("AgentStructurePanel.createTeam"),
          "screen": .string("agents/agent-structure"),
        ]
      )
      onSuccess(team)
      return self.selectedThreadId
    }
  }
}
