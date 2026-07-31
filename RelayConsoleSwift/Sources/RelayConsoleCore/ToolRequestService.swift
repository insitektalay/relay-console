import Foundation

public final class ToolRequestService {
    private let data: LocalDataService
    private let permissions: PermissionPolicyService?
    private let auditSecurity: AuditSecurityService?

    public init(
        data: LocalDataService,
        permissions: PermissionPolicyService? = nil,
        auditSecurity: AuditSecurityService? = nil
    ) {
        self.data = data
        self.permissions = permissions
        self.auditSecurity = auditSecurity
    }

    @discardableResult
    public func reportMissingTool(
        context: ServiceRequestContext,
        requestedCapability: String,
        appIdOrSlug: RelayId? = nil,
        agentId: RelayId? = nil,
        threadId: RelayId? = nil,
        dispatchId: RelayId? = nil,
        missingToolEventId: RelayId? = nil,
        relatedTaskId: RelayId? = nil,
        relatedRecordId: RelayId? = nil,
        campaign: String? = nil,
        reason: String,
        requiredAction: String,
        evidence: String? = nil,
        policyAllowed: Bool = true,
        metadata: JSONRecord = [:],
        now: Date = Date()
    ) throws -> ToolRequestRecord? {
        try requireReportAccess(context: context)

        let trimmedCapability = requestedCapability.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedCapability.isEmpty else {
            throw ServiceGuard.invalidInput(context: context, message: "Needed Tools requests require a capability name.")
        }
        let normalizedCapability = Self.normalizeCapability(trimmedCapability)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let app = try appIdOrSlug.flatMap { try requireRetainedApp(context: context, appIdOrSlug: $0) }
        let agent = try agentId.flatMap { try data.getAgent($0) }
        if let agent, agent.workspaceId != context.workspaceId {
            throw ServiceGuard.invalidInput(context: context, message: "Needed Tools request agent workspace does not match the request context.")
        }
        if let missingToolEventId {
            let matchingEvent = try data.listRuntimeMissingToolEvents(workspaceId: context.workspaceId, limit: 500)
                .first { $0.id == missingToolEventId }
            guard matchingEvent != nil else {
                throw ServiceGuard.invalidInput(context: context, message: "Missing-tool evidence record was not found in this workspace.")
            }
        }
        guard policyAllowed else {
            recordAudit(
                context: context,
                eventType: "tool_request.policy_denied",
                severity: "warning",
                message: "Needed Tools request was not persisted because policy disallowed it.",
                request: nil,
                normalizedCapability: normalizedCapability,
                app: app,
                relatedTaskId: relatedTaskId,
                relatedRecordId: relatedRecordId,
                missingToolEventId: missingToolEventId,
                status: .rejected,
                action: "report",
                now: now
            )
            return nil
        }
        try requirePermission(
            context: context,
            resourceType: "tool_request",
            resourceId: app?.id ?? relatedRecordId,
            action: "report",
            detail: permissionDetail(
                action: "report",
                normalizedCapability: normalizedCapability,
                app: app,
                relatedTaskId: relatedTaskId,
                relatedRecordId: relatedRecordId,
                missingToolEventId: missingToolEventId
            )
        )

        let derived = try derivedAvailability(
            context: context,
            normalizedCapability: normalizedCapability,
            app: app,
            agentId: agentId
        )
        let baseMetadata = metadataWithContinuation(
            guardedMetadata(metadata),
            normalizedCapability: normalizedCapability,
            relatedTaskId: relatedTaskId,
            relatedRecordId: relatedRecordId,
            dispatchId: dispatchId,
            missingToolEventId: missingToolEventId
        )
        let existing = try findOpenRequest(
            context: context,
            normalizedCapability: normalizedCapability,
            appId: app?.id,
            appSlug: app?.slug,
            agentId: agentId,
            relatedRecordId: relatedRecordId
        )

        if var request = existing {
            request.requestedCapability = trimmedCapability
            request.reason = reason
            request.requiredAction = requiredAction
            request.evidence = evidence ?? request.evidence
            request.campaign = campaign ?? request.campaign
            request.threadId = threadId ?? request.threadId
            request.dispatchId = dispatchId ?? request.dispatchId
            request.missingToolEventId = missingToolEventId ?? request.missingToolEventId
            request.relatedTaskId = relatedTaskId ?? request.relatedTaskId
            request.relatedRecordId = relatedRecordId ?? request.relatedRecordId
            request.agentName = agent?.name ?? request.agentName
            request.status = refreshedStatus(current: request.status, derived: derived.status)
            request.toolAvailable = derived.toolAvailable
            request.toolConnected = derived.toolConnected
            request.toolGranted = derived.toolGranted
            request.availabilityState = derived.availabilityState
            request.suggestedApps = derived.suggestedApps
            request.metadata = request.metadata.merging(baseMetadata) { _, new in new }
            request.lastSeenAt = timestamp
            request.resolvedAt = nil
            request.updatedByActorId = context.actorId
            let saved = try data.saveToolRequest(request)
            recordAudit(
                context: context,
                eventType: "tool_request.updated",
                message: "Needed Tools request refreshed from runtime report.",
                request: saved,
                action: "report",
                now: now
            )
            return saved
        }

        let request = ToolRequestRecord(
            id: createRelayId("treq"),
            workspaceId: context.workspaceId,
            requestedCapability: trimmedCapability,
            normalizedCapability: normalizedCapability,
            appId: app?.id,
            appSlug: app?.slug,
            agentId: agentId,
            agentName: agent?.name,
            threadId: threadId,
            dispatchId: dispatchId,
            missingToolEventId: missingToolEventId,
            relatedTaskId: relatedTaskId,
            relatedRecordId: relatedRecordId,
            campaign: campaign,
            reason: reason,
            requiredAction: requiredAction,
            evidence: evidence,
            status: derived.status,
            policyAllowed: true,
            toolAvailable: derived.toolAvailable,
            toolConnected: derived.toolConnected,
            toolGranted: derived.toolGranted,
            availabilityState: derived.availabilityState,
            suggestedApps: derived.suggestedApps,
            metadata: baseMetadata,
            requestedAt: timestamp,
            lastSeenAt: timestamp,
            resolvedAt: nil,
            resolutionNote: nil,
            createdByActorId: context.actorId,
            updatedByActorId: context.actorId,
            redactionStatus: "private-state-excluded"
        )
        let saved = try data.saveToolRequest(request)
        recordAudit(
            context: context,
            eventType: "tool_request.reported",
            message: "Needed Tools request recorded from missing capability.",
            request: saved,
            action: "report",
            now: now
        )
        return saved
    }

    @discardableResult
    public func updateStatus(
        context: ServiceRequestContext,
        requestId: RelayId,
        status: ToolRequestStatus,
        resolutionNote: String? = nil,
        now: Date = Date()
    ) throws -> ToolRequestRecord {
        try requireAdminAccess(context: context)
        guard var request = try data.getToolRequest(workspaceId: context.workspaceId, requestId: requestId) else {
            throw ServiceGuard.invalidInput(context: context, message: "Needed Tools request was not found.")
        }
        guard Self.adminSettableStatuses.contains(status) else {
            throw ServiceGuard.invalidInput(
                context: context,
                message: "Needed Tools cannot manually grant or connect tools; those states must come from provider records."
            )
        }
        try requirePermission(
            context: context,
            resourceType: "tool_request",
            resourceId: request.id,
            action: "update",
            detail: permissionDetail(action: "update", request: request, status: status)
        )
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let previousStatus = request.status
        request.status = status
        request.resolutionNote = resolutionNote
        request.updatedByActorId = context.actorId
        request.lastSeenAt = timestamp
        switch status {
        case .dismissed, .ignored, .resolved, .rejected:
            request.resolvedAt = timestamp
        case .unavailable:
            request.availabilityState = .unavailable
            request.toolAvailable = false
            request.resolvedAt = nil
        case .requested:
            request.resolvedAt = nil
        case .connected, .granted:
            break
        }
        let saved = try data.saveToolRequest(request)
        recordAudit(
            context: context,
            eventType: "tool_request.status_changed",
            message: "Needed Tools request status changed.",
            request: saved,
            action: "update",
            extra: [
                "previousStatus": .string(previousStatus.rawValue),
                "nextStatus": .string(status.rawValue)
            ],
            now: now
        )
        return saved
    }

    public func snapshot(
        context: ServiceRequestContext,
        appIdOrSlug: RelayId? = nil,
        queryStatus: String = "open",
        selectedRequestId: RelayId? = nil,
        now: Date = Date()
    ) throws -> NeededToolsSnapshot {
        try requireReadAccess(context: context)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let selectedApp = try appIdOrSlug.flatMap {
            try data.getMarketplaceCatalogApp(workspaceId: context.workspaceId, appIdOrSlug: $0)
        }
        try requirePermission(
            context: context,
            resourceType: "tool_request",
            resourceId: selectedApp?.id,
            action: "read",
            detail: [
                "action": .string("read"),
                "appId": jsonString(selectedApp?.id),
                "appSlug": jsonString(selectedApp?.slug),
                "queryStatus": .string(queryStatus)
            ]
        )
        let readOnly = !context.hasAnyRole([.owner, .admin])
        if let selectedApp, !isRetainedApp(selectedApp) {
            let summary = NeededToolsSummary(
                workspaceId: context.workspaceId,
                appId: selectedApp.id,
                appSlug: selectedApp.slug,
                queryStatus: queryStatus,
                openRequestCount: 0,
                connectedCount: 0,
                grantedCount: 0,
                unavailableCount: 0,
                dismissedCount: 0,
                resolvedCount: 0,
                suggestedAppCount: 0,
                generatedAt: timestamp,
                redactionStatus: "private-state-excluded"
            )
            return try data.saveNeededToolsSnapshot(NeededToolsSnapshot(
                workspaceId: context.workspaceId,
                appId: selectedApp.id,
                appSlug: selectedApp.slug,
                state: .unavailable,
                refreshedAt: timestamp,
                queryStatus: queryStatus,
                requests: [],
                selectedRequest: nil,
                summary: summary,
                diagnostics: diagnostics(summary: summary, state: .unavailable),
                readOnly: readOnly,
                redactionStatus: "private-state-excluded"
            ))
        }

        let app = selectedApp
        let allRequests = try data.listToolRequests(workspaceId: context.workspaceId, appId: app?.id, limit: 500)
        let refreshedRequests = try allRequests.map { try refreshDerivedState(context: context, request: $0) }
        let visibleRequests = refreshedRequests.filter { matches(queryStatus: queryStatus, request: $0) }
        let selected = selectedRequestId.flatMap { id in
            visibleRequests.first { $0.id == id }
        } ?? visibleRequests.first
        let suggestedAppCount = Set(visibleRequests.flatMap { $0.suggestedApps.map(\.id) }).count
        let summary = NeededToolsSummary(
            workspaceId: context.workspaceId,
            appId: app?.id,
            appSlug: app?.slug,
            queryStatus: queryStatus,
            openRequestCount: visibleRequests.filter { Self.isOpenStatus($0.status) }.count,
            connectedCount: visibleRequests.filter { $0.status == .connected || $0.availabilityState == .connected }.count,
            grantedCount: visibleRequests.filter { $0.status == .granted || $0.availabilityState == .granted }.count,
            unavailableCount: visibleRequests.filter { $0.status == .unavailable || $0.availabilityState == .unavailable }.count,
            dismissedCount: visibleRequests.filter { $0.status == .dismissed || $0.status == .ignored }.count,
            resolvedCount: visibleRequests.filter { $0.status == .resolved || $0.status == .rejected }.count,
            suggestedAppCount: suggestedAppCount,
            generatedAt: timestamp,
            redactionStatus: "private-state-excluded"
        )
        let state: NeededToolsSnapshotState
        if readOnly, !visibleRequests.isEmpty {
            state = .readOnly
        } else if visibleRequests.isEmpty {
            state = .empty
        } else {
            state = .ready
        }
        return try data.saveNeededToolsSnapshot(NeededToolsSnapshot(
            workspaceId: context.workspaceId,
            appId: app?.id,
            appSlug: app?.slug,
            state: state,
            refreshedAt: timestamp,
            queryStatus: queryStatus,
            requests: visibleRequests,
            selectedRequest: selected,
            summary: summary,
            diagnostics: diagnostics(summary: summary, state: state),
            readOnly: readOnly,
            redactionStatus: "private-state-excluded"
        ))
    }

    public func latestSnapshot(context: ServiceRequestContext, appId: RelayId? = nil) throws -> NeededToolsSnapshot? {
        try requireReadAccess(context: context)
        try requirePermission(
            context: context,
            resourceType: "tool_request",
            resourceId: appId,
            action: "read",
            detail: [
                "action": .string("read_latest_snapshot"),
                "appId": jsonString(appId)
            ]
        )
        return try data.latestNeededToolsSnapshot(workspaceId: context.workspaceId, appId: appId)
    }

    public static func normalizeCapability(_ capability: String) -> String {
        let normalized = capability
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: #"[^a-z0-9]+"#, with: "_", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
        return capabilityAliases[normalized] ?? normalized
    }

    public static func statusTitle(for request: ToolRequestRecord) -> String {
        switch request.status {
        case .requested:
            return request.toolAvailable ? "Requested" : "Missing executable tool"
        case .connected:
            return "Connected"
        case .granted:
            return "Granted"
        case .unavailable:
            return "Unavailable"
        case .dismissed:
            return "Dismissed"
        case .ignored:
            return "Ignored"
        case .resolved:
            return "Resolved"
        case .rejected:
            return "Rejected"
        }
    }

    public static func availabilityTitle(for request: ToolRequestRecord) -> String {
        switch request.availabilityState {
        case .unknown:
            return "Unknown"
        case .notConnected:
            return "Not connected"
        case .connected:
            return "Connected"
        case .granted:
            return "Granted"
        case .unavailable:
            return "Unavailable"
        }
    }

    public static func exportLines(for snapshot: NeededToolsSnapshot, appName: String?) -> [String] {
        var lines = [
            "Needed Tools for \(appName ?? snapshot.appSlug ?? "workspace")",
            "Open requests: \(snapshot.summary.openRequestCount)",
            "Query status: \(snapshot.queryStatus)"
        ]
        for request in snapshot.requests {
            lines.append("Status: \(statusTitle(for: request))")
            lines.append("Capability: \(request.normalizedCapability)")
            lines.append("Reason: \(request.reason)")
            lines.append("Action: \(request.requiredAction)")
            lines.append("Campaign: \(request.campaign ?? "Unassigned")")
            lines.append("Suggested: \(request.suggestedApps.map(\.appName).joined(separator: ", "))")
            lines.append("Tool state: \(availabilityTitle(for: request))")
            lines.append("Agent: \(request.agentName ?? request.agentId ?? "Unassigned")")
            lines.append("Mode: source-backed retained tool request")
            lines.append("Related task: \(request.relatedTaskId ?? "None")")
            lines.append("Related record: \(request.relatedRecordId ?? "None")")
            lines.append("Continuation: \(continuationTitle(for: request))")
        }
        return lines
    }

    public static func continuationTitle(for request: ToolRequestRecord) -> String {
        request.metadata["continuationNote"]?.string
            ?? request.metadata["scheduledContinuationStatus"]?.string
            ?? "None"
    }

    private func requireReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member],
            context: context,
            message: "Reading Needed Tools requests requires workspace access."
        ) {
            throw denied
        }
    }

    private func requireReportAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .operator],
            context: context,
            message: "Recording Needed Tools requests requires operator access."
        ) {
            throw denied
        }
    }

    private func requireAdminAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin],
            context: context,
            message: "Changing Needed Tools request state requires admin access."
        ) {
            throw denied
        }
    }

    private func requirePermission(
        context: ServiceRequestContext,
        resourceType: String,
        resourceId: RelayId? = nil,
        action: String,
        detail: JSONRecord
    ) throws {
        try permissions?.requireAllowed(
            context: context,
            resourceType: resourceType,
            resourceId: resourceId,
            action: action,
            detail: detail
        )
    }

    private func requireRetainedApp(context: ServiceRequestContext, appIdOrSlug: RelayId) throws -> MarketplaceCatalogApp {
        guard let app = try data.getMarketplaceCatalogApp(workspaceId: context.workspaceId, appIdOrSlug: appIdOrSlug) else {
            throw ServiceGuard.invalidInput(context: context, message: "Needed Tools request app was not found.")
        }
        guard isRetainedApp(app) else {
            throw ServiceGuard.invalidInput(context: context, message: "Paperclip and local app tool requests are excluded unless explicitly reinstated.")
        }
        return app
    }

    private func findOpenRequest(
        context: ServiceRequestContext,
        normalizedCapability: String,
        appId: RelayId?,
        appSlug: String?,
        agentId: RelayId?,
        relatedRecordId: RelayId?
    ) throws -> ToolRequestRecord? {
        let requests = try data.listToolRequests(workspaceId: context.workspaceId, appId: appId, appSlug: appId == nil ? appSlug : nil, limit: 500)
        return requests.first { request in
            Self.isOpenStatus(request.status)
                && request.normalizedCapability == normalizedCapability
                && request.appId == appId
                && request.agentId == agentId
                && request.relatedRecordId == relatedRecordId
        }
    }

    private func refreshDerivedState(context: ServiceRequestContext, request: ToolRequestRecord) throws -> ToolRequestRecord {
        guard Self.isOpenStatus(request.status) else { return request }
        let app = try request.appId.flatMap {
            try data.getMarketplaceCatalogApp(workspaceId: context.workspaceId, appIdOrSlug: $0)
        } ?? request.appSlug.flatMap {
            try data.getMarketplaceCatalogApp(workspaceId: context.workspaceId, appIdOrSlug: $0)
        }
        let derived = try derivedAvailability(
            context: context,
            normalizedCapability: request.normalizedCapability,
            app: app.flatMap { isRetainedApp($0) ? $0 : nil },
            agentId: request.agentId
        )
        var updated = request
        updated.status = refreshedStatus(current: request.status, derived: derived.status)
        updated.toolAvailable = derived.toolAvailable
        updated.toolConnected = derived.toolConnected
        updated.toolGranted = derived.toolGranted
        updated.availabilityState = derived.availabilityState
        updated.suggestedApps = derived.suggestedApps
        guard updated != request else { return request }
        updated.updatedByActorId = context.actorId
        return try data.saveToolRequest(updated)
    }

    private func refreshedStatus(current: ToolRequestStatus, derived: ToolRequestStatus) -> ToolRequestStatus {
        guard Self.isOpenStatus(current) else { return current }
        if derived == .granted || derived == .connected { return derived }
        if current == .unavailable { return .unavailable }
        return derived
    }

    private func derivedAvailability(
        context: ServiceRequestContext,
        normalizedCapability: String,
        app: MarketplaceCatalogApp?,
        agentId: RelayId?
    ) throws -> DerivedToolAvailability {
        let suggestions = try suggestedApps(
            context: context,
            normalizedCapability: normalizedCapability,
            selectedApp: app,
            agentId: agentId
        )
        let toolGranted = suggestions.contains { $0.availabilityState == .granted }
        let toolConnected = suggestions.contains { $0.availabilityState == .connected || $0.availabilityState == .granted }
        let toolAvailable = suggestions.contains { $0.availabilityState != .unavailable }
        let availability: ToolRequestAvailabilityState
        if toolGranted {
            availability = .granted
        } else if toolConnected {
            availability = .connected
        } else if toolAvailable {
            availability = .notConnected
        } else {
            availability = .unavailable
        }
        let status: ToolRequestStatus = toolGranted ? .granted : (toolConnected ? .connected : .requested)
        return DerivedToolAvailability(
            status: status,
            availabilityState: availability,
            toolAvailable: toolAvailable,
            toolConnected: toolConnected,
            toolGranted: toolGranted,
            suggestedApps: suggestions
        )
    }

    private func suggestedApps(
        context: ServiceRequestContext,
        normalizedCapability: String,
        selectedApp: MarketplaceCatalogApp?,
        agentId: RelayId?
    ) throws -> [ToolRequestSuggestedApp] {
        let apps: [MarketplaceCatalogApp]
        if let selectedApp {
            apps = [selectedApp]
        } else {
            apps = try data.listMarketplaceCatalogApps(workspaceId: context.workspaceId)
        }
        return try apps
            .filter(isRetainedApp)
            .filter { app in
                app.capabilities.map(Self.normalizeCapability).contains(normalizedCapability)
            }
            .map { app in
                let connections = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
                let connected = connections.contains(where: Self.connectionIsUsable)
                let installs = try data.listMarketplaceInstalls(workspaceId: context.workspaceId, appId: app.id)
                let activeInstalls = installs.filter(Self.isActiveInstall)
                let matchingGrant = activeInstalls.contains { install in
                    (agentId == nil || install.agentId == agentId)
                        && install.selectedCapabilities.map(Self.normalizeCapability).contains(normalizedCapability)
                }
                let activeInstallExists = !activeInstalls.isEmpty
                let state: ToolRequestAvailabilityState
                if matchingGrant {
                    state = .granted
                } else if connected {
                    state = .connected
                } else if app.availability == .available {
                    state = .notConnected
                } else {
                    state = .unavailable
                }
                return ToolRequestSuggestedApp(
                    appId: app.id,
                    appSlug: app.slug,
                    appName: app.name,
                    category: app.category,
                    connectionState: connected ? .connected : app.connectionState,
                    installState: activeInstallExists ? .installed : app.installState,
                    availabilityState: state,
                    matchingCapabilities: app.capabilities.filter { Self.normalizeCapability($0) == normalizedCapability },
                    guidance: guidance(for: state, app: app),
                    redactionStatus: "private-state-excluded"
                )
            }
    }

    private func matches(queryStatus: String, request: ToolRequestRecord) -> Bool {
        let normalized = queryStatus.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalized.isEmpty || normalized == "all" { return true }
        if normalized == "open" { return Self.isOpenStatus(request.status) }
        if normalized == "connected_or_granted" {
            return request.status == .connected || request.status == .granted
        }
        return ToolRequestStatus(rawValue: normalized).map { request.status == $0 } ?? true
    }

    private func diagnostics(summary: NeededToolsSummary, state: NeededToolsSnapshotState) -> NeededToolsDiagnostics {
        let message: String
        switch state {
        case .empty:
            message = "No needed tool requests for this provider app."
        case .readOnly:
            message = "Read-only Needed Tools summary."
        case .unavailable:
            message = "Needed Tools are unavailable for excluded local app or Paperclip flows."
        case .ready:
            message = "Policy allows this, but no executable tool is connected or granted."
        case .loading:
            message = "Loading Needed Tools requests."
        case .error:
            message = "Needed Tools requests could not be loaded."
        }
        return NeededToolsDiagnostics(
            openSummary: "\(summary.openRequestCount) open request\(summary.openRequestCount == 1 ? "" : "s")",
            connectionSummary: "\(summary.connectedCount) connected",
            grantSummary: "\(summary.grantedCount) granted",
            unavailableSummary: "\(summary.unavailableCount) unavailable",
            message: message
        )
    }

    private func guardedMetadata(_ metadata: JSONRecord) -> JSONRecord {
        metadata.merging([
            "autoInstallAttempted": .bool(false),
            "autoGrantCreated": .bool(false),
            "localFileAccessAttempted": .bool(false),
            "paperclipExcluded": .bool(true),
            "source": .string("tool-request-service")
        ]) { current, _ in current }
    }

    private func metadataWithContinuation(
        _ metadata: JSONRecord,
        normalizedCapability: String,
        relatedTaskId: RelayId?,
        relatedRecordId: RelayId?,
        dispatchId: RelayId?,
        missingToolEventId: RelayId?
    ) -> JSONRecord {
        let hasContinuation = relatedTaskId != nil
            || metadata["scheduledContinuationId"] != nil
            || metadata["continuationId"] != nil
            || metadata["scheduledContinuationStatus"] != nil
        guard hasContinuation else { return metadata }
        var next = metadata
        if next["scheduledContinuationStatus"] == nil {
            next["scheduledContinuationStatus"] = .string("waiting_on_capability")
        }
        if next["continuationWaitsOnCapability"] == nil {
            next["continuationWaitsOnCapability"] = .string(normalizedCapability)
        }
        if next["continuationNote"] == nil {
            next["continuationNote"] = .string("Scheduled continuation waits on \(normalizedCapability) capability resolution.")
        }
        if let relatedTaskId, next["continuationRelatedTaskId"] == nil {
            next["continuationRelatedTaskId"] = .string(relatedTaskId)
        }
        if let relatedRecordId, next["continuationRelatedRecordId"] == nil {
            next["continuationRelatedRecordId"] = .string(relatedRecordId)
        }
        if let dispatchId, next["continuationDispatchId"] == nil {
            next["continuationDispatchId"] = .string(dispatchId)
        }
        if let missingToolEventId, next["continuationMissingToolEventId"] == nil {
            next["continuationMissingToolEventId"] = .string(missingToolEventId)
        }
        next["noExecutableWork"] = next["noExecutableWork"] ?? .bool(true)
        return next
    }

    private func permissionDetail(
        action: String,
        normalizedCapability: String,
        app: MarketplaceCatalogApp?,
        relatedTaskId: RelayId?,
        relatedRecordId: RelayId?,
        missingToolEventId: RelayId?
    ) -> JSONRecord {
        [
            "action": .string(action),
            "normalizedCapability": .string(normalizedCapability),
            "appId": jsonString(app?.id),
            "appSlug": jsonString(app?.slug),
            "relatedTaskId": jsonString(relatedTaskId),
            "relatedRecordId": jsonString(relatedRecordId),
            "missingToolEventId": jsonString(missingToolEventId),
            "autoInstallAttempted": .bool(false),
            "autoGrantCreated": .bool(false),
            "localFileAccessAttempted": .bool(false)
        ]
    }

    private func permissionDetail(
        action: String,
        request: ToolRequestRecord,
        status: ToolRequestStatus? = nil
    ) -> JSONRecord {
        [
            "action": .string(action),
            "requestId": .string(request.id),
            "normalizedCapability": .string(request.normalizedCapability),
            "appId": jsonString(request.appId),
            "appSlug": jsonString(request.appSlug),
            "relatedTaskId": jsonString(request.relatedTaskId),
            "relatedRecordId": jsonString(request.relatedRecordId),
            "status": .string((status ?? request.status).rawValue),
            "autoInstallAttempted": .bool(false),
            "autoGrantCreated": .bool(false),
            "localFileAccessAttempted": .bool(false)
        ]
    }

    private func recordAudit(
        context: ServiceRequestContext,
        eventType: String,
        severity: String = "info",
        message: String,
        request: ToolRequestRecord?,
        normalizedCapability: String? = nil,
        app: MarketplaceCatalogApp? = nil,
        relatedTaskId: RelayId? = nil,
        relatedRecordId: RelayId? = nil,
        missingToolEventId: RelayId? = nil,
        status: ToolRequestStatus? = nil,
        action: String,
        extra: JSONRecord = [:],
        now: Date
    ) {
        let effectiveCapability = request?.normalizedCapability ?? normalizedCapability
        let effectiveTaskId = request?.relatedTaskId ?? relatedTaskId
        let effectiveRecordId = request?.relatedRecordId ?? relatedRecordId
        let effectiveMissingToolId = request?.missingToolEventId ?? missingToolEventId
        let effectiveStatus = request?.status ?? status
        let resourceId = request?.id ?? app?.id ?? effectiveRecordId
        var detail: JSONRecord = [
            "action": .string(action),
            "requestId": jsonString(request?.id),
            "normalizedCapability": jsonString(effectiveCapability),
            "status": effectiveStatus.map { .string($0.rawValue) } ?? .null,
            "appId": jsonString(request?.appId ?? app?.id),
            "appSlug": jsonString(request?.appSlug ?? app?.slug),
            "relatedTaskId": jsonString(effectiveTaskId),
            "relatedRecordId": jsonString(effectiveRecordId),
            "missingToolEventId": jsonString(effectiveMissingToolId),
            "autoInstallAttempted": .bool(false),
            "autoGrantCreated": .bool(false),
            "localFileAccessAttempted": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
        if let continuation = request?.metadata["scheduledContinuationStatus"] {
            detail["scheduledContinuationStatus"] = continuation
        }
        if let continuation = request?.metadata["continuationNote"] {
            detail["continuationNote"] = continuation
        }
        detail.merge(extra) { _, new in new }
        _ = auditSecurity?.record(
            context: context,
            request: AuditLogRecordRequest(
                eventType: eventType,
                resourceType: "tool_request",
                resourceId: resourceId,
                severity: severity,
                message: message,
                taskId: effectiveTaskId,
                dispatchId: request?.dispatchId,
                source: "tool-request-service",
                context: detail
            ),
            now: now
        )
    }

    private func jsonString(_ value: String?) -> JSONValue {
        value.map { .string($0) } ?? .null
    }

    private static func connectionIsUsable(_ connection: MarketplaceProviderConnection) -> Bool {
        switch connection.status {
        case .connected, .healthError, .senderInvalid, .expired, .reauthorizeRequired:
            return true
        case .disconnected, .authRequired, .validating, .disconnecting, .unavailable:
            return false
        }
    }

    private static func isActiveInstall(_ install: MarketplaceInstallRecord) -> Bool {
        install.installStatus == .installed || install.installStatus == .requested
    }

    public static func isOpenStatus(_ status: ToolRequestStatus) -> Bool {
        switch status {
        case .requested, .connected, .granted, .unavailable:
            return true
        case .dismissed, .ignored, .resolved, .rejected:
            return false
        }
    }

    private static let adminSettableStatuses: Set<ToolRequestStatus> = [
        .requested,
        .unavailable,
        .dismissed,
        .ignored,
        .resolved,
        .rejected
    ]

    private static let capabilityAliases: [String: String] = [
        "email_send": "email_send",
        "email_send_message": "email_send",
        "gmail_send": "email_send",
        "gmail_send_message": "email_send",
        "outlook_send": "email_send",
        "outlook_send_message": "email_send",
        "smtp_send": "email_send",
        "mail_send": "email_send",
        "email_draft": "email_draft",
        "mail_draft": "email_draft",
        "gmail_draft": "email_draft",
        "outlook_draft": "email_draft",
        "search": "external_search",
        "web_search": "external_search",
        "serp_search": "external_search",
        "external_search": "external_search"
    ]
}

private struct DerivedToolAvailability {
    var status: ToolRequestStatus
    var availabilityState: ToolRequestAvailabilityState
    var toolAvailable: Bool
    var toolConnected: Bool
    var toolGranted: Bool
    var suggestedApps: [ToolRequestSuggestedApp]
}

private func isRetainedApp(_ app: MarketplaceCatalogApp) -> Bool {
    app.sourceType == .externalProvider
        && !app.localAppExcluded
        && !app.reviewExcluded
        && !app.slug.localizedCaseInsensitiveContains("paperclip")
}

private func guidance(for state: ToolRequestAvailabilityState, app: MarketplaceCatalogApp) -> String {
    switch state {
    case .granted:
        return "\(app.name) already has a retained install grant for this capability."
    case .connected:
        return "Connect state is ready; an admin can approve a retained install or grant flow when later authority cards allow it."
    case .notConnected:
        return "Connect \(app.name) before this capability can be granted."
    case .unavailable:
        return "\(app.name) is unavailable for this capability."
    case .unknown:
        return "Tool availability is unknown."
    }
}
