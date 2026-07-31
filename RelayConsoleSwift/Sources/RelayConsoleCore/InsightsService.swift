import Foundation

public final class InsightsService {
    public static let retryUnavailableReason = "Wrap-up requires a connected OpenClaw or Hermes runtime agent with structured-job support."
    public static let repeatAnalysisUnavailableReason = "Agent repeat analysis requires a connected OpenClaw or Hermes runtime agent with structured-job support."

    private let data: LocalDataService
    private let eventBus: RelayEventBus
    private let viewStateKeyPrefix = "insights.viewState"

    public init(data: LocalDataService, eventBus: RelayEventBus) {
        self.data = data
        self.eventBus = eventBus
    }

    public func reportList(
        context: ServiceRequestContext,
        searchQuery: String = "",
        sourceFilter: InsightsReportSourceFilter = .all,
        sort: InsightsReportSort = .newest,
        includeArchived: Bool = false,
        selectedReportId: RelayId? = nil,
        now: Date = Date()
    ) throws -> InsightsReportListSnapshot {
        try requireReadAccess(context: context)
        let generatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
        let sourceRows = try allRows(context: context, includeArchived: true)
        let rows = includeArchived ? sourceRows : sourceRows.filter { $0.archivedAt == nil }
        let query = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let sourceFiltered = rows.filter { row in
            switch sourceFilter {
            case .all:
                return true
            case .snapshots:
                return row.sourceType == .snapshot
            case .chatReports:
                return row.sourceType == .chatReport
            }
        }
        let filtered = sourceFiltered.filter { row in
            query.isEmpty || [
                row.title,
                row.subtitle,
                row.statusLabel,
                row.badge,
                row.fileName ?? "",
                row.provider ?? "",
                row.model ?? ""
            ].joined(separator: " ").lowercased().contains(query)
        }
        let sorted = sortRows(filtered, sort: sort)
        let groups = buildGroups(sorted)
        let state: InsightsReportListState
        let emptyReason: String?
        if rows.isEmpty {
            state = .empty
            emptyReason = "Wrap up a chat to populate the reports centre."
        } else if sorted.isEmpty {
            state = .noMatch
            emptyReason = "No reports match the current filters."
        } else {
            state = .ready
            emptyReason = nil
        }
        let selected = selectedReportId.flatMap { id in sorted.contains { $0.id == id } ? id : nil } ?? sorted.first?.id
        return InsightsReportListSnapshot(
            state: state,
            rows: sorted,
            groups: groups,
            selectedReportId: selected,
            searchQuery: searchQuery,
            sourceFilter: sourceFilter,
            sort: sort,
            includeArchived: includeArchived,
            totalCount: rows.count,
            filteredCount: sorted.count,
            archivedCount: sourceRows.filter { $0.archivedAt != nil }.count,
            emptyReason: emptyReason,
            generatedAt: generatedAt
        )
    }

    public func viewState(context: ServiceRequestContext) throws -> InsightsViewState {
        try requireReadAccess(context: context)
        let fallback = InsightsViewState()
        return try data.getAppSetting(viewStateKey(context: context), fallback: fallback)
    }

    @discardableResult
    public func saveViewState(
        context: ServiceRequestContext,
        state: InsightsViewState,
        now: Date = Date()
    ) throws -> InsightsViewState {
        try requireReadAccess(context: context)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let sanitized = InsightsViewState(
            searchQuery: redactString(state.searchQuery),
            sourceFilter: state.sourceFilter,
            sort: state.sort,
            includeArchived: state.includeArchived,
            selectedReportId: state.selectedReportId.flatMap(Self.nilIfBlank),
            showingAnalytics: state.showingAnalytics,
            activityGapMinutes: state.activityGapMinutes,
            updatedAt: timestamp
        )
        try data.setAppSetting(viewStateKey(context: context), value: sanitized)
        return sanitized
    }

    public func reportDetail(context: ServiceRequestContext, reportId: RelayId) throws -> InsightsReportDetail {
        try requireReadAccess(context: context)
        if let report = try? data.getThreadWrapUpReport(reportId), report.workspaceId == context.workspaceId {
            let row = try wrapUpRow(report)
            let redactedError = report.error.map(redactRecord)
            var structuredData = report.metadata
            if let redactedError {
                structuredData["error"] = .object(redactedError)
            }
            return InsightsReportDetail(
                row: row,
                markdown: report.markdown,
                structuredData: structuredData,
                snapshotData: [:],
                error: redactedError,
                metadata: report.metadata,
                retryAvailable: false,
                retryUnavailableReason: report.status == .failed ? Self.retryUnavailableReason : nil,
                archiveAvailable: report.archivedAt == nil,
                redactionStatus: report.redactionStatus
            )
        }
        let snapshot = try data.getInsightsReportSnapshot(reportId)
        guard snapshot.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Selected report does not belong to this workspace.")
        }
        return InsightsReportDetail(
            row: snapshotRow(snapshot),
            markdown: nil,
            structuredData: [:],
            snapshotData: snapshot.payload,
            error: nil,
            metadata: [
                "snapshotType": .string(snapshot.snapshotType),
                "periodLabel": snapshot.periodLabel.map(JSONValue.string) ?? .null
            ],
            retryAvailable: false,
            retryUnavailableReason: nil,
            archiveAvailable: snapshot.archivedAt == nil,
            redactionStatus: snapshot.redactionStatus
        )
    }

    @discardableResult
    public func saveSnapshot(
        context: ServiceRequestContext,
        title: String,
        summary: String,
        snapshotType: String,
        periodLabel: String? = nil,
        rangeStart: IsoTimestamp? = nil,
        rangeEnd: IsoTimestamp? = nil,
        payload: JSONRecord = [:],
        now: Date = Date()
    ) throws -> InsightsReportSnapshot {
        try requireWriteAccess(context: context)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let snapshot = InsightsReportSnapshot(
            id: createRelayId("irs"),
            workspaceId: context.workspaceId,
            title: title,
            summary: summary,
            snapshotType: snapshotType,
            periodLabel: periodLabel,
            rangeStart: rangeStart,
            rangeEnd: rangeEnd,
            payload: payload,
            createdAt: timestamp,
            updatedAt: timestamp
        )
        let saved = try data.saveInsightsReportSnapshot(snapshot)
        eventBus.emit(.insightsReportsUpdated, saved)
        return saved
    }

    @discardableResult
    public func archiveReport(context: ServiceRequestContext, reportId: RelayId, now: Date = Date()) throws -> InsightsReportDetail {
        try requireWriteAccess(context: context)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        if let report = try? data.getThreadWrapUpReport(reportId), report.workspaceId == context.workspaceId {
            let archived = try data.archiveThreadWrapUpReport(id: report.id, archivedAt: timestamp)
            eventBus.emit(.insightsReportsUpdated, archived)
            return try reportDetail(context: context, reportId: archived.id)
        }
        let snapshot = try data.getInsightsReportSnapshot(reportId)
        guard snapshot.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Selected report does not belong to this workspace.")
        }
        let archived = try data.archiveInsightsReportSnapshot(id: snapshot.id, archivedAt: timestamp)
        eventBus.emit(.insightsReportsUpdated, archived)
        return try reportDetail(context: context, reportId: archived.id)
    }

    public func retryReport(context: ServiceRequestContext, reportId: RelayId) throws {
        try requireWriteAccess(context: context)
        let report = try data.getThreadWrapUpReport(reportId)
        guard report.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Selected report does not belong to this workspace.")
        }
        if report.status == .pending || report.status == .generating {
            eventBus.emit(.insightsReportsUpdated, report)
            return
        }
        guard report.status == .failed else {
            throw ServiceGuard.invalidInput(context: context, message: "Only failed reports can be retried.")
        }
        throw ServiceGuard.unavailable(
            context: context,
            reasonCode: .featureMissingService,
            message: Self.retryUnavailableReason,
            recovery: "Connect structured-job report generation before enabling retry."
        )
    }

    @discardableResult
    public func archiveReportGroup(
        context: ServiceRequestContext,
        groupId: RelayId,
        now: Date = Date()
    ) throws -> [InsightsReportDetail] {
        try requireWriteAccess(context: context)
        let rows = try allRows(context: context, includeArchived: false)
            .filter { $0.groupId == groupId || $0.id == groupId }
        guard !rows.isEmpty else {
            throw ServiceGuard.invalidInput(context: context, message: "No active reports were found for this group.")
        }
        return try rows.map { row in
            try archiveReport(context: context, reportId: row.id, now: now)
        }
    }

    public func runRepeatAnalysis(
        context: ServiceRequestContext,
        threadId: RelayId,
        sessionId: RelayId
    ) throws {
        try requireWriteAccess(context: context)
        let thread = try data.getThread(threadId)
        guard thread.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Selected analytics thread does not belong to this workspace.")
        }
        let sessions = try data.listChatSessions(threadId: threadId)
        guard sessions.contains(where: { $0.id == sessionId }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Selected analytics session does not belong to this thread.")
        }
        throw ServiceGuard.unavailable(
            context: context,
            reasonCode: .featureMissingService,
            message: Self.repeatAnalysisUnavailableReason,
            recovery: "Connect structured-job repeat analysis before enabling this action."
        )
    }

    public func analytics(context: ServiceRequestContext, threadId: RelayId?, activityGapMinutes: Int = 30) throws -> ThreadAnalyticsSnapshot {
        try requireReadAccess(context: context)
        let gap = min(max(activityGapMinutes, 1), 1440)
        guard let threadId else {
            return emptyAnalytics(threadId: nil, gap: gap, reason: "Choose a chat")
        }
        let thread = try data.getThread(threadId)
        guard thread.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Selected analytics thread does not belong to this workspace.")
        }
        let messages = try data.listMessages(threadId: threadId, limit: 500)
        guard !messages.isEmpty else {
            return emptyAnalytics(threadId: threadId, gap: gap, reason: "No analytics available for this thread yet.")
        }
        let sessions = try data.listChatSessions(threadId: threadId)
        let senders = Dictionary(grouping: messages) { message in
            "\(message.senderType.rawValue)|\(message.senderName)"
        }
        .map { key, values -> ThreadAnalyticsSender in
            let parts = key.split(separator: "|", maxSplits: 1).map(String.init)
            return ThreadAnalyticsSender(
                id: key,
                senderName: parts.dropFirst().first ?? "Unknown",
                senderType: SenderType(rawValue: parts.first ?? "") ?? .system,
                messageCount: values.count
            )
        }
        .sorted { lhs, rhs in
            if lhs.messageCount == rhs.messageCount {
                return lhs.senderName.localizedCaseInsensitiveCompare(rhs.senderName) == .orderedAscending
            }
            return lhs.messageCount > rhs.messageCount
        }
        let periods = activePeriods(messages: messages, gapMinutes: gap)
        let wrapUpReports = try data.listThreadWrapUpReports(threadId: threadId)
        let sessionRows = sessions.map { session in
            let scoped = messages.filter { $0.threadSessionId == session.id }
            let repeatAnalysis = repeatAnalysis(for: session, reports: wrapUpReports)
            return ThreadAnalyticsSession(
                id: session.id,
                sequenceNumber: session.sequenceNumber,
                messageCount: scoped.count,
                userMessageCount: scoped.filter { $0.senderType == .user }.count,
                agentMessageCount: scoped.filter { $0.senderType == .agent }.count,
                status: session.status,
                repeatAnalysisStatus: repeatAnalysis.status,
                repeatedAgentMessageCount: repeatAnalysis.repeatedAgentMessageCount,
                repeatedCrossAgentMessageCount: repeatAnalysis.repeatedCrossAgentMessageCount,
                agentRepeatGroupCount: repeatAnalysis.agentRepeatGroupCount,
                repeatAnalysisError: repeatAnalysis.error
            )
        }
        let first = messages.first?.createdAt
        let last = messages.last?.createdAt
        let threadLength = Self.threadLength(first: first, last: last)
        let yourMessageCount = messages.filter { message in
            message.senderType == .user
                && (message.senderId == context.actorId
                    || message.senderName.localizedCaseInsensitiveCompare("You") == .orderedSame
                    || message.senderName.localizedCaseInsensitiveCompare("Local User") == .orderedSame)
        }.count
        let snapshot = ThreadAnalyticsSnapshot(
            threadId: threadId,
            activityGapMinutes: gap,
            messageCount: messages.count,
            senderCount: senders.count,
            sessionCount: max(sessions.count, 1),
            threadLength: threadLength,
            yourMessageCount: yourMessageCount,
            userMessageCount: messages.filter { $0.senderType == .user }.count,
            agentMessageCount: messages.filter { $0.senderType == .agent }.count,
            activeWindowCount: periods.count,
            firstMessageAt: first,
            lastMessageAt: last,
            senders: senders,
            activePeriods: periods,
            sessions: sessionRows,
            exportAvailable: true
        )
        return snapshot
    }

    public func exportAnalyticsCSV(context: ServiceRequestContext, threadId: RelayId, activityGapMinutes: Int = 30) throws -> String {
        let snapshot = try analytics(context: context, threadId: threadId, activityGapMinutes: activityGapMinutes)
        guard snapshot.exportAvailable else {
            throw ServiceGuard.invalidInput(context: context, message: "No analytics data is available to export.")
        }
        var lines = ["metric,value"]
        lines.append("Messages,\(snapshot.messageCount)")
        lines.append("Senders,\(snapshot.senderCount)")
        lines.append("Sessions,\(snapshot.sessionCount)")
        lines.append("Your messages,\(snapshot.yourMessageCount ?? snapshot.userMessageCount)")
        lines.append("User messages,\(snapshot.userMessageCount)")
        lines.append("Agent messages,\(snapshot.agentMessageCount)")
        lines.append("Active windows,\(snapshot.activeWindowCount)")
        lines.append("Thread length,\(csvCell(snapshot.threadLength))")
        lines.append("First message,\(csvCell(snapshot.firstMessageAt ?? "Not available"))")
        lines.append("Last message,\(csvCell(snapshot.lastMessageAt ?? "Not available"))")
        lines.append("")
        lines.append("sender,type,count")
        lines.append(contentsOf: snapshot.senders.map { "\(csvCell($0.senderName)),\($0.senderType.rawValue),\($0.messageCount)" })
        lines.append("")
        lines.append("active_period,start,end,messages")
        lines.append(contentsOf: snapshot.activePeriods.map { "\(csvCell($0.title)),\(csvCell($0.startedAt)),\(csvCell($0.endedAt)),\($0.messageCount)" })
        lines.append("")
        lines.append("session,status,messages,agent_messages,your_messages,user_messages,repeat_status,repeated,cross_agent,repeat_groups")
        lines.append(contentsOf: snapshot.sessions.map { session in
            [
                csvCell("Session \(session.sequenceNumber)"),
                csvCell(session.status.rawValue),
                "\(session.messageCount)",
                "\(session.agentMessageCount)",
                "\(session.userMessageCount)",
                "\(session.userMessageCount)",
                csvCell(session.repeatAnalysisStatus),
                "\(session.repeatedAgentMessageCount ?? 0)",
                "\(session.repeatedCrossAgentMessageCount ?? 0)",
                "\(session.agentRepeatGroupCount ?? 0)"
            ].joined(separator: ",")
        })
        return lines.joined(separator: "\n")
    }

    public func exportAnalyticsJSON(context: ServiceRequestContext, threadId: RelayId, activityGapMinutes: Int = 30) throws -> JSONRecord {
        let snapshot = try analytics(context: context, threadId: threadId, activityGapMinutes: activityGapMinutes)
        guard snapshot.exportAvailable else {
            throw ServiceGuard.invalidInput(context: context, message: "No analytics data is available to export.")
        }
        return [
            "threadId": snapshot.threadId.map(JSONValue.string) ?? .null,
            "messageCount": .number(Double(snapshot.messageCount)),
            "senderCount": .number(Double(snapshot.senderCount)),
            "sessionCount": .number(Double(snapshot.sessionCount)),
            "threadLength": .string(snapshot.threadLength),
            "yourMessageCount": .number(Double(snapshot.yourMessageCount ?? snapshot.userMessageCount)),
            "userMessageCount": .number(Double(snapshot.userMessageCount)),
            "agentMessageCount": .number(Double(snapshot.agentMessageCount)),
            "activeWindowCount": .number(Double(snapshot.activeWindowCount)),
            "firstMessageAt": snapshot.firstMessageAt.map(JSONValue.string) ?? .null,
            "lastMessageAt": snapshot.lastMessageAt.map(JSONValue.string) ?? .null,
            "senders": .array(snapshot.senders.map { sender in
                .object([
                    "senderName": .string(redactString(sender.senderName)),
                    "senderType": .string(sender.senderType.rawValue),
                    "messageCount": .number(Double(sender.messageCount))
                ])
            }),
            "activePeriods": .array(snapshot.activePeriods.map { period in
                .object([
                    "title": .string(period.title),
                    "startedAt": .string(period.startedAt),
                    "endedAt": .string(period.endedAt),
                    "messageCount": .number(Double(period.messageCount))
                ])
            }),
            "sessions": .array(snapshot.sessions.map { session in
                .object([
                    "sequenceNumber": .number(Double(session.sequenceNumber)),
                    "status": .string(session.status.rawValue),
                    "messageCount": .number(Double(session.messageCount)),
                    "userMessageCount": .number(Double(session.userMessageCount)),
                    "agentMessageCount": .number(Double(session.agentMessageCount)),
                    "repeatAnalysisStatus": .string(session.repeatAnalysisStatus),
                    "repeatedAgentMessageCount": .number(Double(session.repeatedAgentMessageCount ?? 0)),
                    "repeatedCrossAgentMessageCount": .number(Double(session.repeatedCrossAgentMessageCount ?? 0)),
                    "agentRepeatGroupCount": .number(Double(session.agentRepeatGroupCount ?? 0)),
                    "repeatAnalysisError": session.repeatAnalysisError.map { .string(redactString($0)) } ?? .null
                ])
            }),
            "redactionStatus": .string(snapshot.redactionStatus)
        ]
    }

    private func allRows(context: ServiceRequestContext, includeArchived: Bool) throws -> [InsightsReportRow] {
        let wrapUps = try data.listThreadWrapUpReports(workspaceId: context.workspaceId, includeArchived: includeArchived)
            .map(wrapUpRow)
        let snapshots = try data.listInsightsReportSnapshots(workspaceId: context.workspaceId, includeArchived: includeArchived)
            .map(snapshotRow)
        return wrapUps + snapshots
    }

    private func wrapUpRow(_ report: ThreadWrapUpReport) throws -> InsightsReportRow {
        let thread = try? data.getThread(report.threadId)
        let session = thread?.sessions.first { $0.id == report.sessionId }
        let cycle = session?.sequenceNumber ?? 1
        let title = report.title ?? "Cycle \(cycle) transcript"
        let statusLabel: String
        switch report.status {
        case .pending, .generating:
            statusLabel = "Generating report..."
        case .failed:
            statusLabel = "Report failed"
        case .completed:
            statusLabel = "Completed"
        case .unavailable:
            statusLabel = "Unavailable"
        }
        return InsightsReportRow(
            id: report.id,
            sourceType: .chatReport,
            sourceRecordId: report.id,
            groupId: report.threadId,
            groupTitle: thread?.title ?? "Report detail",
            groupSubtitle: thread?.threadType == .team ? "Team chat wrap-up" : "Chat report",
            cycleLabel: "Cycle \(cycle)",
            threadId: report.threadId,
            sessionId: report.sessionId,
            title: title,
            subtitle: thread?.threadType == .team ? "Team chat wrap-up" : "Chat report",
            status: report.status.rawValue,
            statusLabel: statusLabel,
            badge: "Chat reports",
            fileName: report.status == .completed ? "\(title).md" : nil,
            createdAt: report.createdAt,
            updatedAt: report.updatedAt,
            archivedAt: report.archivedAt,
            messageCount: report.messageCount,
            provider: report.provider,
            model: report.model,
            hasMarkdown: report.markdown?.isEmpty == false,
            hasStructuredData: !report.metadata.isEmpty,
            redactionStatus: report.redactionStatus
        )
    }

    private func snapshotRow(_ snapshot: InsightsReportSnapshot) -> InsightsReportRow {
        InsightsReportRow(
            id: snapshot.id,
            sourceType: .snapshot,
            sourceRecordId: snapshot.id,
            groupId: snapshot.id,
            groupTitle: snapshot.title,
            groupSubtitle: snapshot.summary,
            cycleLabel: nil,
            title: snapshot.title,
            subtitle: snapshot.summary,
            status: snapshot.archivedAt == nil ? "completed" : "archived",
            statusLabel: snapshot.archivedAt == nil ? "Completed" : "Archived",
            badge: "Snapshots",
            fileName: "\(snapshot.title).json",
            createdAt: snapshot.createdAt,
            updatedAt: snapshot.updatedAt,
            archivedAt: snapshot.archivedAt,
            messageCount: 0,
            hasMarkdown: false,
            hasStructuredData: !snapshot.payload.isEmpty,
            redactionStatus: snapshot.redactionStatus
        )
    }

    private func sortRows(_ rows: [InsightsReportRow], sort: InsightsReportSort) -> [InsightsReportRow] {
        switch sort {
        case .newest:
            return rows.sorted { $0.updatedAt > $1.updatedAt }
        case .oldest:
            return rows.sorted { $0.updatedAt < $1.updatedAt }
        case .title:
            return rows.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        }
    }

    private func buildGroups(_ rows: [InsightsReportRow]) -> [InsightsReportGroup] {
        var orderedIds: [RelayId] = []
        var grouped: [RelayId: [InsightsReportRow]] = [:]
        for row in rows {
            let id = row.groupId ?? row.id
            if grouped[id] == nil {
                orderedIds.append(id)
            }
            grouped[id, default: []].append(row)
        }
        return orderedIds.compactMap { id in
            guard let rows = grouped[id], let first = rows.first else { return nil }
            let activeRows = rows.filter { $0.archivedAt == nil }
            let updatedAt = rows.map(\.updatedAt).max() ?? first.updatedAt
            return InsightsReportGroup(
                id: id,
                title: first.groupTitle ?? first.title,
                subtitle: first.groupSubtitle ?? first.subtitle,
                badge: first.badge,
                updatedAt: updatedAt,
                archivedAt: activeRows.isEmpty ? rows.compactMap(\.archivedAt).max() : nil,
                isCollapsible: rows.count > 1,
                rows: rows
            )
        }
    }

    private func repeatAnalysis(
        for session: ChatSession,
        reports: [ThreadWrapUpReport]
    ) -> (status: String, repeatedAgentMessageCount: Int?, repeatedCrossAgentMessageCount: Int?, agentRepeatGroupCount: Int?, error: String?) {
        guard let report = reports.first(where: { $0.sessionId == session.id && $0.metadata["agentRepeatAnalysis"] != nil }),
              let value = report.metadata["agentRepeatAnalysis"]
        else {
            return ("not run", nil, nil, nil, nil)
        }
        let object: JSONRecord
        if case .object(let record) = value {
            object = record
        } else {
            return ("not run", nil, nil, nil, nil)
        }
        let rawStatus = stringValue(object["status"])?.lowercased() ?? "not_run"
        let status: String
        switch rawStatus {
        case "failed", "analysis_failed":
            status = "analysis failed"
        case "completed", "complete", "analyzed":
            status = "completed"
        case "running", "generating":
            status = "running"
        default:
            status = "not run"
        }
        return (
            status,
            intValue(object["repeatedAgentMessageCount"]),
            intValue(object["repeatedCrossAgentMessageCount"]),
            intValue(object["agentRepeatGroupCount"]),
            stringValue(object["error"]).map(redactString)
        )
    }

    private func activePeriods(messages: [Message], gapMinutes: Int) -> [ThreadAnalyticsActivePeriod] {
        var periods: [[Message]] = []
        for message in messages {
            guard let last = periods.last?.last,
                  let lastDate = Self.parseIso(last.createdAt),
                  let currentDate = Self.parseIso(message.createdAt),
                  currentDate.timeIntervalSince(lastDate) <= Double(gapMinutes * 60)
            else {
                periods.append([message])
                continue
            }
            periods[periods.count - 1].append(message)
        }
        return periods.enumerated().compactMap { index, window in
            guard let first = window.first, let last = window.last else { return nil }
            return ThreadAnalyticsActivePeriod(
                id: "active-window-\(index + 1)",
                title: "Window \(index + 1)",
                startedAt: first.createdAt,
                endedAt: last.createdAt,
                messageCount: window.count
            )
        }
    }

    private func emptyAnalytics(threadId: RelayId?, gap: Int, reason: String) -> ThreadAnalyticsSnapshot {
        ThreadAnalyticsSnapshot(
            threadId: threadId,
            activityGapMinutes: gap,
            messageCount: 0,
            senderCount: 0,
            sessionCount: 0,
            threadLength: "0 minutes",
            userMessageCount: 0,
            agentMessageCount: 0,
            activeWindowCount: 0,
            senders: [],
            activePeriods: [],
            sessions: [],
            exportAvailable: false,
            emptyReason: reason
        )
    }

    private static func threadLength(first: IsoTimestamp?, last: IsoTimestamp?) -> String {
        guard let firstDate = first.flatMap(parseIso), let lastDate = last.flatMap(parseIso) else {
            return "0 minutes"
        }
        let minutes = max(Int(lastDate.timeIntervalSince(firstDate) / 60.0), 0)
        return "\(minutes) minutes"
    }

    private static func parseIso(_ value: IsoTimestamp) -> Date? {
        ISO8601DateFormatter.relayConsole.date(from: value)
    }

    private static func nilIfBlank(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func viewStateKey(context: ServiceRequestContext) -> String {
        "\(viewStateKeyPrefix).\(context.workspaceId)"
    }

    private func csvCell(_ value: String) -> String {
        let redacted = redactString(value)
        if redacted.contains(",") || redacted.contains("\"") || redacted.contains("\n") {
            return "\"\(redacted.replacingOccurrences(of: "\"", with: "\"\""))\""
        }
        return redacted
    }

    private func intValue(_ value: JSONValue?) -> Int? {
        guard let value else { return nil }
        switch value {
        case .number(let number):
            return Int(number)
        case .string(let string):
            return Int(string)
        default:
            return nil
        }
    }

    private func requireReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member, .viewer],
            context: context,
            message: "Reading Insights requires workspace access."
        ) {
            throw denied
        }
    }

    private func requireWriteAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member],
            context: context,
            message: "Updating Insights reports requires member access."
        ) {
            throw denied
        }
    }
}
