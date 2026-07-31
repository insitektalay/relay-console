// ReportsView.swift
// ClawChat – Operations: Reports & analytics

import SwiftUI
import Combine
import Charts

// MARK: - ViewModel

@MainActor
final class ReportsViewState: ObservableObject {
    @Published var selectedPeriod: ReportPeriod = .week
    @Published var selectedType: ReportType = .performance
    @Published var reports: [ReportSnapshot] = []
    @Published var wrapUpReports: [ThreadWrapUpReport] = []
    @Published var showGenerateSheet: Bool = false
    @Published var isGenerating: Bool = false
    @Published var selectedReport: ReportSnapshot? = nil
    @Published var selectedWrapUpReport: ThreadWrapUpReport? = nil

    enum ReportPeriod: String, CaseIterable {
        case today  = "Today"
        case week   = "Week"
        case month  = "Month"
        case custom = "Custom"
    }

    // summaryStats moved to ReportsView where appStore is available

    func generateReport() {
        isGenerating = true
        _Concurrency.Task { [weak self] in
            try? await _Concurrency.Task.sleep(nanoseconds: 2_000_000_000)
            await MainActor.run {
                self?.isGenerating = false
                self?.showGenerateSheet = false
            }
        }
    }
}

// MARK: - Chart Data Models

struct DailyMetric: Identifiable {
    let id = UUID()
    let day: String
    let value: Double
    let label: String
}

struct TeamWorkloadData: Identifiable {
    let id = UUID()
    let team: String
    let completed: Double
    let failed: Double
}

struct BudgetData: Identifiable {
    let id = UUID()
    let agent: String
    let spend: Double
}

// MARK: - View

struct ReportsView: View {
    @StateObject private var vm = ReportsViewState()
    @EnvironmentObject private var appStore: AppStore
    @State private var reportsVM: ReportsViewModel?

    // MARK: - Live Summary Stats

    private var summaryStats: [(label: String, value: String, color: Color)] {
        let tasks = appStore.tasks
        let agents = appStore.agents
        let incidents = appStore.openIncidents

        switch vm.selectedType {
        case .performance:
            let done   = tasks.filter { $0.status == .completed }.count
            let failed = tasks.filter { $0.status == .failed }.count
            let total  = done + failed
            let rate   = total > 0 ? Double(done) / Double(total) * 100 : 0
            let avgMin = agents.isEmpty ? 0 : agents.reduce(0) { $0 + $1.avgCompletionMinutes } / agents.count
            return [
                ("Success Rate", total > 0 ? String(format: "%.1f%%", rate) : "—", ClawColors.accentGreen),
                ("Tasks Done",   "\(done)",                                          ClawColors.accent),
                ("Avg Time",     agents.isEmpty ? "—" : "\(avgMin)m",               ClawColors.textPrimary),
                ("Failed",       "\(failed)",                                        ClawColors.accentRed),
            ]
        case .reliability:
            let open = incidents.filter { $0.status == .open || $0.status == .investigating }.count
            let critical = incidents.filter { $0.severity == .critical }.count
            return [
                ("Open",       "\(open)",     ClawColors.accentRed),
                ("Incidents",  "\(incidents.count)", ClawColors.accentOrange),
                ("Critical",   "\(critical)", ClawColors.accentRed),
                ("P1 Alerts",  "\(critical)", critical > 0 ? ClawColors.accentRed : ClawColors.accentGreen),
            ]
        case .workload:
            let running   = tasks.filter { $0.status == .running }.count
            let idleCount = agents.filter { $0.status == .idle }.count
            return [
                ("Total Tasks", "\(tasks.count)", ClawColors.accent),
                ("Agents",      "\(agents.count)", ClawColors.textPrimary),
                ("Running",     "\(running)",      ClawColors.accentGreen),
                ("Idle Agents", "\(idleCount)",    ClawColors.accentOrange),
            ]
        case .budget:
            let spend  = agents.reduce(0.0) { $0 + $1.budgetUsed }
            let limit  = agents.reduce(0.0) { $0 + ($1.budgetLimit ?? 0) }
            let remain = max(0, limit - spend)
            return [
                ("Spend",     String(format: "$%.2f", spend),  ClawColors.accentOrange),
                ("Budget",    limit > 0 ? String(format: "$%.2f", limit) : "—", ClawColors.textPrimary),
                ("Remaining", limit > 0 ? String(format: "$%.2f", remain) : "—", ClawColors.accentGreen),
                ("Agents",    "\(agents.count)",               ClawColors.textSecondary),
            ]
        case .incident:
            let total    = incidents.count
            let critical = incidents.filter { $0.severity == .critical }.count
            let resolved = incidents.filter { $0.status == .resolved || $0.status == .closed }.count
            let open     = incidents.filter { $0.status == .open }.count
            return [
                ("Total",    "\(total)",    ClawColors.textPrimary),
                ("Critical", "\(critical)", ClawColors.accentRed),
                ("Resolved", "\(resolved)", ClawColors.accentGreen),
                ("Open",     "\(open)",     ClawColors.accentOrange),
            ]
        case .wrapUp:
            let wrapUps = vm.wrapUpReports
            let cal = Calendar.current
            let thisWeek = wrapUps.filter { cal.isDate($0.createdAt, equalTo: Date(), toGranularity: .weekOfYear) }.count
            let uniqueThreads = Set(wrapUps.map(\.threadId)).count
            let avgLen = wrapUps.isEmpty ? 0 : wrapUps.reduce(0) { $0 + $1.messageCount } / wrapUps.count
            return [
                ("Generated", "\(wrapUps.count)", Color(hex: "#40C8E0")),
                ("This Week", "\(thisWeek)",       ClawColors.textSecondary),
                ("Threads",   "\(uniqueThreads)",  ClawColors.textTertiary),
                ("Avg Length","\(avgLen) msgs",    ClawColors.textTertiary),
            ]
        case .custom:
            return []
        }
    }

    private var successRateData: [DailyMetric] {
        guard let metrics = reportsVM?.performanceMetrics, !metrics.isEmpty else { return [] }
        let cal = Calendar.current
        let grouped = Dictionary(grouping: metrics) { cal.startOfDay(for: $0.periodStart) }
        let dayFormatter = DateFormatter()
        dayFormatter.dateFormat = "EEE"
        return grouped.keys.sorted().map { day in
            let dayMetrics = grouped[day]!
            let avgRate = dayMetrics.reduce(0.0) { $0 + $1.successRate } / Double(dayMetrics.count)
            return DailyMetric(day: dayFormatter.string(from: day), value: avgRate * 100, label: String(format: "%.0f%%", avgRate * 100))
        }
    }

    private var workloadData: [TeamWorkloadData] {
        guard let metrics = reportsVM?.performanceMetrics, !metrics.isEmpty else { return [] }
        let agents = appStore.agents
        let grouped = Dictionary(grouping: metrics) { metric -> String in
            agents.first(where: { $0.id == metric.agentId })?.teamId ?? "Unknown"
        }
        return grouped.compactMap { (teamId, teamMetrics) -> TeamWorkloadData? in
            guard teamId != "Unknown" else { return nil }
            let teamName = appStore.teams.first(where: { $0.id == teamId })?.name ?? teamId
            let completed = Double(teamMetrics.reduce(0) { $0 + $1.tasksCompleted })
            let failed = Double(teamMetrics.reduce(0) { $0 + $1.tasksFailed })
            return TeamWorkloadData(team: teamName, completed: completed, failed: failed)
        }.sorted { $0.completed > $1.completed }
    }

    private var budgetData: [BudgetData] {
        guard let metrics = reportsVM?.performanceMetrics, !metrics.isEmpty else { return [] }
        let agents = appStore.agents
        let sorted = metrics.sorted { $0.cost > $1.cost }.prefix(5)
        return sorted.map { metric in
            let agentName = agents.first(where: { $0.id == metric.agentId })?.name ?? metric.agentId
            return BudgetData(agent: agentName, spend: metric.cost)
        }
    }

    private var reliabilityChartData: [DailyMetric] {
        guard let metrics = reportsVM?.performanceMetrics, !metrics.isEmpty else { return [] }
        let cal = Calendar.current
        let grouped = Dictionary(grouping: metrics) { cal.startOfDay(for: $0.periodStart) }
        let dayFormatter = DateFormatter()
        dayFormatter.dateFormat = "EEE"
        return grouped.keys.sorted().map { day in
            let total = Double(grouped[day]!.reduce(0) { $0 + $1.incidentCount })
            return DailyMetric(day: dayFormatter.string(from: day), value: total, label: "\(Int(total))")
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: ClawSpacing.lg) {
                        periodSelector
                        typeSelector
                        summaryCards
                        chartSection
                        pastReportsSection
                    }
                    .padding(.horizontal, ClawSpacing.lg)
                    .padding(.top, ClawSpacing.md)
                    .padding(.bottom, ClawSpacing.xxxl)
                }
            }
            .navigationTitle("Reports")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        vm.showGenerateSheet = true
                    } label: {
                        Label("Generate", systemImage: "plus")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(ClawColors.accent)
                    }
                }
            }
            .sheet(isPresented: $vm.showGenerateSheet) {
                generateReportSheet
            }
            .sheet(item: $vm.selectedReport) { report in
                ReportDetailSheet(report: report)
            }
            .task {
                if let wsId = appStore.selectedWorkspace?.id {
                    let apiVM = ReportsViewModel(workspaceId: wsId)
                    reportsVM = apiVM
                    await apiVM.loadReports()
                    vm.reports = apiVM.reports
                    vm.wrapUpReports = apiVM.wrapUpReports
                    let periodStr: String
                    switch vm.selectedPeriod {
                    case .today:  periodStr = "daily"
                    case .week:   periodStr = "weekly"
                    case .month:  periodStr = "monthly"
                    case .custom: periodStr = "weekly"
                    }
                    await apiVM.loadPerformanceMetrics(period: periodStr)
                }
            }
            .onChange(of: vm.selectedPeriod) { _, newPeriod in
                if let apiVM = reportsVM {
                    let periodStr: String
                    switch newPeriod {
                    case .today:  periodStr = "daily"
                    case .week:   periodStr = "weekly"
                    case .month:  periodStr = "monthly"
                    case .custom: periodStr = "weekly"
                    }
                    _Concurrency.Task { await apiVM.loadPerformanceMetrics(period: periodStr) }
                }
            }
        }
    }

    // MARK: - Period Selector

    private var periodSelector: some View {
        HStack(spacing: ClawSpacing.xs) {
            ForEach(ReportsViewState.ReportPeriod.allCases, id: \.self) { period in
                periodButton(period)
            }
        }
    }

    private func periodButton(_ period: ReportsViewState.ReportPeriod) -> some View {
        let isSelected = vm.selectedPeriod == period
        return Button {
            withAnimation(.easeInOut(duration: 0.15)) { vm.selectedPeriod = period }
        } label: {
            Text(period.rawValue)
                .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                .foregroundStyle(isSelected ? Color.white : ClawColors.textSecondary)
                .frame(maxWidth: .infinity)
                .padding(.vertical, ClawSpacing.sm)
                .background(isSelected ? ClawColors.accent : ClawColors.backgroundTertiary)
                .cornerRadius(ClawRadius.sm)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Type Selector

    private var typeSelector: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: ClawSpacing.sm) {
                ForEach([ReportType.performance, .reliability, .workload, .budget, .incident, .wrapUp], id: \.self) { type in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) {
                            vm.selectedType = type
                        }
                    } label: {
                        HStack(spacing: ClawSpacing.xs) {
                            Image(systemName: type.icon)
                                .font(.system(size: 11))
                            Text(type.displayLabel)
                                .font(ClawFonts.label)
                        }
                        .foregroundStyle(vm.selectedType == type ? .white : ClawColors.textSecondary)
                        .padding(.horizontal, ClawSpacing.md)
                        .padding(.vertical, ClawSpacing.xs)
                        .background(vm.selectedType == type ? type.accentColor : ClawColors.backgroundTertiary)
                        .clipShape(Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // MARK: - Summary Cards

    private var summaryCards: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: ClawSpacing.sm) {
            ForEach(summaryStats, id: \.label) { stat in
                VStack(spacing: ClawSpacing.xs) {
                    Text(stat.value)
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(stat.color)
                    Text(stat.label)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(ClawColors.textSecondary)
                        .textCase(.uppercase)
                }
                .frame(maxWidth: .infinity)
                .padding(ClawSpacing.lg)
                .background(ClawColors.backgroundCard)
                .cornerRadius(ClawRadius.card)
                .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
            }
        }
    }

    // MARK: - Chart Section

    @ViewBuilder
    private var chartSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text(chartTitle)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(ClawColors.textPrimary)

            switch vm.selectedType {
            case .performance:
                performanceChart
            case .reliability:
                reliabilityChart
            case .workload:
                workloadChart
            case .budget:
                budgetChart
            case .incident:
                incidentChart
            case .wrapUp:
                EmptyView()
            case .custom:
                EmptyView()
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
    }

    private var chartTitle: String {
        let period: String
        switch vm.selectedPeriod {
        case .today:  period = "Today"
        case .week:   period = "This Week"
        case .month:  period = "This Month"
        case .custom: period = "Custom Range"
        }
        switch vm.selectedType {
        case .performance: return "Success Rate — \(period)"
        case .reliability: return "Incident Frequency — \(period)"
        case .workload:    return "Tasks by Team — \(period)"
        case .budget:      return "Spend by Agent — \(period)"
        case .incident:    return "Incidents — \(period)"
        case .wrapUp:      return "Wrap-Up Reports — \(period)"
        case .custom:      return "Custom Report — \(period)"
        }
    }

    private var performanceChart: some View {
        Chart(successRateData) { item in
            LineMark(
                x: .value("Day", item.day),
                y: .value("Rate", item.value)
            )
            .foregroundStyle(ClawColors.accent)
            .interpolationMethod(.catmullRom)

            AreaMark(
                x: .value("Day", item.day),
                y: .value("Rate", item.value)
            )
            .foregroundStyle(
                LinearGradient(
                    colors: [ClawColors.accent.opacity(0.3), ClawColors.accent.opacity(0)],
                    startPoint: .top, endPoint: .bottom
                )
            )
            .interpolationMethod(.catmullRom)

            PointMark(
                x: .value("Day", item.day),
                y: .value("Rate", item.value)
            )
            .foregroundStyle(ClawColors.accent)
            .symbolSize(36)
        }
        .chartYScale(domain: 70...100)
        .chartYAxis {
            AxisMarks(values: [75, 85, 95, 100]) { value in
                AxisGridLine().foregroundStyle(ClawColors.separator)
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text("\(Int(v))%")
                            .font(.system(size: 10))
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let s = value.as(String.self) {
                        Text(s)
                            .font(.system(size: 10))
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
        }
        .frame(height: 180)
    }

    private var reliabilityChart: some View {
        Chart(reliabilityChartData) { item in
            BarMark(
                x: .value("Day", item.day),
                y: .value("Incidents", item.value)
            )
            .foregroundStyle(item.value > 0 ? ClawColors.accentRed : ClawColors.accentGreen)
            .cornerRadius(4)
        }
        .chartYAxis {
            AxisMarks { value in
                AxisGridLine().foregroundStyle(ClawColors.separator)
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text("\(Int(v))")
                            .font(.system(size: 10))
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let s = value.as(String.self) {
                        Text(s)
                            .font(.system(size: 10))
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
        }
        .frame(height: 180)
    }

    private var workloadChart: some View {
        Chart {
            ForEach(workloadData) { item in
                BarMark(
                    x: .value("Team", item.team),
                    y: .value("Tasks", item.completed),
                    stacking: .standard
                )
                .foregroundStyle(ClawColors.accentGreen)
                .cornerRadius(4)

                BarMark(
                    x: .value("Team", item.team),
                    y: .value("Tasks", item.failed),
                    stacking: .standard
                )
                .foregroundStyle(ClawColors.accentRed.opacity(0.7))
            }
        }
        .chartYAxis {
            AxisMarks { value in
                AxisGridLine().foregroundStyle(ClawColors.separator)
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text("\(Int(v))")
                            .font(.system(size: 10))
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
        }
        .chartXAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let s = value.as(String.self) {
                        Text(s)
                            .font(.system(size: 9))
                            .foregroundStyle(ClawColors.textTertiary)
                            .lineLimit(2)
                    }
                }
            }
        }
        .frame(height: 180)
    }

    private var budgetChart: some View {
        Chart(budgetData) { item in
            BarMark(
                x: .value("Spend", item.spend),
                y: .value("Agent", item.agent)
            )
            .foregroundStyle(
                LinearGradient(
                    colors: [ClawColors.accentOrange, ClawColors.accentOrange.opacity(0.6)],
                    startPoint: .leading, endPoint: .trailing
                )
            )
            .cornerRadius(4)
            .annotation(position: .trailing) {
                Text(String(format: "$%.2f", item.spend))
                    .font(.system(size: 10))
                    .foregroundStyle(ClawColors.textSecondary)
            }
        }
        .chartXAxis {
            AxisMarks { value in
                AxisGridLine().foregroundStyle(ClawColors.separator)
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text("$\(Int(v))")
                            .font(.system(size: 10))
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
        }
        .chartYAxis {
            AxisMarks { value in
                AxisValueLabel {
                    if let s = value.as(String.self) {
                        Text(s)
                            .font(.system(size: 10))
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
        }
        .frame(height: 200)
    }

    private var incidentChart: some View {
        Chart(reliabilityChartData) { item in
            BarMark(x: .value("Day", item.day), y: .value("Count", item.value))
                .foregroundStyle(ClawColors.accentRed.opacity(0.8))
                .cornerRadius(4)
        }
        .chartYAxis {
            AxisMarks { value in
                AxisGridLine().foregroundStyle(ClawColors.separator)
                AxisValueLabel {
                    if let v = value.as(Double.self) {
                        Text("\(Int(v))")
                            .font(.system(size: 10))
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
        }
        .frame(height: 180)
    }

    // MARK: - Past Reports

    private var pastReportsSection: some View {
        Group {
            if vm.selectedType == .wrapUp {
                wrapUpReportsSection
            } else {
                snapshotReportsSection
            }
        }
    }

    private var wrapUpReportsSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("Wrap-Up Reports")
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .textCase(.uppercase)

            if vm.wrapUpReports.isEmpty {
                Text("No wrap-up reports yet.")
                    .font(ClawFonts.cardBody)
                    .foregroundStyle(ClawColors.textTertiary)
                    .padding(.vertical, ClawSpacing.md)
            } else {
                ForEach(vm.wrapUpReports) { report in
                    wrapUpReportRow(report: report)
                    if report.id != vm.wrapUpReports.last?.id {
                        Divider().background(ClawColors.separatorLight)
                    }
                }
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
        .sheet(item: $vm.selectedWrapUpReport) { report in
            WrapUpReportDetailSheet(report: report)
        }
    }

    private func wrapUpReportRow(report: ThreadWrapUpReport) -> some View {
        Button {
            vm.selectedWrapUpReport = report
        } label: {
            HStack(spacing: ClawSpacing.md) {
                Image(systemName: "doc.text.fill")
                    .font(.system(size: 18))
                    .foregroundStyle(Color(hex: "#40C8E0"))
                    .frame(width: 28)

                VStack(alignment: .leading, spacing: 2) {
                    Text(report.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                        .lineLimit(2)
                    HStack(spacing: ClawSpacing.xs) {
                        Text("\(report.messageCount) msgs")
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                        Text("·")
                            .foregroundStyle(ClawColors.textTertiary)
                        Text(report.model)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textTertiary)
                            .lineLimit(1)
                        Spacer()
                        Text(report.createdAt.chatTimestamp)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var snapshotReportsSection: some View {
        VStack(alignment: .leading, spacing: ClawSpacing.md) {
            Text("Past Reports")
                .font(ClawFonts.sectionHeader)
                .foregroundStyle(ClawColors.textSecondary)
                .textCase(.uppercase)

            ForEach(vm.reports) { report in
                reportRow(report: report)
                if report.id != vm.reports.last?.id {
                    Divider().background(ClawColors.separatorLight)
                }
            }
        }
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
    }

    private func reportRow(report: ReportSnapshot) -> some View {
        Button {
            vm.selectedReport = report
        } label: {
            HStack(spacing: ClawSpacing.md) {
                Image(systemName: report.type.icon)
                    .font(.system(size: 18))
                    .foregroundStyle(report.type.accentColor)
                    .frame(width: 28)

                VStack(alignment: .leading, spacing: 2) {
                    Text(report.title)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(ClawColors.textPrimary)
                        .lineLimit(1)
                    HStack(spacing: ClawSpacing.xs) {
                        Text(report.type.displayLabel)
                            .font(ClawFonts.caption)
                            .foregroundStyle(report.type.accentColor)
                        Text("·")
                            .foregroundStyle(ClawColors.textTertiary)
                        Text(report.period.rawValue.capitalized)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textSecondary)
                        Text("·")
                            .foregroundStyle(ClawColors.textTertiary)
                        Text(report.createdAt.chatTimestamp)
                            .font(ClawFonts.caption)
                            .foregroundStyle(ClawColors.textTertiary)
                    }
                }

                Spacer()

                Button {
                    // share action
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .font(.system(size: 14))
                        .foregroundStyle(ClawColors.accent)
                }
                .buttonStyle(.plain)

                Image(systemName: "chevron.right")
                    .font(.system(size: 11))
                    .foregroundStyle(ClawColors.textTertiary)
            }
        }
        .buttonStyle(.plain)
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            Button(role: .destructive) {
                _Concurrency.Task {
                    _ = try? await APIClient.shared.request(.archiveReport(id: report.id)) as ReportSnapshot
                    vm.reports.removeAll { $0.id == report.id }
                }
            } label: {
                Label("Archive", systemImage: "archivebox.fill")
            }
        }
    }

    // MARK: - Generate Report Sheet

    private var generateReportSheet: some View {
        NavigationStack {
            VStack(spacing: ClawSpacing.lg) {
                Form {
                    Section("Report Type") {
                        Picker("Type", selection: $vm.selectedType) {
                            ForEach([ReportType.performance, .reliability, .workload, .budget, .incident, .wrapUp], id: \.self) { t in
                                Label(t.displayLabel, systemImage: t.icon).tag(t)
                            }
                        }
                        .pickerStyle(.menu)
                        .foregroundStyle(ClawColors.textPrimary)
                    }
                    .listRowBackground(ClawColors.backgroundCard)

                    Section("Period") {
                        Picker("Period", selection: $vm.selectedPeriod) {
                            ForEach(ReportsViewState.ReportPeriod.allCases, id: \.self) { p in
                                Text(p.rawValue).tag(p)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                    .listRowBackground(ClawColors.backgroundCard)
                }
                .scrollContentBackground(.hidden)
                .background(ClawColors.backgroundPrimary)

                let isGenerating = reportsVM?.isGenerating ?? vm.isGenerating
                if isGenerating {
                    VStack(spacing: ClawSpacing.md) {
                        ProgressView()
                            .scaleEffect(1.2)
                            .tint(ClawColors.accent)
                        Text("Generating report…")
                            .font(ClawFonts.cardBody)
                            .foregroundStyle(ClawColors.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, ClawSpacing.xl)
                } else {
                    Button {
                        if let apiVM = reportsVM {
                            apiVM.selectedType = vm.selectedType
                            let period: MetricPeriod = {
                                switch vm.selectedPeriod {
                                case .today:  return .daily
                                case .week:   return .weekly
                                case .month:  return .monthly
                                case .custom: return .custom
                                }
                            }()
                            apiVM.selectedPeriod = period
                            _Concurrency.Task {
                                try? await apiVM.generateReport()
                                vm.reports = apiVM.reports
                                vm.showGenerateSheet = false
                            }
                        } else {
                            vm.generateReport()
                        }
                    } label: {
                        Text("Generate Report")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, ClawSpacing.md)
                            .background(ClawColors.accent)
                            .cornerRadius(ClawRadius.md)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, ClawSpacing.lg)
                }

                Spacer()
            }
            .background(ClawColors.backgroundPrimary.ignoresSafeArea())
            .navigationTitle("New Report")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundSecondary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { vm.showGenerateSheet = false }
                        .foregroundStyle(ClawColors.accent)
                }
            }
        }
        .presentationDetents([.medium])
        .presentationBackground(ClawColors.backgroundPrimary)
    }
}

// MARK: - Report Detail Sheet

struct ReportDetailSheet: View {
    let report: ReportSnapshot
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ZStack {
                ClawColors.backgroundPrimary.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: ClawSpacing.lg) {
                        HStack {
                            Image(systemName: report.type.icon)
                                .font(.system(size: 24))
                                .foregroundStyle(report.type.accentColor)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(report.title)
                                    .font(.system(size: 18, weight: .bold))
                                    .foregroundStyle(ClawColors.textPrimary)
                                Text("\(report.period.rawValue.capitalized) · \(report.periodStart.chatTimestamp) – \(report.periodEnd.chatTimestamp)")
                                    .font(ClawFonts.caption)
                                    .foregroundStyle(ClawColors.textSecondary)
                            }
                        }
                        .padding(ClawSpacing.lg)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(ClawColors.backgroundCard)
                        .cornerRadius(ClawRadius.card)
                        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))

                        statsGrid
                    }
                    .padding(ClawSpacing.lg)
                }
            }
            .navigationTitle("Report")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundPrimary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                        .foregroundStyle(ClawColors.accent)
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        // share
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                            .foregroundStyle(ClawColors.accent)
                    }
                }
            }
        }
        .presentationBackground(ClawColors.backgroundPrimary)
    }

    private var statsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: ClawSpacing.sm) {
            statCell("Total Tasks",  "\(report.data.totalTasks)",    ClawColors.accent)
            statCell("Completed",    "\(report.data.completedTasks)", ClawColors.accentGreen)
            statCell("Failed",       "\(report.data.failedTasks)",   ClawColors.accentRed)
            statCell("Success Rate", String(format: "%.1f%%", report.data.successRate * 100), ClawColors.accentGreen)
            statCell("Active Agents","\(report.data.activeAgents)", ClawColors.textPrimary)
            statCell("Total Cost",   String(format: "$%.2f", report.data.totalCost), ClawColors.accentOrange)
        }
    }

    private func statCell(_ label: String, _ value: String, _ color: Color) -> some View {
        VStack(spacing: ClawSpacing.xs) {
            Text(value)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(color)
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(ClawColors.textSecondary)
                .textCase(.uppercase)
        }
        .frame(maxWidth: .infinity)
        .padding(ClawSpacing.lg)
        .background(ClawColors.backgroundCard)
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
    }
}

// MARK: - Extensions

extension ReportType {
    var displayLabel: String {
        switch self {
        case .performance: return "Performance"
        case .reliability: return "Reliability"
        case .workload:    return "Workload"
        case .budget:      return "Budget"
        case .incident:    return "Incidents"
        case .wrapUp:      return "Wrap-Up"
        case .custom:      return "Custom"
        }
    }

    var icon: String {
        switch self {
        case .performance: return "chart.line.uptrend.xyaxis"
        case .reliability: return "checkmark.shield.fill"
        case .workload:    return "person.3.fill"
        case .budget:      return "dollarsign.circle.fill"
        case .incident:    return "exclamationmark.triangle.fill"
        case .wrapUp:      return "doc.text.fill"
        case .custom:      return "doc.badge.gearshape"
        }
    }

    var accentColor: Color {
        switch self {
        case .performance: return ClawColors.accent
        case .reliability: return ClawColors.accentGreen
        case .workload:    return ClawColors.accentPurple
        case .budget:      return ClawColors.accentOrange
        case .incident:    return ClawColors.accentRed
        case .wrapUp:      return Color(hex: "#40C8E0")
        case .custom:      return ClawColors.textSecondary
        }
    }
}

// MARK: - Mock Data

extension ReportSnapshot {
    static let mockReports: [ReportSnapshot] = {
        let now = Date()
        let data = ReportData(totalTasks: 142, completedTasks: 134, failedTasks: 8, successRate: 0.944, totalAgents: 12, activeAgents: 9, totalMinutesWorked: 1240, totalCost: 42.18, incidentCount: 2, topAgents: [], teamSummaries: [])
        return [
            ReportSnapshot(id: "r1", title: "Weekly Performance Report", type: .performance, workspaceId: "ws1", period: .weekly, periodStart: now.addingTimeInterval(-604800), periodEnd: now, data: data, createdAt: now.addingTimeInterval(-3600)),
            ReportSnapshot(id: "r2", title: "Monthly Budget Report", type: .budget, workspaceId: "ws1", period: .monthly, periodStart: now.addingTimeInterval(-2592000), periodEnd: now, data: data, createdAt: now.addingTimeInterval(-86400)),
            ReportSnapshot(id: "r3", title: "Incident Summary", type: .incident, workspaceId: "ws1", period: .weekly, periodStart: now.addingTimeInterval(-604800), periodEnd: now, data: data, createdAt: now.addingTimeInterval(-172800)),
        ]
    }()
}

// MARK: - WrapUpReportDetailSheet

struct WrapUpReportDetailSheet: View {
    let report: ThreadWrapUpReport

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: ClawSpacing.lg) {
                    // Meta
                    VStack(alignment: .leading, spacing: ClawSpacing.xs) {
                        metaRow("Source", value: "Chat wrap-up")
                        if let sequence = report.threadSessionSequenceNumber {
                            metaRow("Cycle", value: "Cycle \(sequence)")
                        }
                        metaRow("Provider", value: report.provider)
                        metaRow("Model", value: report.model)
                        metaRow("Status", value: statusLabel)
                        metaRow("Messages", value: "\(report.messageCount)")
                        metaRow("Created", value: report.createdAt.chatTimestamp)
                        metaRow("File", value: report.fileName)
                    }
                    .padding(ClawSpacing.lg)
                    .background(ClawColors.backgroundCard)
                    .cornerRadius(ClawRadius.card)
                    .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))

                    if report.status == "generating" {
                        reportCallout(
                            title: "Generating",
                            message: "This report is still generating. The chat cycle has already been archived safely.",
                            color: ClawColors.accent
                        )
                    } else if report.status == "failed" {
                        reportCallout(
                            title: "Generation failed",
                            message: report.errorMessage ?? "The chat cycle was archived, but report generation failed.",
                            color: ClawColors.accentRed
                        )
                    }

                    VStack(alignment: .leading, spacing: ClawSpacing.md) {
                        Text("Report")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(ClawColors.textPrimary)

                        ReadableMarkdownView(markdown: report.markdown)
                    }
                    .padding(ClawSpacing.lg)
                    .background(ClawColors.backgroundCard)
                    .cornerRadius(ClawRadius.card)
                    .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(ClawColors.separator, lineWidth: 0.5))
                }
                .padding(ClawSpacing.lg)
                .padding(.bottom, ClawSpacing.xxxl)
            }
            .background(ClawColors.backgroundPrimary.ignoresSafeArea())
            .navigationTitle(report.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(ClawColors.backgroundSecondary, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .presentationBackground(ClawColors.backgroundPrimary)
    }

    private var statusLabel: String {
        switch report.status {
        case "generating": return "Generating"
        case "failed": return "Failed"
        case "completed", "ready": return "Completed"
        case .some(let value): return value.replacingOccurrences(of: "_", with: " ").capitalized
        case nil: return "Completed"
        }
    }

    private func reportCallout(title: String, message: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: ClawSpacing.xs) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(color)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(ClawColors.textPrimary.opacity(0.86))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(ClawSpacing.lg)
        .background(color.opacity(0.08))
        .cornerRadius(ClawRadius.card)
        .overlay(RoundedRectangle(cornerRadius: ClawRadius.card).stroke(color.opacity(0.22), lineWidth: 1))
    }

    private func metaRow(_ label: String, value: String) -> some View {
        HStack(alignment: .top) {
            Text(label)
                .font(ClawFonts.caption)
                .foregroundStyle(ClawColors.textSecondary)
                .frame(width: 80, alignment: .leading)
            Text(value)
                .font(ClawFonts.caption)
                .foregroundStyle(ClawColors.textPrimary)
                .lineLimit(3)
            Spacer()
        }
    }
}

// MARK: - Preview

#Preview {
    ReportsView()
        .preferredColorScheme(.dark)
}
