import Foundation

public final class RuntimeDashboardService {
    public static let localStatusDisabledReason = "Mission Control host-control and local app process status are excluded from Swift scope."

    private let data: LocalDataService

    public init(data: LocalDataService) {
        self.data = data
    }

    public func refreshSnapshot(
        context: ServiceRequestContext,
        now: Date = Date(),
        staleAfterSeconds: Int = 300
    ) throws -> RuntimeDashboardSnapshot {
        try requireReadAccess(context: context)
        let previous = try data.latestRuntimeDashboardSnapshot(workspaceId: context.workspaceId)
        let refreshedAt = ISO8601DateFormatter.relayConsole.string(from: now)
        let rows = try dashboardRows(workspaceId: context.workspaceId, snapshotSeed: refreshedAt)
        let state = snapshotState(rows: rows)
        let snapshot = makeSnapshot(
            workspaceId: context.workspaceId,
            state: state,
            refreshedAt: refreshedAt,
            lastSuccessfulRefreshAt: [.error, .retry].contains(state) ? previous?.lastSuccessfulRefreshAt : refreshedAt,
            staleAfterSeconds: staleAfterSeconds,
            rows: rows,
            disabledReason: nil,
            errorMessage: nil,
            retryAvailable: rows.contains { $0.retryableDispatchCount > 0 },
            emptyReason: rows.isEmpty ? "No retained runtime harness, dispatch, or connected-app rows exist." : nil
        )
        return try data.saveRuntimeDashboardSnapshot(snapshot)
    }

    public func beginRefresh(
        context: ServiceRequestContext,
        now: Date = Date(),
        staleAfterSeconds: Int = 300
    ) throws -> RuntimeDashboardSnapshot {
        try requireReadAccess(context: context)
        let previous = try data.latestRuntimeDashboardSnapshot(workspaceId: context.workspaceId)
        let refreshedAt = ISO8601DateFormatter.relayConsole.string(from: now)
        let snapshot = makeSnapshot(
            workspaceId: context.workspaceId,
            state: .loading,
            refreshedAt: refreshedAt,
            lastSuccessfulRefreshAt: previous?.lastSuccessfulRefreshAt,
            staleAfterSeconds: staleAfterSeconds,
            rows: previous?.rows ?? [],
            disabledReason: nil,
            errorMessage: nil,
            retryAvailable: false,
            emptyReason: previous?.rows.isEmpty == false ? nil : "Runtime dashboard refresh is loading retained local records."
        )
        return try data.saveRuntimeDashboardSnapshot(snapshot)
    }

    public func recordRefreshFailure(
        context: ServiceRequestContext,
        message: String,
        retryable: Bool,
        now: Date = Date(),
        staleAfterSeconds: Int = 300
    ) throws -> RuntimeDashboardSnapshot {
        try requireReadAccess(context: context)
        let previous = try data.latestRuntimeDashboardSnapshot(workspaceId: context.workspaceId)
        let refreshedAt = ISO8601DateFormatter.relayConsole.string(from: now)
        let snapshot = makeSnapshot(
            workspaceId: context.workspaceId,
            state: retryable ? .retry : .error,
            refreshedAt: refreshedAt,
            lastSuccessfulRefreshAt: previous?.lastSuccessfulRefreshAt,
            staleAfterSeconds: staleAfterSeconds,
            rows: previous?.rows ?? [],
            disabledReason: nil,
            errorMessage: redactString(message),
            retryAvailable: retryable,
            emptyReason: previous?.rows.isEmpty == false ? nil : "Runtime dashboard refresh failed before rows were available."
        )
        return try data.saveRuntimeDashboardSnapshot(snapshot)
    }

    public func markLocalStatusDisabled(
        context: ServiceRequestContext,
        reason: String = RuntimeDashboardService.localStatusDisabledReason,
        now: Date = Date(),
        staleAfterSeconds: Int = 300
    ) throws -> RuntimeDashboardSnapshot {
        try requireReadAccess(context: context)
        let previous = try data.latestRuntimeDashboardSnapshot(workspaceId: context.workspaceId)
        let refreshedAt = ISO8601DateFormatter.relayConsole.string(from: now)
        let snapshot = makeSnapshot(
            workspaceId: context.workspaceId,
            state: .disabled,
            refreshedAt: refreshedAt,
            lastSuccessfulRefreshAt: previous?.lastSuccessfulRefreshAt,
            staleAfterSeconds: staleAfterSeconds,
            rows: previous?.rows ?? [],
            disabledReason: reason,
            errorMessage: nil,
            retryAvailable: false,
            emptyReason: previous?.rows.isEmpty == false ? nil : "Local host-control status is disabled and no retained runtime rows exist."
        )
        return try data.saveRuntimeDashboardSnapshot(snapshot)
    }

    public func latestSnapshot(
        context: ServiceRequestContext,
        now: Date = Date(),
        staleAfterSeconds: Int = 300
    ) throws -> RuntimeDashboardSnapshot? {
        try requireReadAccess(context: context)
        guard var snapshot = try data.latestRuntimeDashboardSnapshot(workspaceId: context.workspaceId) else {
            return nil
        }
        guard let lastSuccess = snapshot.lastSuccessfulRefreshAt.flatMap(Self.parseIso),
              now.timeIntervalSince(lastSuccess) > Double(staleAfterSeconds),
              ![.loading, .disabled].contains(snapshot.state)
        else {
            return snapshot
        }
        snapshot.state = .stale
        snapshot.staleAfterSeconds = staleAfterSeconds
        snapshot.retryAvailable = true
        snapshot.localStatusReason = Self.localStatusDisabledReason
        return snapshot
    }

    private func dashboardRows(workspaceId: RelayId, snapshotSeed: String) throws -> [RuntimeDashboardRow] {
        let agents = try data.listAgents(workspaceId: workspaceId)
            .filter { [.hermes, .openclaw].contains($0.harness.runtimeType) }
        let harnesses = try data.listHarnesses()
            .filter { [.hermes, .openclaw].contains($0.runtimeType) }
            .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
        let threads = try data.listThreads(workspaceId: workspaceId)
        let dispatches = try threads.flatMap { try data.listDispatchesForThread($0.id) }
        let events = try data.queryEventLog(limit: 500)
        return harnesses.compactMap { harness in
            let harnessDispatches = dispatches.filter { $0.harnessId == harness.id }
            let harnessDispatchIds = Set(harnessDispatches.map(\.id))
            let harnessEvents = events.filter { event in
                event.harnessId == harness.id || event.dispatchId.map { harnessDispatchIds.contains($0) } == true
            }
            let assignedAgents = agents.filter { $0.harness.id == harness.id }
            let row = runtimeRow(
                harness: harness,
                agents: assignedAgents,
                dispatches: harnessDispatches,
                events: harnessEvents,
                snapshotSeed: snapshotSeed
            )
            if stringValue(harness.config["installPath"]) == nil,
               assignedAgents.isEmpty,
               harnessDispatches.isEmpty {
                return nil
            }
            return row
        }
    }

    private func runtimeRow(
        harness: Harness,
        agents: [AgentWithBinding],
        dispatches: [RuntimeDispatch],
        events: [LogEvent],
        snapshotSeed: String
    ) -> RuntimeDashboardRow {
        let status = rowStatus(harness: harness, dispatches: dispatches)
        let activeDispatches = dispatches.filter(\.isActive)
        let failedDispatches = dispatches.filter { $0.status == .failed }
        let retryableDispatches = failedDispatches.filter(\.retryable)
        let latestDispatch = dispatches.sorted { $0.updatedAt > $1.updatedAt }.first
        let latestEvent = events.sorted { $0.timestamp > $1.timestamp }.first
        let assigned = agents
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            .map {
                RuntimeDashboardAssignedAgentIndicator(
                    agentId: $0.id,
                    displayName: $0.name,
                    runtimeType: $0.harness.runtimeType,
                    status: $0.status
                )
            }
        return RuntimeDashboardRow(
            id: "rdr-\(stableToken(snapshotSeed))-\(harness.id)",
            kind: .runtimeHarness,
            runtimeType: harness.runtimeType,
            harnessId: harness.id,
            connectedAppId: nil,
            displayName: harness.displayName,
            status: status,
            statusLabel: label(for: status),
            detail: detail(for: status, harness: harness, activeDispatchCount: activeDispatches.count),
            reachability: reachability(for: status),
            assignedAgents: assigned,
            activeDispatchCount: activeDispatches.count,
            failedDispatchCount: failedDispatches.count,
            retryableDispatchCount: retryableDispatches.count,
            latestDispatchId: latestDispatch?.id,
            lastActivityAt: maxTimestamp([latestDispatch?.updatedAt, latestEvent?.timestamp, harness.updatedAt]),
            redactionStatus: "paths-and-command-env-excluded",
            source: "harnesses,runtime_bindings,runtime_dispatches,event_log"
        )
    }

    private func snapshotState(rows: [RuntimeDashboardRow]) -> RuntimeDashboardSnapshotState {
        guard !rows.isEmpty else { return .empty }
        if rows.contains(where: { $0.retryableDispatchCount > 0 }) {
            return .retry
        }
        if rows.contains(where: { $0.failedDispatchCount > 0 }) {
            return .error
        }
        if rows.allSatisfy({ [.offline, .missing, .authRequired].contains($0.status) }) {
            return .offline
        }
        return .populated
    }

    private func rowStatus(harness: Harness, dispatches: [RuntimeDispatch]) -> RuntimeDashboardRowStatus {
        if dispatches.contains(where: \.isActive) {
            return .active
        }
        if dispatches.contains(where: { $0.status == .failed }) {
            return .failed
        }
        let lifecycle = stringValue(harness.config["lifecycleState"]).flatMap(HarnessLifecycleState.init(rawValue:))
        let auth = stringValue(harness.config["modelAuthStatus"]).flatMap(HarnessModelAuthStatus.init(rawValue:))
        if lifecycle == .authRequired || auth == .notConfigured || auth == .failed {
            return .authRequired
        }
        if lifecycle == .notInstalled || lifecycle == .error || harness.status != "active" {
            return lifecycle == .notInstalled ? .missing : .offline
        }
        if lifecycle == .connected && auth == .connected {
            return .connected
        }
        if lifecycle == .installed || lifecycle == .starting || auth == .checking {
            return .degraded
        }
        return .idle
    }

    private func label(for status: RuntimeDashboardRowStatus) -> String {
        switch status {
        case .connected: return "Connected"
        case .degraded: return "Partial"
        case .offline: return "Offline"
        case .authRequired: return "Auth required"
        case .missing: return "Missing"
        case .active: return "Active"
        case .failed: return "Errored"
        case .idle: return "Idle"
        }
    }

    private func detail(for status: RuntimeDashboardRowStatus, harness: Harness, activeDispatchCount: Int) -> String {
        if activeDispatchCount > 0 {
            return "\(activeDispatchCount) retained dispatch\(activeDispatchCount == 1 ? "" : "es") active."
        }
        switch status {
        case .connected:
            return "\(harness.displayName) is ready for retained runtime dispatches."
        case .degraded:
            return "\(harness.displayName) has partial setup or is still starting."
        case .offline:
            return "\(harness.displayName) is offline or not ready."
        case .authRequired:
            return "Sign in to OpenAI through \(harness.displayName)."
        case .missing:
            return "\(harness.displayName) is not installed."
        case .active:
            return "\(harness.displayName) is processing retained runtime work."
        case .failed:
            return "\(harness.displayName) has a retained runtime failure."
        case .idle:
            return "\(harness.displayName) has no active retained runtime work."
        }
    }

    private func reachability(for status: RuntimeDashboardRowStatus) -> RuntimeDashboardReachability {
        switch status {
        case .connected, .active:
            return .reachable
        case .offline, .missing, .authRequired, .failed:
            return .unreachable
        case .degraded, .idle:
            return .unknown
        }
    }

    private func makeSnapshot(
        workspaceId: RelayId,
        state: RuntimeDashboardSnapshotState,
        refreshedAt: IsoTimestamp,
        lastSuccessfulRefreshAt: IsoTimestamp?,
        staleAfterSeconds: Int,
        rows: [RuntimeDashboardRow],
        disabledReason: String?,
        errorMessage: String?,
        retryAvailable: Bool,
        emptyReason: String?
    ) -> RuntimeDashboardSnapshot {
        RuntimeDashboardSnapshot(
            id: createRelayId("rds"),
            workspaceId: workspaceId,
            state: state,
            refreshedAt: refreshedAt,
            lastSuccessfulRefreshAt: lastSuccessfulRefreshAt,
            staleAfterSeconds: max(staleAfterSeconds, 1),
            localStatusState: .disabled,
            localStatusReason: Self.localStatusDisabledReason,
            disabledReason: disabledReason,
            errorMessage: errorMessage.map(redactString),
            retryAvailable: retryAvailable,
            readOnly: true,
            rows: rows,
            connectedAppCount: rows.filter { $0.kind == .connectedApp }.count,
            runtimeRowCount: rows.filter { $0.kind == .runtimeHarness }.count,
            activeDispatchCount: rows.reduce(0) { $0 + $1.activeDispatchCount },
            failedDispatchCount: rows.reduce(0) { $0 + $1.failedDispatchCount },
            retryableDispatchCount: rows.reduce(0) { $0 + $1.retryableDispatchCount },
            emptyReason: emptyReason,
            derivedFrom: ["harnesses", "runtime_bindings", "runtime_dispatches", "event_log"],
            redactionStatus: "private-paths-secrets-command-env-excluded"
        )
    }

    private func requireReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member],
            context: context,
            message: "Reading runtime dashboard snapshots requires workspace access."
        ) {
            throw denied
        }
    }

    private static func parseIso(_ value: String) -> Date? {
        ISO8601DateFormatter.relayConsole.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    private func maxTimestamp(_ values: [IsoTimestamp?]) -> IsoTimestamp {
        values.compactMap { $0 }.max() ?? ISO8601DateFormatter.relayConsole.string(from: Date())
    }

    private func stableToken(_ value: String) -> String {
        value
            .replacingOccurrences(of: ":", with: "")
            .replacingOccurrences(of: "-", with: "")
            .replacingOccurrences(of: ".", with: "")
            .replacingOccurrences(of: "Z", with: "z")
    }
}
