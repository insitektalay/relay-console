import Foundation

public final class AgentOpsService {
    private let data: LocalDataService
    private let operationsLayout: AgentOpsOperationsFloorLayout?

    public init(data: LocalDataService) {
        self.data = data
        self.operationsLayout = Self.loadDefaultOperationsLayout()
    }

    public func liveStateSnapshot(
        context: ServiceRequestContext,
        selectedAgentIds: [RelayId] = [],
        now: Date = Date()
    ) throws -> AgentOpsLiveStateSnapshot {
        try requireAdminAccess(context: context)
        let refreshedAt = ISO8601DateFormatter.relayConsole.string(from: now)
        let agents = try data.listAgents(workspaceId: context.workspaceId)
            .filter { $0.harness.runtimeType == .hermes || $0.harness.runtimeType == .openclaw }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        let departments = try data.listAgentOrgDepartments(workspaceId: context.workspaceId)
        let teams = try data.listAgentOrgTeams(workspaceId: context.workspaceId)
        let tasks = try data.listAgentTasks(workspaceId: context.workspaceId)
        let runs = try data.listAgentTaskRuns(workspaceId: context.workspaceId)
        let threads = try data.listThreads(workspaceId: context.workspaceId)
        let dispatches = try threads.flatMap { try data.listDispatchesForThread($0.id) }
        let messages = try threads.flatMap { try data.listMessages(threadId: $0.id, limit: 500) }
        let harnesses = try data.listHarnesses()
        let effectiveSelection = selectedAgentIds.isEmpty ? agents.map(\.id) : selectedAgentIds.filter { id in agents.contains { $0.id == id } }

        let liveAgents = agents.map { agent in
            liveAgentState(
                agent: agent,
                departments: departments,
                teams: teams,
                tasks: tasks,
                runs: runs,
                dispatches: dispatches,
                messages: messages,
                harnesses: harnesses,
                refreshedAt: refreshedAt
            )
        }
        let runtimeOverview = AgentOpsRuntimeOverviewSnapshot(
            workspaceId: context.workspaceId,
            refreshedAt: refreshedAt,
            adminGuard: "owner_admin_only",
            activeDispatchCount: liveAgents.reduce(0) { $0 + $1.runtimeOverview.activeDispatchCount },
            queuedTaskCount: liveAgents.reduce(0) { $0 + $1.runtimeOverview.queuedTaskCount },
            waitingApprovalCount: liveAgents.reduce(0) { $0 + $1.runtimeOverview.waitingApprovalCount },
            errorCount: liveAgents.filter { $0.visibleState == .error }.count,
            summaries: liveAgents.map(\.runtimeOverview)
        )
        let feed = eventFeed(
            dispatches: dispatches,
            tasks: tasks,
            runs: runs,
            messages: messages,
            agentNames: Dictionary(uniqueKeysWithValues: agents.map { ($0.id, $0.name) })
        )
        let derivedSources = Set(liveAgents.map(\.source) + feed.compactMap(sourceForFeedItem))
        return AgentOpsLiveStateSnapshot(
            workspaceId: context.workspaceId,
            refreshedAt: refreshedAt,
            derivedFrom: AgentOpsLiveStateSource.allCases.filter { derivedSources.contains($0) },
            selectedAgentIds: effectiveSelection,
            agents: liveAgents,
            events: feed,
            runtimeOverview: runtimeOverview,
            activeCount: liveAgents.filter { [.queued, .working, .thinking, .tooling].contains($0.visibleState) }.count,
            waitingApprovalCount: liveAgents.filter { $0.visibleState == .waitingForApproval }.count,
            errorCount: runtimeOverview.errorCount,
            visualFallbackCount: liveAgents.filter(\.visualFallbackOnly).count
        )
    }

    public func visualSceneSnapshot(
        context: ServiceRequestContext,
        selectedAgentIds: [RelayId] = [],
        selectedEntityId: RelayId? = nil,
        now: Date = Date()
    ) throws -> AgentOpsVisualSceneSnapshot {
        let live = try liveStateSnapshot(
            context: context,
            selectedAgentIds: selectedAgentIds,
            now: now
        )
        return visualSceneSnapshot(from: live, selectedEntityId: selectedEntityId)
    }

    public func visualSceneSnapshot(
        from snapshot: AgentOpsLiveStateSnapshot,
        selectedEntityId: RelayId? = nil
    ) -> AgentOpsVisualSceneSnapshot {
        let floors = visualFloors(layout: operationsLayout)
        let rooms = visualRooms(for: snapshot.agents, layout: operationsLayout)
        let roomById = Dictionary(uniqueKeysWithValues: rooms.map { ($0.id, $0) })
        let selectedId = resolvedSelectedEntityId(snapshot: snapshot, requested: selectedEntityId, rooms: rooms)
        let entities = visualEntities(
            for: snapshot.agents,
            layout: operationsLayout,
            rooms: roomById,
            selectedEntityId: selectedId
        )
        let activeFloorId = entities.first { $0.id == selectedId }?.floorId
            ?? entities.first { [.queued, .working, .thinking, .tooling, .waitingForApproval, .error].contains($0.state) }?.floorId
            ?? floors.first?.id
            ?? operationsLayout?.id
            ?? "floor-business"
        let connections = entities.compactMap { entity -> AgentOpsVisualConnection? in
            guard entity.kind == .agent else { return nil }
            guard let roomId = entity.roomId else { return nil }
            let room = roomById[roomId]
            let entry = room?.entryAnchors?.first
            let roomCenter = room.map {
                AgentOpsVisualPoint(
                    x: $0.bounds.x + $0.bounds.width / 2,
                    y: $0.bounds.y + $0.bounds.height / 2
                )
            }
            let waypoints = [entity.position, entry, roomCenter].compactMap { $0 }
            return AgentOpsVisualConnection(
                id: "agentops-connection-\(entity.id)-\(roomId)",
                fromEntityId: entity.id,
                toRoomId: roomId,
                kind: "assigned_room",
                sourceRecordIds: entity.sourceRecordIds,
                waypoints: waypoints,
                pathTags: entry == nil ? ["room_assignment"] : ["room_assignment", "room_entry"]
            )
        }
        var unavailableReasons: [String] = []
        if operationsLayout == nil {
            unavailableReasons.append("AgentOps bundled floor layout resource could not be loaded; using deterministic native room rectangles.")
        }
        if snapshot.visualFallbackCount > 0 {
            unavailableReasons.append("Weak idle agents are visual-only fallbacks backed only by retained agent rows.")
        }
        if snapshot.agents.isEmpty {
            unavailableReasons.append("No retained real workspace agents are available for AgentOps HQ.")
        }

        return AgentOpsVisualSceneSnapshot(
            workspaceId: snapshot.workspaceId,
            refreshedAt: snapshot.refreshedAt,
            sourceSnapshotRefreshedAt: snapshot.refreshedAt,
            activeFloorId: activeFloorId,
            selectedEntityId: selectedId,
            floors: floors,
            rooms: rooms,
            entities: entities,
            connections: connections,
            summary: AgentOpsVisualSceneSummary(
                activeCount: snapshot.activeCount,
                waitingApprovalCount: snapshot.waitingApprovalCount,
                errorCount: snapshot.errorCount,
                visualFallbackCount: snapshot.visualFallbackCount,
                eventCount: snapshot.events.count
            ),
            assetStrategy: operationsLayout == nil
                ? "deterministic_native_layout_fallback_resource_unavailable"
                : "bundled_web_agentops_floor_worker_assets",
            layoutPersistenceStatus: operationsLayout == nil
                ? "workspace_scoped_deterministic_from_agent_room_records"
                : "web_default_operations_floor_layout_source_record_backed",
            redactionStatus: "operator_and_message_content_redacted",
            unavailableReasons: unavailableReasons
        )
    }

    private func liveAgentState(
        agent: AgentWithBinding,
        departments: [AgentOrgDepartment],
        teams: [AgentOrgTeam],
        tasks: [AgentTask],
        runs: [AgentTaskRun],
        dispatches: [RuntimeDispatch],
        messages: [Message],
        harnesses: [Harness],
        refreshedAt: IsoTimestamp
    ) -> AgentOpsLiveAgentState {
        let agentDispatches = dispatches.filter { $0.agentId == agent.id }.sorted { $0.updatedAt > $1.updatedAt }
        let agentTasks = tasks.filter { $0.assignedAgentId == agent.id || $0.targetAgentId == agent.id }.sorted { $0.updatedAt > $1.updatedAt }
        let agentRuns = runs.filter { $0.agentId == agent.id }.sorted { $0.updatedAt > $1.updatedAt }
        let agentMessages = messages.filter { $0.senderType == .agent && $0.senderId == agent.id }.sorted { $0.createdAt > $1.createdAt }
        let department = agent.departmentId.flatMap { id in departments.first { $0.id == id } }
        let team = agent.teamId.flatMap { id in teams.first { $0.id == id } }
        let harness = harnesses.first { $0.id == agent.harness.id } ?? agent.harness
        let runtimeOverview = AgentOpsRuntimeOverviewSummary(
            agentId: agent.id,
            runtimeType: agent.binding.runtimeType,
            harnessDisplayName: agent.harness.displayName,
            harnessLifecycleState: harnessLifecycleState(harness),
            harnessHealthStatus: harnessHealthStatus(harness),
            activeDispatchCount: agentDispatches.filter(\.isActive).count,
            queuedTaskCount: agentTasks.filter { [.queued, .dispatched].contains($0.status) }.count,
            waitingApprovalCount: agentTasks.filter { $0.status == .blocked && $0.requiresApproval }.count,
            latestDispatchId: agentDispatches.first?.id,
            latestTaskId: agentTasks.first?.id,
            latestThreadId: agentDispatches.first?.threadId ?? agentTasks.first?.threadId ?? agentMessages.first?.threadId,
            latestMessageId: agentDispatches.first?.messageId ?? agentMessages.first?.id,
            redactedContext: runtimeContextSummary(agent: agent, dispatch: agentDispatches.first, task: agentTasks.first, message: agentMessages.first, harness: harness),
            updatedAt: maxTimestamp([agent.updatedAt, agentDispatches.first?.updatedAt, agentTasks.first?.updatedAt, agentRuns.first?.updatedAt, agentMessages.first?.createdAt])
        )
        let signal = strongestSignal(
            agent: agent,
            dispatches: agentDispatches,
            tasks: agentTasks,
            messages: agentMessages,
            harness: harness
        )
        return AgentOpsLiveAgentState(
            agentId: agent.id,
            agentName: agent.name,
            groupType: agent.groupType,
            departmentId: department?.id,
            departmentName: department?.name,
            teamId: team?.id,
            teamName: team?.name,
            roomId: team?.agentOpsRoomId ?? department?.agentOpsRoomId ?? fallbackRoomId(for: agent.groupType),
            realState: signal.state,
            visibleState: signal.state,
            source: signal.source,
            confidence: signal.confidence,
            dispatchId: signal.dispatchId,
            taskId: signal.taskId,
            threadId: signal.threadId,
            messageId: signal.messageId,
            reason: signal.reason,
            expiresAt: nil,
            updatedAt: signal.updatedAt ?? runtimeOverview.updatedAt,
            visualFallbackOnly: signal.visualFallbackOnly,
            runtimeOverview: runtimeOverview
        )
    }

    private func strongestSignal(
        agent: AgentWithBinding,
        dispatches: [RuntimeDispatch],
        tasks: [AgentTask],
        messages: [Message],
        harness: Harness
    ) -> AgentSignal {
        if agent.status != "active" {
            return AgentSignal(
                state: .offline,
                source: .agentStatus,
                confidence: .strong,
                reason: "Agent status is \(agent.status).",
                updatedAt: agent.updatedAt,
                visualFallbackOnly: false
            )
        }
        if let dispatch = dispatches.first(where: \.isActive) ?? dispatches.first {
            return signal(for: dispatch)
        }
        if let task = tasks.first(where: { $0.status == .blocked && $0.requiresApproval }) {
            return signal(for: task)
        }
        if let task = tasks.first(where: { [.running, .dispatched, .queued, .failed, .cancelled, .completed].contains($0.status) }) {
            return signal(for: task)
        }
        if let status = harnessHealthStatus(harness), status != .unknown {
            switch status {
            case .healthy:
                break
            case .degraded, .authRequired:
                return AgentSignal(
                    state: .waitingForApproval,
                    source: .health,
                    confidence: .medium,
                    reason: "Harness health is \(status.rawValue).",
                    updatedAt: harness.updatedAt,
                    visualFallbackOnly: false
                )
            case .unhealthy, .missing:
                return AgentSignal(
                    state: .offline,
                    source: .health,
                    confidence: .medium,
                    reason: "Harness health is \(status.rawValue).",
                    updatedAt: harness.updatedAt,
                    visualFallbackOnly: false
                )
            case .unknown:
                break
            }
        }
        if let message = messages.first {
            return AgentSignal(
                state: .completed,
                source: .message,
                confidence: .medium,
                threadId: message.threadId,
                messageId: message.id,
                reason: "Latest retained agent message is the newest local signal.",
                updatedAt: message.createdAt,
                visualFallbackOnly: false
            )
        }
        return AgentSignal(
            state: .idle,
            source: .none,
            confidence: .weak,
            reason: "No retained local dispatch, task, message, health, or status signal for this agent.",
            updatedAt: agent.updatedAt,
            visualFallbackOnly: true
        )
    }

    private func signal(for dispatch: RuntimeDispatch) -> AgentSignal {
        let state: AgentOpsLiveState
        let source: AgentOpsLiveStateSource
        let confidence: AgentOpsLiveStateConfidence
        switch dispatch.status {
        case .queued:
            state = .queued
            source = .runtimeDispatch
            confidence = .strong
        case .started, .streaming:
            state = .working
            source = .runtimeDispatch
            confidence = .strong
        case .completed:
            state = .completed
            source = .runtimeDispatch
            confidence = .strong
        case .failed:
            state = .error
            source = .runtimeDispatch
            confidence = .strong
        case .cancelled:
            state = .cancelled
            source = .runtimeDispatch
            confidence = .strong
        }
        return AgentSignal(
            state: state,
            source: source,
            confidence: confidence,
            dispatchId: dispatch.id,
            threadId: dispatch.threadId,
            messageId: dispatch.messageId,
            reason: "Latest retained runtime dispatch is \(dispatch.status.rawValue).",
            updatedAt: dispatch.updatedAt,
            visualFallbackOnly: false
        )
    }

    private func signal(for task: AgentTask) -> AgentSignal {
        let state: AgentOpsLiveState
        let source: AgentOpsLiveStateSource
        let confidence: AgentOpsLiveStateConfidence = .strong
        switch task.status {
        case .queued, .dispatched:
            state = .queued
            source = .task
        case .running:
            state = .working
            source = .task
        case .blocked:
            state = task.requiresApproval ? .waitingForApproval : .idle
            source = task.requiresApproval ? .approval : .task
        case .completed:
            state = .completed
            source = .task
        case .failed:
            state = .error
            source = .task
        case .cancelled:
            state = .cancelled
            source = .task
        case .archived:
            state = .idle
            source = .task
        }
        return AgentSignal(
            state: state,
            source: source,
            confidence: confidence,
            taskId: task.id,
            threadId: task.threadId,
            reason: task.requiresApproval && task.status == .blocked
                ? "Task is blocked on retained approval state."
                : "Latest retained task is \(task.status.rawValue).",
            updatedAt: task.updatedAt,
            visualFallbackOnly: false
        )
    }

    private func eventFeed(
        dispatches: [RuntimeDispatch],
        tasks: [AgentTask],
        runs: [AgentTaskRun],
        messages: [Message],
        agentNames: [RelayId: String]
    ) -> [AgentOpsEventFeedItem] {
        let dispatchItems = dispatches.map { dispatch in
            AgentOpsEventFeedItem(
                id: "agentops-dispatch-\(dispatch.id)",
                kind: "runtime_dispatch",
                title: "Runtime dispatch \(dispatch.status.rawValue)",
                summary: "Dispatch \(dispatch.id) for \(agentNames[dispatch.agentId] ?? "agent")",
                severity: dispatch.status == .failed ? "error" : "info",
                agentId: dispatch.agentId,
                dispatchId: dispatch.id,
                taskId: nil,
                threadId: dispatch.threadId,
                messageId: dispatch.messageId,
                createdAt: dispatch.updatedAt,
                redactionStatus: "operator-text-redacted"
            )
        }
        let taskItems = tasks.map { task in
            AgentOpsEventFeedItem(
                id: "agentops-task-\(task.id)",
                kind: task.requiresApproval ? "approval" : "task",
                title: task.requiresApproval ? "Approval-linked task \(task.status.rawValue)" : "Task \(task.status.rawValue)",
                summary: "Task \(task.id) retained with redacted operator text.",
                severity: task.status == .failed ? "error" : (task.requiresApproval && task.status == .blocked ? "warning" : "info"),
                agentId: task.assignedAgentId ?? task.targetAgentId,
                dispatchId: nil,
                taskId: task.id,
                threadId: task.threadId,
                messageId: nil,
                createdAt: task.updatedAt,
                redactionStatus: "operator-text-redacted"
            )
        }
        let runItems = runs.map { run in
            AgentOpsEventFeedItem(
                id: "agentops-run-\(run.id)",
                kind: "task_run",
                title: "Task run \(run.status.rawValue)",
                summary: "Run \(run.id) retained without task message text.",
                severity: run.status == .failed ? "error" : "info",
                agentId: run.agentId,
                dispatchId: run.dispatchId,
                taskId: run.taskId,
                threadId: nil,
                messageId: nil,
                createdAt: run.updatedAt,
                redactionStatus: "operator-text-redacted"
            )
        }
        let messageItems = messages.filter { $0.senderType == .agent }.map { message in
            AgentOpsEventFeedItem(
                id: "agentops-message-\(message.id)",
                kind: "message",
                title: "Agent message recorded",
                summary: "Message \(message.id) retained with content redacted.",
                severity: "info",
                agentId: message.senderId,
                dispatchId: agentOpsStringValue(message.metadata["dispatchId"]),
                taskId: agentOpsStringValue(message.metadata["taskId"]),
                threadId: message.threadId,
                messageId: message.id,
                createdAt: message.createdAt,
                redactionStatus: "message-content-redacted"
            )
        }
        return (dispatchItems + taskItems + runItems + messageItems)
            .sorted { $0.createdAt > $1.createdAt }
            .prefix(40)
            .map { $0 }
    }

    private func sourceForFeedItem(_ item: AgentOpsEventFeedItem) -> AgentOpsLiveStateSource? {
        switch item.kind {
        case "runtime_dispatch":
            return .runtimeDispatch
        case "approval":
            return .approval
        case "task", "task_run":
            return .task
        case "message":
            return .message
        default:
            return nil
        }
    }

    private func runtimeContextSummary(
        agent: AgentWithBinding,
        dispatch: RuntimeDispatch?,
        task: AgentTask?,
        message: Message?,
        harness: Harness
    ) -> String {
        var parts = [
            "runtime=\(agent.binding.runtimeType.rawValue)",
            "harness=\(harness.displayName)"
        ]
        if let dispatch {
            parts.append("dispatch=\(dispatch.status.rawValue)")
        }
        if let task {
            parts.append("task=\(task.status.rawValue)")
        }
        if message != nil {
            parts.append("message=content_redacted")
        }
        return parts.joined(separator: " | ")
    }

    private func harnessLifecycleState(_ harness: Harness) -> HarnessLifecycleState? {
        agentOpsStringValue(harness.config["lifecycleState"]).flatMap(HarnessLifecycleState.init(rawValue:))
    }

    private func harnessHealthStatus(_ harness: Harness) -> HarnessHealthStatus? {
        agentOpsStringValue(harness.config["healthStatus"]).flatMap(HarnessHealthStatus.init(rawValue:))
            ?? agentOpsStringValue(harness.config["status"]).flatMap(HarnessHealthStatus.init(rawValue:))
    }

    private func fallbackRoomId(for agent: AgentWithBinding) -> String {
        fallbackRoomId(for: agent.groupType)
    }

    private func fallbackRoomId(for groupType: AgentGroupType?) -> String {
        switch groupType ?? .unassigned {
        case .business:
            return "business-floor"
        case .family:
            return "family-room"
        case .personal:
            return "personal-desk"
        case .unassigned:
            return "unassigned-dock"
        }
    }

    private func visualFloors(layout: AgentOpsOperationsFloorLayout?) -> [AgentOpsVisualFloor] {
        if let layout {
            return [
                AgentOpsVisualFloor(
                    id: layout.id,
                    title: layout.label,
                    subtitle: "Asset-backed operations floor from bundled AgentOps layout",
                    order: 0,
                    bounds: layout.bounds.visualRect,
                    backgroundAssetId: layout.backgroundAssetId,
                    backgroundResourceName: "agentops-tower-main-operations-floor",
                    backgroundResourceSubdirectory: "Assets/agent-ops-hq/floors"
                )
            ]
        }
        return [
            AgentOpsVisualFloor(
                id: "floor-business",
                title: "Business",
                subtitle: "Departments, teams, runtime work, and approvals",
                order: 0,
                bounds: AgentOpsVisualRect(x: 0, y: 0, width: 1200, height: 760)
            ),
            AgentOpsVisualFloor(
                id: "floor-family",
                title: "Family",
                subtitle: "Household assistants and shared routines",
                order: 1,
                bounds: AgentOpsVisualRect(x: 0, y: 0, width: 1200, height: 760)
            ),
            AgentOpsVisualFloor(
                id: "floor-personal",
                title: "Personal",
                subtitle: "Personal assistants, inboxes, and local workflows",
                order: 2,
                bounds: AgentOpsVisualRect(x: 0, y: 0, width: 1200, height: 760)
            ),
            AgentOpsVisualFloor(
                id: "floor-unassigned",
                title: "Unassigned",
                subtitle: "Agents without an assigned operating room",
                order: 3,
                bounds: AgentOpsVisualRect(x: 0, y: 0, width: 1200, height: 760)
            )
        ]
    }

    private func visualRooms(
        for agents: [AgentOpsLiveAgentState],
        layout: AgentOpsOperationsFloorLayout?
    ) -> [AgentOpsVisualRoom] {
        if let layout {
            let grouped = Dictionary(grouping: agents) { visualRoomId(for: $0, layout: layout) }
            let layoutRooms = layout.rooms.map { room in
                let states = grouped[room.id] ?? []
                return AgentOpsVisualRoom(
                    id: room.id,
                    floorId: layout.id,
                    title: room.label,
                    zone: layout.zoneLabel(for: room.zoneId),
                    status: states.isEmpty ? visualStatus(forLayoutRoomStatus: room.status) : roomStatus(states),
                    agentCount: states.count,
                    bounds: room.bounds.visualRect,
                    deterministicFallback: false,
                    kind: room.kind,
                    variantId: room.currentVariantId,
                    departmentId: room.departmentId,
                    businessUnitId: room.businessUnitId,
                    entryAnchors: room.entryAnchors.map(\.visualPoint),
                    workstationAnchors: room.activeWorkstations.map(\.position.visualPoint),
                    screenAnchors: room.activeScreenAnchors.map(\.position.visualPoint),
                    idleAnchors: room.activeIdleAnchors.map(\.visualPoint),
                    lightAnchors: room.lightAnchors.map(\.visualPoint)
                )
            }
            let missingRoomIds = grouped.keys.filter { layout.room(id: $0) == nil }.sorted()
            guard !missingRoomIds.isEmpty else { return layoutRooms }
            let fallbackRooms = visualFallbackRooms(roomIds: missingRoomIds, grouped: grouped)
            return layoutRooms + fallbackRooms
        }

        return visualFallbackRooms(
            roomIds: Array(Set(["business-floor", "family-room", "personal-desk", "unassigned-dock"] + Dictionary(grouping: agents) { visualRoomId(for: $0, layout: nil) }.keys)).sorted(),
            grouped: Dictionary(grouping: agents) { visualRoomId(for: $0, layout: nil) }
        )
    }

    private func visualFallbackRooms(
        roomIds: [RelayId],
        grouped: [RelayId: [AgentOpsLiveAgentState]]
    ) -> [AgentOpsVisualRoom] {
        let defaultRoomIds = ["business-floor", "family-room", "personal-desk", "unassigned-dock"]
        let roomIds = Array(Set(defaultRoomIds + roomIds)).sorted()
        let floorBuckets = Dictionary(grouping: roomIds) { roomId in
            floorId(for: grouped[roomId]?.first?.groupType ?? groupType(forRoomId: roomId))
        }
        var floorLocalIndex: [RelayId: Int] = [:]
        return roomIds.map { roomId in
            let states = grouped[roomId] ?? []
            let floorId = floorId(for: states.first?.groupType ?? groupType(forRoomId: roomId))
            let index = floorLocalIndex[floorId, default: 0]
            floorLocalIndex[floorId] = index + 1
            let totalOnFloor = floorBuckets[floorId]?.count ?? 1
            return AgentOpsVisualRoom(
                id: roomId,
                floorId: floorId,
                title: roomTitle(roomId: roomId, states: states),
                zone: roomZone(roomId: roomId, states: states),
                status: roomStatus(states),
                agentCount: states.count,
                bounds: roomBounds(index: index, totalOnFloor: totalOnFloor),
                deterministicFallback: true,
                kind: "fallback",
                variantId: nil,
                departmentId: nil,
                businessUnitId: nil,
                entryAnchors: nil,
                workstationAnchors: nil,
                screenAnchors: nil,
                idleAnchors: nil,
                lightAnchors: nil
            )
        }
    }

    private func visualEntities(
        for agents: [AgentOpsLiveAgentState],
        layout: AgentOpsOperationsFloorLayout?,
        rooms: [RelayId: AgentOpsVisualRoom],
        selectedEntityId: RelayId?
    ) -> [AgentOpsVisualEntity] {
        let grouped = Dictionary(grouping: agents) { visualRoomId(for: $0, layout: layout) }
        let agentEntities = grouped.keys.sorted().flatMap { roomId in
            let roomStates = (grouped[roomId] ?? []).sorted {
                $0.agentName.localizedCaseInsensitiveCompare($1.agentName) == .orderedAscending
            }
            guard let room = rooms[roomId] else { return [AgentOpsVisualEntity]() }
            return roomStates.enumerated().map { index, state in
                let entityId = "agent-\(state.agentId)"
                let position = entityPosition(index: index, state: state, room: room, layout: layout)
                let sprite = spriteResource(for: state.agentId)
                return AgentOpsVisualEntity(
                    id: entityId,
                    kind: .agent,
                    title: state.agentName,
                    subtitle: "\(state.visibleState.rawValue) via \(state.source.rawValue)",
                    floorId: room.floorId,
                    roomId: room.id,
                    agentId: state.agentId,
                    state: state.visibleState,
                    confidence: state.confidence,
                    source: state.source,
                    position: position.point,
                    selected: entityId == selectedEntityId,
                    visualFallbackOnly: state.visualFallbackOnly,
                    sourceRecordIds: sourceRecordIds(for: state),
                    accessibilityLabel: "Agent \(state.agentName), \(state.visibleState.rawValue), \(state.confidence.rawValue) confidence, source \(state.source.rawValue)",
                    placementReason: position.reason,
                    spriteAssetId: sprite.assetId,
                    spriteResourceName: sprite.resourceName,
                    spriteResourceSubdirectory: "Assets/agent-ops-hq/agents",
                    spriteFrameOrigin: AgentOpsVisualPoint(x: 0, y: spriteFrameRow(for: state.visibleState) * 64),
                    spriteFrameWidth: 64,
                    spriteFrameHeight: 64,
                    spriteScale: 0.75,
                    spriteAnchor: AgentOpsVisualPoint(x: 0.5, y: 0.82)
                )
            }
        }
        let roomEntities = rooms.values.sorted { $0.id < $1.id }.map { room in
            let entityId = "room-\(room.id)"
            return AgentOpsVisualEntity(
                id: entityId,
                kind: .room,
                title: room.title,
                subtitle: "\(room.zone) room",
                floorId: room.floorId,
                roomId: room.id,
                agentId: nil,
                state: room.status,
                confidence: .weak,
                source: .none,
                position: AgentOpsVisualPoint(x: room.bounds.x + room.bounds.width / 2, y: room.bounds.y + room.bounds.height / 2),
                selected: entityId == selectedEntityId,
                visualFallbackOnly: false,
                sourceRecordIds: ["room:\(room.id)", room.deterministicFallback ? "layout:deterministic_fallback" : "layout:web_default_operations_floor"],
                accessibilityLabel: "AgentOps room \(room.title), \(room.status.rawValue), \(room.agentCount) agents",
                placementReason: room.deterministicFallback ? "deterministic_room_fallback" : "web_layout_room_bounds",
                spriteAssetId: nil,
                spriteResourceName: nil,
                spriteResourceSubdirectory: nil,
                spriteFrameOrigin: nil,
                spriteFrameWidth: nil,
                spriteFrameHeight: nil,
                spriteScale: nil,
                spriteAnchor: nil
            )
        }
        return agentEntities + roomEntities
    }

    private func resolvedSelectedEntityId(
        snapshot: AgentOpsLiveStateSnapshot,
        requested: RelayId?,
        rooms: [AgentOpsVisualRoom]
    ) -> RelayId? {
        let entityIds = Set(snapshot.agents.map { "agent-\($0.agentId)" } + rooms.map { "room-\($0.id)" })
        if let requested, entityIds.contains(requested) {
            return requested
        }
        if let requested, snapshot.agents.contains(where: { $0.agentId == requested }) {
            return "agent-\(requested)"
        }
        if let requested, rooms.contains(where: { $0.id == requested }) {
            return "room-\(requested)"
        }
        if let selectedAgentId = snapshot.selectedAgentIds.first(where: { id in
            snapshot.agents.contains { $0.agentId == id }
        }) {
            return "agent-\(selectedAgentId)"
        }
        return snapshot.agents.first.map { "agent-\($0.agentId)" }
    }

    private func visualRoomId(
        for state: AgentOpsLiveAgentState,
        layout: AgentOpsOperationsFloorLayout?
    ) -> RelayId {
        let trimmed = state.roomId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard let layout else {
            return trimmed.isEmpty ? fallbackRoomId(for: state.groupType) : trimmed
        }
        if !trimmed.isEmpty, layout.room(id: trimmed) != nil {
            return trimmed
        }
        if state.visibleState == .waitingForApproval, layout.room(id: "human_approval_room") != nil {
            return "human_approval_room"
        }
        if let inferred = inferredLayoutRoomId(for: state, layout: layout) {
            return inferred
        }
        switch state.groupType ?? .unassigned {
        case .business:
            return layout.room(id: "agent_monitoring_room")?.id ?? layout.rooms.first?.id ?? trimmed.nilIfEmpty ?? "agent_monitoring_room"
        case .family:
            return layout.room(id: "meeting_rooms")?.id ?? layout.rooms.first?.id ?? trimmed.nilIfEmpty ?? "meeting_rooms"
        case .personal:
            return layout.room(id: "research")?.id ?? layout.rooms.first?.id ?? trimmed.nilIfEmpty ?? "research"
        case .unassigned:
            return layout.room(id: "agent_monitoring_room")?.id ?? layout.rooms.first?.id ?? trimmed.nilIfEmpty ?? "agent_monitoring_room"
        }
    }

    private func inferredLayoutRoomId(
        for state: AgentOpsLiveAgentState,
        layout: AgentOpsOperationsFloorLayout
    ) -> RelayId? {
        let haystack = [
            state.departmentName ?? "",
            state.teamName ?? "",
            state.roomId ?? "",
            state.runtimeOverview.harnessDisplayName
        ].joined(separator: " ").lowercased()
        let keywordRooms: [(String, RelayId)] = [
            ("gap", "gapminer_office"),
            ("finance", "finance"),
            ("marketing", "marketing"),
            ("growth", "growthos_department"),
            ("youtube", "youtube_department"),
            ("copy", "copy_department"),
            ("design", "visual_design_department"),
            ("seo", "seo_department"),
            ("rank", "rankscope_seo_office"),
            ("affiliate", "affiliate_website_factory"),
            ("link", "localappconnector_department"),
            ("research", "research"),
            ("admin", "admin"),
            ("approval", "human_approval_room"),
            ("infrastructure", "mission_control_infrastructure"),
            ("monitor", "agent_monitoring_room"),
            ("director", "managing_director_office"),
            ("executive", "managing_director_office")
        ]
        return keywordRooms.first { keyword, roomId in
            haystack.contains(keyword) && layout.room(id: roomId) != nil
        }?.1
    }

    private func floorId(for groupType: AgentGroupType?) -> RelayId {
        switch groupType ?? .unassigned {
        case .business:
            return "floor-business"
        case .family:
            return "floor-family"
        case .personal:
            return "floor-personal"
        case .unassigned:
            return "floor-unassigned"
        }
    }

    private func groupType(forRoomId roomId: RelayId) -> AgentGroupType {
        switch roomId {
        case "business-floor":
            return .business
        case "family-room":
            return .family
        case "personal-desk":
            return .personal
        default:
            return .unassigned
        }
    }

    private func roomTitle(roomId: RelayId, states: [AgentOpsLiveAgentState]) -> String {
        if let team = states.compactMap(\.teamName).first {
            return team
        }
        if let department = states.compactMap(\.departmentName).first {
            return department
        }
        switch roomId {
        case "business-floor":
            return "Business"
        case "family-room":
            return "Family"
        case "personal-desk":
            return "Personal"
        case "unassigned-dock":
            return "Unassigned"
        default:
            return roomId
        }
    }

    private func roomZone(roomId: RelayId, states: [AgentOpsLiveAgentState]) -> String {
        if let groupType = states.first?.groupType {
            return groupType.rawValue
        }
        return groupType(forRoomId: roomId).rawValue
    }

    private func roomStatus(_ states: [AgentOpsLiveAgentState]) -> AgentOpsLiveState {
        let values = states.map(\.visibleState)
        if values.contains(.error) { return .error }
        if values.contains(.waitingForApproval) { return .waitingForApproval }
        if values.contains(where: { [.queued, .working, .thinking, .tooling].contains($0) }) { return .working }
        if values.contains(.idle) { return .idle }
        if values.contains(.completed) { return .completed }
        if values.contains(.offline) { return .offline }
        return .idle
    }

    private func roomBounds(index: Int, totalOnFloor: Int) -> AgentOpsVisualRect {
        let columns = totalOnFloor > 1 ? 2 : 1
        let column = index % columns
        let row = index / columns
        let width = columns == 1 ? 980.0 : 500.0
        return AgentOpsVisualRect(
            x: columns == 1 ? 110.0 : 70.0 + Double(column) * 560.0,
            y: 120.0 + Double(row) * 220.0,
            width: width,
            height: 176.0
        )
    }

    private func entityPosition(
        index: Int,
        state: AgentOpsLiveAgentState,
        room: AgentOpsVisualRoom,
        layout: AgentOpsOperationsFloorLayout?
    ) -> (point: AgentOpsVisualPoint, reason: String) {
        if layout != nil, state.visualFallbackOnly {
            let anchors = room.idleAnchors ?? []
            if let point = deterministicPoint(seed: "\(state.agentId):idle", points: anchors) {
                return (point, "visual_idle_anchor_fallback")
            }
        }
        if layout != nil, [.working, .queued, .thinking, .tooling, .waitingForApproval, .error].contains(state.visibleState) {
            let anchors = room.workstationAnchors ?? []
            if let point = deterministicPoint(seed: "\(state.agentId):work", points: anchors, fallbackIndex: index) {
                return (point, "assigned_layout_workstation")
            }
        }
        if layout != nil {
            let anchors = (room.idleAnchors ?? []) + (room.workstationAnchors ?? [])
            if let point = deterministicPoint(seed: "\(state.agentId):anchor", points: anchors, fallbackIndex: index) {
                return (point, "layout_anchor")
            }
        }
        return (entityPosition(index: index, room: room), "deterministic_rectangle_fallback")
    }

    private func entityPosition(index: Int, room: AgentOpsVisualRoom) -> AgentOpsVisualPoint {
        let column = index % 4
        let row = index / 4
        return AgentOpsVisualPoint(
            x: room.bounds.x + 68.0 + Double(column) * 104.0,
            y: room.bounds.y + 78.0 + Double(row) * 54.0
        )
    }

    private func deterministicPoint(
        seed: String,
        points: [AgentOpsVisualPoint],
        fallbackIndex: Int = 0
    ) -> AgentOpsVisualPoint? {
        guard !points.isEmpty else { return nil }
        let index = points.count == 1 ? 0 : abs(stableHash(seed)) % points.count
        return points[(index + fallbackIndex) % points.count]
    }

    private func spriteResource(for agentId: RelayId) -> (assetId: String, resourceName: String) {
        return ("office_worker_01", "office-worker-01")
    }

    private func spriteFrameRow(for state: AgentOpsLiveState) -> Double {
        switch state {
        case .working, .thinking, .tooling, .waitingForApproval:
            return 8
        case .queued, .idle, .offline:
            return 0
        case .error:
            return 8
        case .completed, .cancelled:
            return 0
        }
    }

    private func visualStatus(forLayoutRoomStatus status: String) -> AgentOpsLiveState {
        switch status {
        case "locked", "under_construction", "retired", "inactive":
            return .offline
        default:
            return .idle
        }
    }

    private func stableHash(_ value: String) -> Int {
        var result: UInt64 = 0
        for byte in value.utf8 {
            result = result &* 31 &+ UInt64(byte)
        }
        return Int(result % UInt64(Int.max))
    }

    private static func loadDefaultOperationsLayout() -> AgentOpsOperationsFloorLayout? {
        let url = Bundle.module.url(
            forResource: "default-operations-floor-layout",
            withExtension: "json",
            subdirectory: "AgentOps"
        ) ?? Bundle.module.url(
            forResource: "default-operations-floor-layout",
            withExtension: "json",
            subdirectory: "Resources/AgentOps"
        ) ?? Bundle.module.url(
            forResource: "default-operations-floor-layout",
            withExtension: "json"
        )
        guard let url else { return nil }
        do {
            return try JSONDecoder().decode(AgentOpsOperationsFloorLayout.self, from: Data(contentsOf: url))
        } catch {
            return nil
        }
    }

    private func sourceRecordIds(for state: AgentOpsLiveAgentState) -> [RelayId] {
        var ids = ["agent:\(state.agentId)"]
        if let dispatchId = state.dispatchId {
            ids.append("dispatch:\(dispatchId)")
        }
        if let taskId = state.taskId {
            ids.append("task:\(taskId)")
        }
        if let threadId = state.threadId {
            ids.append("thread:\(threadId)")
        }
        if let messageId = state.messageId {
            ids.append("message:\(messageId)")
        }
        ids.append("source:\(state.source.rawValue)")
        return ids
    }

    private func maxTimestamp(_ values: [IsoTimestamp?]) -> IsoTimestamp {
        values.compactMap { $0 }.max() ?? ISO8601DateFormatter.relayConsole.string(from: Date())
    }

    private func requireAdminAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin],
            context: context,
            message: "Reading AgentOps runtime overview requires workspace owner or admin access."
        ) {
            throw denied
        }
    }
}

private struct AgentOpsOperationsFloorLayout: Decodable {
    let id: RelayId
    let label: String
    let level: Int
    let kind: String
    let status: String
    let backgroundAssetId: String?
    let zones: [AgentOpsLayoutZone]
    let buildingId: RelayId
    let bounds: AgentOpsLayoutRect
    let waypointGraphId: RelayId

    var rooms: [AgentOpsLayoutRoom] {
        zones.flatMap(\.rooms)
    }

    func room(id: RelayId) -> AgentOpsLayoutRoom? {
        rooms.first { $0.id == id }
    }

    func zoneLabel(for zoneId: RelayId) -> String {
        zones.first { $0.id == zoneId }?.label ?? zoneId
    }
}

private struct AgentOpsLayoutZone: Decodable {
    let id: RelayId
    let floorId: RelayId
    let label: String
    let kind: String
    let bounds: AgentOpsLayoutRect
    let rooms: [AgentOpsLayoutRoom]
}

private struct AgentOpsLayoutRoom: Decodable {
    let id: RelayId
    let zoneId: RelayId
    let label: String
    let kind: String
    let departmentId: RelayId?
    let businessUnitId: RelayId?
    let currentVariantId: RelayId
    let variants: [AgentOpsLayoutRoomVariant]
    let status: String
    let capacity: Int
    let bounds: AgentOpsLayoutRect
    let entryAnchors: [AgentOpsLayoutPoint]
    let idleAnchors: [AgentOpsLayoutPoint]
    let workstations: [AgentOpsLayoutWorkstation]
    let screenAnchors: [AgentOpsLayoutScreenAnchor]
    let lightAnchors: [AgentOpsLayoutPoint]

    var activeVariant: AgentOpsLayoutRoomVariant? {
        variants.first { $0.id == currentVariantId } ?? variants.first
    }

    var activeWorkstations: [AgentOpsLayoutWorkstation] {
        let variantWorkstations = activeVariant?.workstations ?? []
        return variantWorkstations.isEmpty ? workstations : variantWorkstations
    }

    var activeScreenAnchors: [AgentOpsLayoutScreenAnchor] {
        let variantScreenAnchors = activeVariant?.screenAnchors ?? []
        return variantScreenAnchors.isEmpty ? screenAnchors : variantScreenAnchors
    }

    var activeIdleAnchors: [AgentOpsLayoutPoint] {
        let variantIdleAnchors = activeVariant?.idleAnchors ?? []
        return variantIdleAnchors.isEmpty ? idleAnchors : variantIdleAnchors
    }
}

private struct AgentOpsLayoutRoomVariant: Decodable {
    let id: RelayId
    let label: String
    let size: String
    let capacity: Int
    let workstations: [AgentOpsLayoutWorkstation]
    let screenAnchors: [AgentOpsLayoutScreenAnchor]
    let idleAnchors: [AgentOpsLayoutPoint]
    let visualTheme: String?
}

private struct AgentOpsLayoutWorkstation: Decodable {
    let id: RelayId
    let position: AgentOpsLayoutPoint
    let facing: String?
    let label: String?
}

private struct AgentOpsLayoutScreenAnchor: Decodable {
    let id: RelayId
    let position: AgentOpsLayoutPoint
    let width: Double
    let height: Double
    let theme: String?
}

private struct AgentOpsLayoutRect: Decodable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double

    var visualRect: AgentOpsVisualRect {
        AgentOpsVisualRect(x: x, y: y, width: width, height: height)
    }
}

private struct AgentOpsLayoutPoint: Decodable {
    let x: Double
    let y: Double

    var visualPoint: AgentOpsVisualPoint {
        AgentOpsVisualPoint(x: x, y: y)
    }
}

private struct AgentSignal {
    var state: AgentOpsLiveState
    var source: AgentOpsLiveStateSource
    var confidence: AgentOpsLiveStateConfidence
    var dispatchId: RelayId?
    var taskId: RelayId?
    var threadId: RelayId?
    var messageId: RelayId?
    var reason: String
    var updatedAt: IsoTimestamp?
    var visualFallbackOnly: Bool

    init(
        state: AgentOpsLiveState,
        source: AgentOpsLiveStateSource,
        confidence: AgentOpsLiveStateConfidence,
        dispatchId: RelayId? = nil,
        taskId: RelayId? = nil,
        threadId: RelayId? = nil,
        messageId: RelayId? = nil,
        reason: String,
        updatedAt: IsoTimestamp?,
        visualFallbackOnly: Bool
    ) {
        self.state = state
        self.source = source
        self.confidence = confidence
        self.dispatchId = dispatchId
        self.taskId = taskId
        self.threadId = threadId
        self.messageId = messageId
        self.reason = reason
        self.updatedAt = updatedAt
        self.visualFallbackOnly = visualFallbackOnly
    }
}

private func agentOpsStringValue(_ value: JSONValue?) -> String? {
    guard case .string(let string)? = value else {
        return nil
    }
    let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
}

private extension String {
    var nilIfEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
