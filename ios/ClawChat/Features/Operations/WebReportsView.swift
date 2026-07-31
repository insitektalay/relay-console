// WebReportsView.swift
// ClawChat - reports centre aligned to the web Reports surface.

import SwiftUI

private enum ReportSourceFilter: String, CaseIterable {
    case all = "All reports"
    case snapshots = "Snapshots"
    case wrapUps = "Chat reports"
}

private enum ReportSortMode: String, CaseIterable {
    case newest = "Newest"
    case oldest = "Oldest"
    case title = "Title"
}

private enum InsightsSection: String, CaseIterable, Identifiable {
    case reports = "Reports"
    case analytics = "Analytics"

    var id: String { rawValue }
}

private enum ReportListItem: Identifiable {
    case snapshot(ReportSnapshot)
    case wrapUp(ThreadWrapUpReport)

    var id: String {
        switch self {
        case .snapshot(let report): return "snapshot:\(report.id)"
        case .wrapUp(let report): return "wrap_up:\(report.id)"
        }
    }

    var title: String {
        switch self {
        case .snapshot(let report): return report.title
        case .wrapUp(let report): return report.title
        }
    }

    var subtitle: String {
        switch self {
        case .snapshot(let report):
            return "\(report.type.rawValue.replacingOccurrences(of: "_", with: " ").capitalized) · \(report.period.rawValue.capitalized)"
        case .wrapUp(let report):
            return "\(report.messageCount) messages · \(report.provider)"
        }
    }

    var createdAt: Date {
        switch self {
        case .snapshot(let report): return report.createdAt
        case .wrapUp(let report): return report.createdAt
        }
    }

    var badge: String {
        switch self {
        case .snapshot: return "SNAPSHOT"
        case .wrapUp: return "CHAT"
        }
    }

    var avatarLabel: String { title }
}

private struct ReportListGroup: Identifiable {
    let id: String
    var title: String
    var subtitle: String
    var avatarLabel: String
    var avatarUrl: String?
    var badge: String
    var badgeColor: Color
    var latestCreatedAt: Date
    var isCollapsible: Bool
    var reports: [ReportListItem]
}

struct WebReportsView: View {
    @EnvironmentObject private var appStore: AppStore

    @State private var viewModel: ReportsViewModel?
    @State private var searchText = ""
    @State private var sourceFilter: ReportSourceFilter = .all
    @State private var sortMode: ReportSortMode = .newest
    @State private var selectedSection: InsightsSection = .reports
    @State private var selectedSnapshot: ReportSnapshot?
    @State private var selectedWrapUp: ThreadWrapUpReport?
    @State private var expandedGroupIds: Set<String> = []

    private var items: [ReportListItem] {
        let snapshots = viewModel?.reports.map(ReportListItem.snapshot) ?? []
        let wrapUps = viewModel?.wrapUpReports.map(ReportListItem.wrapUp) ?? []
        var result: [ReportListItem]
        switch sourceFilter {
        case .all: result = snapshots + wrapUps
        case .snapshots: result = snapshots
        case .wrapUps: result = wrapUps
        }

        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !query.isEmpty {
            result = result.filter {
                $0.title.localizedCaseInsensitiveContains(query) ||
                $0.subtitle.localizedCaseInsensitiveContains(query)
            }
        }

        switch sortMode {
        case .newest: return result.sorted { $0.createdAt > $1.createdAt }
        case .oldest: return result.sorted { $0.createdAt < $1.createdAt }
        case .title: return result.sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        }
    }

    private var reportGroups: [ReportListGroup] {
        var groups: [String: ReportListGroup] = [:]
        var orderedIds: [String] = []
        let threadsById = Dictionary(uniqueKeysWithValues: appStore.threads.map { ($0.id, $0) })
        let teamsById = Dictionary(uniqueKeysWithValues: appStore.teams.map { ($0.id, $0) })
        let agentsById = Dictionary(uniqueKeysWithValues: appStore.agents.map { ($0.id, $0) })

        func append(_ report: ReportListItem, to group: ReportListGroup) {
            if groups[group.id] == nil {
                groups[group.id] = group
                orderedIds.append(group.id)
            }
            groups[group.id]?.reports.append(report)
            if report.createdAt > (groups[group.id]?.latestCreatedAt ?? report.createdAt) {
                groups[group.id]?.latestCreatedAt = report.createdAt
            }
        }

        for item in items {
            switch item {
            case .snapshot(let report):
                append(item, to: ReportListGroup(
                    id: "single:\(item.id)",
                    title: report.title,
                    subtitle: item.subtitle,
                    avatarLabel: report.title,
                    avatarUrl: nil,
                    badge: "Snapshot",
                    badgeColor: ClawColors.accent,
                    latestCreatedAt: report.createdAt,
                    isCollapsible: false,
                    reports: []
                ))

            case .wrapUp(let report):
                let thread = threadsById[report.threadId]
                let team = report.teamId.flatMap { teamsById[$0] }
                let primaryAgent = thread?.agentIds.first.flatMap { agentsById[$0] }
                let avatarLabel = thread?.title ?? team?.name ?? primaryAgent?.name ?? report.title
                let avatarUrl = thread?.avatarUrl ?? primaryAgent?.avatarUrl

                if thread?.type == .team {
                    append(item, to: ReportListGroup(
                        id: "team-chat:\(report.teamId ?? report.threadId)",
                        title: thread?.title ?? team?.name ?? report.title,
                        subtitle: "Team chat reports",
                        avatarLabel: avatarLabel,
                        avatarUrl: avatarUrl,
                        badge: "Team",
                        badgeColor: ClawColors.accentGreen,
                        latestCreatedAt: report.createdAt,
                        isCollapsible: true,
                        reports: []
                    ))
                } else if thread?.type == .direct {
                    let agentName = primaryAgent?.name
                    append(item, to: ReportListGroup(
                        id: "direct-chat:\(primaryAgent?.id ?? report.threadId)",
                        title: agentName ?? thread?.title ?? report.title,
                        subtitle: "Direct chat reports",
                        avatarLabel: agentName ?? avatarLabel,
                        avatarUrl: avatarUrl,
                        badge: "Direct",
                        badgeColor: ClawColors.accentTeal,
                        latestCreatedAt: report.createdAt,
                        isCollapsible: true,
                        reports: []
                    ))
                } else {
                    append(item, to: ReportListGroup(
                        id: "single:\(item.id)",
                        title: report.title,
                        subtitle: report.cycleLabel,
                        avatarLabel: avatarLabel,
                        avatarUrl: avatarUrl,
                        badge: "Wrap-up",
                        badgeColor: ClawColors.accentPurple,
                        latestCreatedAt: report.createdAt,
                        isCollapsible: false,
                        reports: []
                    ))
                }
            }
        }

        var result = orderedIds.compactMap { groups[$0] }.map { group in
            var updated = group
            if updated.isCollapsible {
                let latestCycle = updated.reports.compactMap { item -> Int? in
                    if case .wrapUp(let report) = item { return report.threadSessionSequenceNumber }
                    return nil
                }.max()
                let countLabel = "\(updated.reports.count) \(updated.reports.count == 1 ? "report" : "reports")"
                updated.subtitle = latestCycle.map { "\(countLabel) · Latest cycle \($0)" } ?? countLabel
            }
            return updated
        }

        switch sortMode {
        case .newest:
            result.sort { $0.latestCreatedAt > $1.latestCreatedAt }
        case .oldest:
            result.sort { $0.latestCreatedAt < $1.latestCreatedAt }
        case .title:
            result.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        }
        return result
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                VStack(spacing: 0) {
                    sectionPicker

                    if selectedSection == .reports {
                        filters
                        reportsContent
                    } else {
                        analyticsContent
                    }
                }
            }
            .navigationTitle("Insights")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task { await bootstrap() }
            .onChange(of: appStore.selectedWorkspace?.id) { _, _ in
                _Concurrency.Task { await bootstrap() }
            }
            .sheet(item: $selectedSnapshot) { report in
                ReportDetailSheet(report: report)
            }
            .sheet(item: $selectedWrapUp) { report in
                WrapUpReportDetailSheet(report: report)
            }
        }
    }

    private var sectionPicker: some View {
        Picker("Insights", selection: $selectedSection) {
            ForEach(InsightsSection.allCases) { section in
                Text(section.rawValue).tag(section)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.top, ClawSpacing.md)
        .padding(.bottom, ClawSpacing.sm)
        .background(ClawColors.backgroundPrimary)
    }

    @ViewBuilder
    private var reportsContent: some View {
        if viewModel?.isLoading == true && items.isEmpty {
            ProgressView("Loading reports")
                .tint(ClawColors.accent)
                .foregroundStyle(ClawColors.textSecondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if let error = viewModel?.error, items.isEmpty {
            MissionErrorPanel(message: "Unable to load reports: \(error)")
                .padding(ClawSpacing.lg)
            Spacer()
        } else if items.isEmpty {
            MissionEmptyState(
                icon: "chart.bar.doc.horizontal",
                title: "No reports yet",
                subtitle: "Wrap up a chat to populate the reports centre."
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            List {
                ForEach(reportGroups) { group in
                    reportGroupRow(group)
                        .listRowBackground(ClawColors.backgroundPrimary)
                        .listRowSeparatorTint(ClawColors.separatorLight)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .refreshable { await reload() }
        }
    }

    @ViewBuilder
    private var analyticsContent: some View {
        if appStore.threads.isEmpty && !appStore.hasLoadedThreads {
            SkeletonThreadList(count: 8)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        } else if appStore.threads.isEmpty {
            MissionEmptyState(
                icon: "chart.xyaxis.line",
                title: "No analytics yet",
                subtitle: "Thread analytics appear after chats have loaded."
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            List {
                ForEach(appStore.threads.sorted { ($0.lastMessage?.timestamp ?? $0.updatedAt) > ($1.lastMessage?.timestamp ?? $1.updatedAt) }) { thread in
                    NavigationLink {
                        ThreadAnalyticsView(thread: thread)
                    } label: {
                        HStack(spacing: ClawSpacing.md) {
                            AvatarView(name: thread.title, imageUrl: thread.avatarUrl, size: .medium)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(thread.title)
                                    .font(.system(size: 15, weight: .semibold))
                                    .foregroundStyle(ClawColors.textPrimary)
                                    .lineLimit(1)
                                Text("Message counts, active windows, sessions, and exports")
                                    .font(.system(size: 12))
                                    .foregroundStyle(ClawColors.textSecondary)
                                    .lineLimit(1)
                            }
                        }
                        .padding(.vertical, ClawSpacing.xs)
                    }
                    .listRowBackground(ClawColors.backgroundPrimary)
                    .listRowSeparatorTint(ClawColors.separatorLight)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
    }

    private var filters: some View {
        VStack(spacing: ClawSpacing.sm) {
            HStack(spacing: ClawSpacing.sm) {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(ClawColors.textTertiary)
                TextField("Search reports...", text: $searchText)
                    .textInputAutocapitalization(.never)
                    .foregroundStyle(ClawColors.textPrimary)
            }
            .padding(.horizontal, ClawSpacing.md)
            .padding(.vertical, ClawSpacing.sm)
            .background(ClawColors.backgroundSecondary)
            .clipShape(RoundedRectangle(cornerRadius: ClawRadius.md))

            HStack(spacing: ClawSpacing.sm) {
                Picker("Source", selection: $sourceFilter) {
                    ForEach(ReportSourceFilter.allCases, id: \.self) { filter in
                        Text(filter.rawValue).tag(filter)
                    }
                }
                .pickerStyle(.menu)

                Picker("Sort", selection: $sortMode) {
                    ForEach(ReportSortMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.menu)
            }
            .font(ClawFonts.label)
        }
        .padding(.horizontal, ClawSpacing.lg)
        .padding(.vertical, ClawSpacing.md)
        .background(ClawColors.backgroundPrimary)
        .overlay(alignment: .bottom) {
            Rectangle().fill(ClawColors.separator).frame(height: 1)
        }
    }

    private func reportGroupRow(_ group: ReportListGroup) -> some View {
        VStack(spacing: 0) {
            Button {
                if group.isCollapsible {
                    if expandedGroupIds.contains(group.id) {
                        expandedGroupIds.remove(group.id)
                    } else {
                        expandedGroupIds.insert(group.id)
                    }
                } else if let item = group.reports.first {
                    openReport(item)
                }
            } label: {
                HStack(spacing: ClawSpacing.md) {
                    AvatarView(name: group.avatarLabel, imageUrl: group.avatarUrl, size: .medium)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(group.title)
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(ClawColors.textPrimary)
                            .lineLimit(1)
                        Text(group.subtitle)
                            .font(.system(size: 12))
                            .foregroundStyle(ClawColors.textSecondary)
                            .lineLimit(1)
                    }
                    Spacer()
                    HStack(spacing: ClawSpacing.xs) {
                        MissionBadge(text: group.badge, color: group.badgeColor)
                        if group.isCollapsible {
                            Image(systemName: expandedGroupIds.contains(group.id) ? "chevron.down" : "chevron.right")
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(ClawColors.textTertiary)
                        } else {
                            Text(group.latestCreatedAt.relativeTime)
                                .font(.system(size: 11))
                                .foregroundStyle(ClawColors.textTertiary)
                        }
                    }
                }
                .padding(.vertical, ClawSpacing.sm)
            }
            .buttonStyle(.plain)

            if group.isCollapsible && expandedGroupIds.contains(group.id) {
                VStack(spacing: 0) {
                    ForEach(group.reports) { item in
                        Button {
                            openReport(item)
                        } label: {
                            HStack(spacing: ClawSpacing.sm) {
                                Rectangle()
                                    .fill(ClawColors.separatorLight)
                                    .frame(width: 2)
                                    .padding(.vertical, 4)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(item.cycleTitle)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(ClawColors.textPrimary)
                                        .lineLimit(1)
                                    Text(item.cycleSubtitle)
                                        .font(.system(size: 11))
                                        .foregroundStyle(ClawColors.textSecondary)
                                        .lineLimit(1)
                                }
                                Spacer()
                                Text(item.createdAt.relativeTime)
                                    .font(.system(size: 10))
                                    .foregroundStyle(ClawColors.textTertiary)
                            }
                            .padding(.leading, 52)
                            .padding(.vertical, ClawSpacing.xs)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

    private func openReport(_ item: ReportListItem) {
        switch item {
        case .snapshot(let report): selectedSnapshot = report
        case .wrapUp(let report): selectedWrapUp = report
        }
    }

    private func bootstrap() async {
        guard let workspaceId = appStore.selectedWorkspace?.id else { return }
        let vm = ReportsViewModel(workspaceId: workspaceId)
        viewModel = vm
        await vm.loadReports()
    }

    private func reload() async {
        await viewModel?.refresh()
    }
}

private extension ReportListItem {
    var cycleTitle: String {
        switch self {
        case .snapshot(let report): return report.title
        case .wrapUp(let report): return report.cycleLabel
        }
    }

    var cycleSubtitle: String {
        switch self {
        case .snapshot(let report):
            return "\(report.type.rawValue.replacingOccurrences(of: "_", with: " ").capitalized) · \(report.period.rawValue.capitalized)"
        case .wrapUp(let report):
            if report.status == "generating" { return "Generating report..." }
            if report.status == "failed" { return report.errorMessage ?? "Report failed" }
            return report.fileName
        }
    }
}

private extension ThreadWrapUpReport {
    var cycleLabel: String {
        threadSessionSequenceNumber.map { "Cycle \($0)" } ?? title
    }
}
