import AppKit
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

struct InsightsSidebarPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(spacing: 12) {
      SidebarSectionHeader(
        title: "Insights", subtitle: "Reports and signals", icon: "chart.line.uptrend.xyaxis"
      ) {
        StatusBadge(
          title: "\(model.insightsReportList?.filteredCount ?? 0)", tone: .blue,
          accessibilityLabelText: "Filtered reports")
      }
      SearchField(
        text: Binding(get: { model.insightsSearch }, set: { model.setInsightsSearch($0) }),
        placeholder: "Search reports..."
      )
      InsightsFilterBar()
      ScrollView {
        LazyVStack(spacing: 8) {
          if model.insightsReportList == nil {
            EmptyMini(
              title: "Loading...",
              body: "Loading reports from local source records."
            )
          }
          let groups = model.insightsReportList?.groups ?? []
          if model.insightsReportList != nil && groups.isEmpty {
            EmptyMini(
              title: model.insightsReportList?.state == .noMatch
                ? "No matching reports" : "No reports yet",
              body: model.insightsReportList?.emptyReason
                ?? "Wrap up a chat to populate the reports centre."
            )
          }
          ForEach(groups) { group in
            InsightsReportGroupCard(group: group)
          }
        }
      }
    }
    .sidebarPanelChrome()
  }
}

struct InsightsFilterBar: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(spacing: 8) {
      HStack(spacing: 6) {
        ForEach(InsightsReportSourceFilter.allCases, id: \.self) { filter in
          if model.insightsSourceFilter == filter {
            Button(insightsFilterLabel(filter)) {
              model.setInsightsSourceFilter(filter)
            }
            .buttonStyle(PrimaryLightButtonStyle())
          } else {
            Button(insightsFilterLabel(filter)) {
              model.setInsightsSourceFilter(filter)
            }
            .buttonStyle(SecondaryLightButtonStyle())
          }
        }
      }
      HStack(spacing: 6) {
        ForEach(InsightsReportSort.allCases, id: \.self) { sort in
          if model.insightsSort == sort {
            Button(insightsSortLabel(sort)) {
              model.setInsightsSort(sort)
            }
            .buttonStyle(PrimaryLightButtonStyle())
          } else {
            Button(insightsSortLabel(sort)) {
              model.setInsightsSort(sort)
            }
            .buttonStyle(SecondaryLightButtonStyle())
          }
        }
        Button {
          model.toggleInsightsArchived()
        } label: {
          Image(systemName: model.insightsIncludeArchived ? "archivebox.fill" : "archivebox")
        }
        .buttonStyle(IconButtonStyle())
        .help(model.insightsIncludeArchived ? "Hide archived reports" : "Show archived reports")
        .accessibilityLabel(
          model.insightsIncludeArchived ? "Hide archived reports" : "Show archived reports")
      }
    }
  }
}

struct InsightsReportGroupCard: View {
  @EnvironmentObject var model: AppViewModel
  let group: InsightsReportGroup

  var collapsed: Bool {
    group.isCollapsible && model.collapsedInsightsGroupIds.contains(group.id)
  }

  var selected: Bool {
    group.rows.contains { $0.id == model.selectedInsightsRow?.id }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        if group.isCollapsible {
          Button {
            model.toggleInsightsGroup(group)
          } label: {
            Image(systemName: collapsed ? "chevron.right" : "chevron.down")
          }
          .buttonStyle(IconButtonStyle())
          .help(collapsed ? "Expand \(group.title)" : "Collapse \(group.title)")
          .accessibilityLabel(collapsed ? "Expand \(group.title)" : "Collapse \(group.title)")
        }
        VStack(alignment: .leading, spacing: 3) {
          Text(group.title)
            .font(.system(size: 12, weight: .bold))
            .lineLimit(1)
          Text(group.subtitle)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
            .lineLimit(1)
        }
        Spacer()
        StatusBadge(
          title: group.badge, tone: group.badge == "Snapshots" ? .purple : .blue,
          accessibilityLabelText: group.badge)
        Text(relativeTime(group.updatedAt))
          .font(.system(size: 10, weight: .semibold))
          .foregroundStyle(RCTheme.muted)
        Button {
          model.archiveInsightsGroup(group)
        } label: {
          Image(systemName: "archivebox")
        }
        .buttonStyle(IconButtonStyle())
        .disabled(group.archivedAt != nil || group.rows.allSatisfy { $0.archivedAt != nil })
        .help("Archive \(group.title)")
        .accessibilityLabel("Archive \(group.title)")
      }
      if !collapsed {
        ForEach(group.rows) { row in
          InsightsReportRowButton(row: row, selected: model.selectedInsightsRow?.id == row.id)
        }
      }
    }
    .padding(8)
    .background(selected ? RCTheme.sidebarSelected.opacity(0.72) : RCTheme.sidebarSurfaceAlt)
    .clipShape(RoundedRectangle(cornerRadius: 4))
    .overlay(
      RoundedRectangle(cornerRadius: 4).stroke(selected ? RCTheme.borderStrong : RCTheme.borderSoft)
    )
  }
}

struct InsightsReportRowButton: View {
  @EnvironmentObject var model: AppViewModel
  let row: InsightsReportRow
  let selected: Bool

  var body: some View {
    HStack(alignment: .top, spacing: 6) {
      Button {
        model.selectInsightsReport(row)
      } label: {
        VStack(alignment: .leading, spacing: 6) {
          HStack(spacing: 8) {
            Text(row.cycleLabel ?? row.title)
              .font(.system(size: 13, weight: .semibold))
              .lineLimit(1)
            Spacer()
            StatusBadge(
              title: row.statusLabel, tone: insightsStatusTone(row.status),
              accessibilityLabelText: row.statusLabel)
          }
          Text(row.fileName ?? row.subtitle)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
            .lineLimit(2)
          HStack(spacing: 6) {
            if row.archivedAt != nil {
              StatusBadge(title: "Archived", tone: .neutral, accessibilityLabelText: "Archived")
            }
            if let provider = row.provider {
              StatusBadge(title: provider, tone: .neutral, accessibilityLabelText: provider)
            }
            Spacer()
            Text(relativeTime(row.updatedAt))
              .font(.system(size: 10, weight: .semibold))
              .foregroundStyle(RCTheme.muted)
          }
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(selected ? RCTheme.sidebarSelected : RCTheme.sidebarSurface)
        .clipShape(RoundedRectangle(cornerRadius: 4))
        .overlay(
          RoundedRectangle(cornerRadius: 4).stroke(
            selected ? RCTheme.borderStrong : RCTheme.borderSoft))
      }
      .buttonStyle(.plain)
      .help("Open \(row.title)")
      .accessibilityLabel("Open report \(row.title)")
      Button {
        model.archiveInsightsReport(row)
      } label: {
        Image(systemName: "archivebox")
      }
      .buttonStyle(IconButtonStyle())
      .disabled(row.archivedAt != nil)
      .help(row.archivedAt == nil ? "Archive \(row.title)" : "Archive unavailable")
      .accessibilityLabel("Archive \(row.title)")
    }
  }
}

struct InsightsScreen: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    VStack(spacing: 0) {
      InsightsHeader()
      ScrollView {
        VStack(spacing: 14) {
          InsightsSummaryStrip()
          if let status = model.insightsStatus {
            InsightsBanner(text: status, tone: .green)
          }
          if model.insightsReportDetail == nil {
            FormCard {
              EmptyMiniLight(
                title: "Select a report",
                body: "Choose a report from the left to inspect the generated snapshot."
              )
            }
          } else if model.insightsShowingAnalytics {
            InsightsAnalyticsPanel()
          } else {
            InsightsReportDetailPanel()
          }
        }
        .padding(18)
      }
    }
    .accessibilityLabel("Insights")
  }
}

struct InsightsHeader: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    HStack(spacing: 12) {
      Spacer()
      if !model.insightsShowingAnalytics {
        Button("Report") {
          model.setInsightsShowingAnalytics(false)
        }
        .buttonStyle(PrimaryLightButtonStyle())
      } else {
        Button("Report") {
          model.setInsightsShowingAnalytics(false)
        }
        .buttonStyle(SecondaryLightButtonStyle())
      }
      if model.insightsShowingAnalytics {
        Button("Analytics") {
          model.setInsightsShowingAnalytics(true)
        }
        .buttonStyle(PrimaryLightButtonStyle())
      } else {
        Button("Analytics") {
          model.setInsightsShowingAnalytics(true)
        }
        .buttonStyle(SecondaryLightButtonStyle())
      }
      Button {
        model.archiveSelectedInsightsReport()
      } label: {
        Label("Archive", systemImage: "archivebox")
      }
      .buttonStyle(SecondaryLightButtonStyle())
      .disabled(model.insightsReportDetail?.archiveAvailable != true)
      .help(
        model.insightsReportDetail?.archiveAvailable == true
          ? "Archive \(model.insightsReportDetail?.row.title ?? "report")" : "Archive unavailable")
      Button {
        model.retrySelectedInsightsReport()
      } label: {
        Label(
          model.busy == "insights-retry" ? "Retrying..." : "Retry report",
          systemImage: "arrow.clockwise")
      }
      .buttonStyle(PrimaryLightButtonStyle())
      .disabled(
        model.insightsReportDetail?.retryAvailable != true || model.busy == "insights-retry"
      )
      .help(model.insightsReportDetail?.retryUnavailableReason ?? "Retry report")
    }
    .padding(.horizontal, 18)
    .padding(.vertical, 14)
    .overlay(alignment: .bottom) {
      Rectangle().fill(RCTheme.border.opacity(0.32)).frame(height: 1)
    }
  }
}

struct InsightsSummaryStrip: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    HStack(spacing: 8) {
      ApplicationsDiagnosticPill(
        title: "State", value: model.insightsReportList?.state.rawValue ?? "loading")
      ApplicationsDiagnosticPill(
        title: "Reports", value: "\(model.insightsReportList?.totalCount ?? 0)")
      ApplicationsDiagnosticPill(
        title: "Filtered", value: "\(model.insightsReportList?.filteredCount ?? 0)")
      ApplicationsDiagnosticPill(
        title: "Archived", value: "\(model.insightsReportList?.archivedCount ?? 0)")
      ApplicationsDiagnosticPill(
        title: "Source", value: insightsFilterLabel(model.insightsSourceFilter))
      Spacer(minLength: 0)
    }
  }
}

struct InsightsReportDetailPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    if let detail = model.insightsReportDetail {
      VStack(spacing: 14) {
        FormCard {
          VStack(alignment: .leading, spacing: 12) {
            HStack {
              VStack(alignment: .leading, spacing: 4) {
                Text(detail.row.title)
                  .font(.system(size: 20, weight: .bold))
                Text(detail.row.subtitle)
                  .font(.system(size: 12, weight: .semibold))
                  .foregroundStyle(RCTheme.muted)
              }
              Spacer()
              StatusBadge(
                title: detail.row.statusLabel, tone: insightsStatusTone(detail.row.status),
                accessibilityLabelText: detail.row.statusLabel)
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
              AgentOpsFact(
                label: "Source",
                value: detail.row.sourceType == .chatReport ? "Team chat wrap-up" : "Snapshot data")
              AgentOpsFact(label: "Messages", value: "\(detail.row.messageCount)")
              AgentOpsFact(label: "Provider", value: detail.row.provider ?? "Not recorded")
              AgentOpsFact(label: "Model", value: detail.row.model ?? "Not recorded")
              AgentOpsFact(label: "Created", value: relativeTime(detail.row.createdAt))
              AgentOpsFact(label: "File", value: detail.row.fileName ?? "Not available")
            }
            if detail.row.status == ThreadWrapUpStatus.generating.rawValue
              || detail.row.status == ThreadWrapUpStatus.pending.rawValue
            {
              InsightsBanner(
                text:
                  "This report is still generating. The chat has already been reset and the archived cycle is safe.",
                tone: .amber)
            }
            if detail.row.status == ThreadWrapUpStatus.failed.rawValue {
              InsightsBanner(
                text:
                  "Report generation failed. The chat cycle was still archived and reset safely.",
                tone: .red)
            }
            if let reason = detail.retryUnavailableReason {
              InsightsBanner(text: reason, tone: .neutral)
            }
          }
        }
        if let markdown = detail.markdown, !markdown.isEmpty {
          InsightsTextSection(title: "Markdown report", content: markdown, isMarkdown: true)
        }
        if !detail.structuredData.isEmpty {
          InsightsTextSection(
            title: "Structured data", content: encodeJSONRecord(detail.structuredData))
        }
        if !detail.snapshotData.isEmpty {
          InsightsTextSection(
            title: "Snapshot data", content: encodeJSONRecord(detail.snapshotData))
        }
      }
    }
  }
}

struct InsightsBanner: View {
  let text: String
  let tone: ComponentTone

  var body: some View {
    HStack(spacing: 8) {
      Image(systemName: tone == .red ? "exclamationmark.triangle.fill" : "info.circle")
        .foregroundStyle(tone.color)
      Text(text)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(RCTheme.text)
      Spacer()
    }
    .padding(10)
    .background(tone.color.opacity(0.12))
    .clipShape(RoundedRectangle(cornerRadius: 4))
  }
}

struct InsightsTextSection: View {
  let title: String
  let content: String
  var isMarkdown: Bool = false

  var body: some View {
    FormCard {
      VStack(alignment: .leading, spacing: 10) {
        Text(title)
          .font(.system(size: 14, weight: .semibold))
        if isMarkdown {
          RelayMarkdownSurface(markdown: content, compact: true)
            .frame(maxHeight: 520)
        } else {
          Text(content)
            .font(.system(size: 12, design: .monospaced))
            .foregroundStyle(RCTheme.muted)
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      }
    }
  }
}

struct InsightsAnalyticsPanel: View {
  @EnvironmentObject var model: AppViewModel

  var body: some View {
    NativeGroupedSection {
      VStack(alignment: .leading, spacing: 14) {
        HStack {
          VStack(alignment: .leading, spacing: 4) {
            Text("Thread Analytics")
              .font(.system(size: 18, weight: .bold))
            Text(
              model.insightsAnalytics?.emptyReason
                ?? "Sorted by total messages sent in this thread."
            )
            .font(.system(size: 12, weight: .semibold))
            .foregroundStyle(RCTheme.muted)
          }
          Spacer()
          Stepper(
            "Active gap \(model.insightsActivityGapMinutes)",
            value: Binding(
              get: { model.insightsActivityGapMinutes }, set: { model.setInsightsActivityGap($0) }),
            in: 1...1440
          )
          .frame(width: 180)
          Button("Export CSV") {
            model.copyInsightsAnalyticsCSV()
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(model.insightsAnalytics?.exportAvailable != true)
          Button("Export JSON") {
            model.copyInsightsAnalyticsJSON()
          }
          .buttonStyle(SecondaryLightButtonStyle())
          .disabled(model.insightsAnalytics?.exportAvailable != true)
        }
        if let analytics = model.insightsAnalytics, analytics.exportAvailable {
          LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 10)], spacing: 10) {
            AgentOpsFact(label: "Messages", value: "\(analytics.messageCount)")
            AgentOpsFact(label: "Senders", value: "\(analytics.senderCount)")
            AgentOpsFact(label: "Sessions", value: "\(analytics.sessionCount)")
            AgentOpsFact(label: "Thread length", value: analytics.threadLength)
            AgentOpsFact(
              label: "Your messages",
              value: "\(analytics.yourMessageCount ?? analytics.userMessageCount)")
            AgentOpsFact(label: "Agent messages", value: "\(analytics.agentMessageCount)")
            AgentOpsFact(label: "User messages", value: "\(analytics.userMessageCount)")
            AgentOpsFact(label: "Active windows", value: "\(analytics.activeWindowCount)")
            AgentOpsFact(
              label: "First message",
              value: analytics.firstMessageAt.map(relativeTime) ?? "Not available")
            AgentOpsFact(
              label: "Last message",
              value: analytics.lastMessageAt.map(relativeTime) ?? "Not available")
          }
          InsightsSenderList(senders: analytics.senders)
          InsightsActivePeriodList(
            periods: analytics.activePeriods, gapMinutes: analytics.activityGapMinutes)
          InsightsSessionList(sessions: analytics.sessions)
        } else {
          EmptyMiniLight(
            title: model.insightsReportDetail?.row.threadId == nil
              ? "Choose a chat" : "No analytics available for this thread yet.",
            body:
              "Select a chat report from the left to inspect message counts, active windows, and exportable history stats."
          )
        }
      }
    }
  }
}

struct InsightsSenderList: View {
  let senders: [ThreadAnalyticsSender]

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Messages By Sender")
        .font(.system(size: 14, weight: .semibold))
      Text("Sorted by total messages sent in this thread.")
        .font(.caption)
        .foregroundStyle(RCTheme.muted)
      ForEach(senders) { sender in
        HStack {
          Text(sender.senderName)
            .font(.system(size: 12, weight: .semibold))
          StatusBadge(
            title: sender.senderType.rawValue, tone: .neutral,
            accessibilityLabelText: sender.senderType.rawValue)
          Spacer()
          Text("\(sender.messageCount)")
            .font(.system(size: 12, weight: .bold))
        }
        .padding(8)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 4))
      }
    }
  }
}

struct InsightsActivePeriodList: View {
  let periods: [ThreadAnalyticsActivePeriod]
  let gapMinutes: Int

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Active Periods")
        .font(.system(size: 14, weight: .semibold))
      Text(
        "A new active window starts when the gap between messages exceeds \(gapMinutes) minutes."
      )
      .font(.caption)
      .foregroundStyle(RCTheme.muted)
      if periods.isEmpty {
        Text("No messages yet in this thread.")
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
      }
      ForEach(periods) { period in
        HStack {
          Text(period.title)
            .font(.system(size: 12, weight: .semibold))
          Spacer()
          Text("\(period.messageCount) messages")
            .font(.system(size: 12, weight: .bold))
        }
        .padding(8)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 4))
      }
    }
  }
}

struct InsightsSessionList: View {
  @EnvironmentObject var model: AppViewModel
  let sessions: [ThreadAnalyticsSession]

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Session Breakdown")
        .font(.system(size: 14, weight: .semibold))
      Text(
        "Shows wrapped-up team chat cycles alongside the current session. Repeat analysis only runs when you click Run Repeat Analysis for a specific session."
      )
      .font(.caption)
      .foregroundStyle(RCTheme.muted)
      if sessions.isEmpty {
        Text("No messages yet in this thread.")
          .font(.caption)
          .foregroundStyle(RCTheme.muted)
      }
      ForEach(sessions) { session in
        VStack(alignment: .leading, spacing: 8) {
          HStack {
            Text("Session \(session.sequenceNumber)")
              .font(.system(size: 12, weight: .semibold))
            StatusBadge(
              title: session.status.rawValue, tone: .blue,
              accessibilityLabelText: session.status.rawValue)
            Spacer()
            Text("\(session.messageCount) messages")
              .font(.system(size: 12, weight: .bold))
          }
          HStack(spacing: 6) {
            StatusBadge(
              title: "\(session.agentMessageCount) agent messages", tone: .green,
              accessibilityLabelText: "Agent messages")
            StatusBadge(
              title: "\(session.userMessageCount) yours", tone: .neutral,
              accessibilityLabelText: "Your messages")
            StatusBadge(
              title: session.repeatAnalysisStatus, tone: repeatAnalysisTone(session),
              accessibilityLabelText: session.repeatAnalysisStatus)
            if let repeated = session.repeatedAgentMessageCount, repeated > 0 {
              StatusBadge(
                title: "\(repeated) repeated", tone: .purple,
                accessibilityLabelText: "\(repeated) repeated")
            }
            if let crossAgent = session.repeatedCrossAgentMessageCount, crossAgent > 0 {
              StatusBadge(
                title: "\(crossAgent) cross-agent", tone: .amber,
                accessibilityLabelText: "\(crossAgent) cross-agent")
            }
            if let groups = session.agentRepeatGroupCount, groups > 0 {
              StatusBadge(
                title: "\(groups) repeat groups", tone: .blue,
                accessibilityLabelText: "\(groups) repeat groups")
            }
          }
          Divider().overlay(RCTheme.borderSoft)
          HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
              Text("Agent Repeat Analysis")
                .font(.caption.weight(.semibold))
              Text(repeatAnalysisCopy(session))
                .font(.caption)
                .foregroundStyle(RCTheme.muted)
                .fixedSize(horizontal: false, vertical: true)
            }
            Spacer()
            Button(
              model.busy == "insights-repeat-analysis-\(session.id)"
                ? "Running..." : repeatAnalysisActionTitle(session)
            ) {
              model.runInsightsRepeatAnalysis(session: session)
            }
            .buttonStyle(SecondaryLightButtonStyle())
            .disabled(model.busy == "insights-repeat-analysis-\(session.id)")
            .help(InsightsService.repeatAnalysisUnavailableReason)
            .accessibilityLabel(repeatAnalysisActionTitle(session))
          }
        }
        .padding(8)
        .background(RCTheme.surfaceInset)
        .clipShape(RoundedRectangle(cornerRadius: 4))
      }
    }
  }

  func repeatAnalysisActionTitle(_ session: ThreadAnalyticsSession) -> String {
    session.repeatAnalysisStatus == "not run" ? "Run Repeat Analysis" : "Re-run Repeat Analysis"
  }

  func repeatAnalysisCopy(_ session: ThreadAnalyticsSession) -> String {
    if session.repeatAnalysisStatus == "analysis failed" {
      return "Agent repeat analysis failed for this session."
    }
    if session.repeatAnalysisStatus == "not run" {
      return "Repeat analysis has not been run for this session yet."
    }
    return "Repeat analysis uses source-backed structured-job output when available."
  }

  func repeatAnalysisTone(_ session: ThreadAnalyticsSession) -> ComponentTone {
    switch session.repeatAnalysisStatus {
    case "analysis failed":
      return .red
    case "not run":
      return .neutral
    default:
      return .purple
    }
  }
}

func insightsFilterLabel(_ filter: InsightsReportSourceFilter) -> String {
  switch filter {
  case .all:
    return "All reports"
  case .snapshots:
    return "Snapshots"
  case .chatReports:
    return "Chat reports"
  }
}

func insightsSortLabel(_ sort: InsightsReportSort) -> String {
  switch sort {
  case .newest:
    return "Newest"
  case .oldest:
    return "Oldest"
  case .title:
    return "Title"
  }
}

func insightsStatusTone(_ status: String) -> ComponentTone {
  switch status {
  case ThreadWrapUpStatus.completed.rawValue, "completed":
    return .green
  case ThreadWrapUpStatus.failed.rawValue:
    return .red
  case ThreadWrapUpStatus.generating.rawValue, ThreadWrapUpStatus.pending.rawValue:
    return .amber
  default:
    return .neutral
  }
}

func agentOpsTone(_ state: AgentOpsLiveState) -> ComponentTone {
  switch state {
  case .offline, .cancelled:
    return .neutral
  case .idle, .completed:
    return .blue
  case .queued, .working, .thinking, .tooling:
    return .green
  case .waitingForApproval:
    return .amber
  case .error:
    return .red
  }
}

func agentOpsDefaultFloor() -> AgentOpsVisualFloor {
  AgentOpsVisualFloor(
    id: "floor_01_operations",
    title: "Main Operations Floor",
    subtitle: "Bundled AgentOps operations floor",
    order: 0,
    bounds: AgentOpsVisualRect(x: 0, y: 0, width: 1586, height: 992),
    backgroundAssetId: "agentops_tower_main_operations_floor",
    backgroundResourceName: "agentops-tower-main-operations-floor",
    backgroundResourceSubdirectory: "Assets/agent-ops-hq/floors"
  )
}

func agentOpsSceneScale(bounds: AgentOpsVisualRect, in size: CGSize, zoom: CGFloat = 1) -> CGFloat {
  let widthScale = size.width / max(CGFloat(bounds.width), 1)
  let heightScale = size.height / max(CGFloat(bounds.height), 1)
  return max(0.25, max(widthScale, heightScale)) * max(1, zoom)
}

func agentOpsSceneOffset(
  bounds: AgentOpsVisualRect, scale: CGFloat, in size: CGSize, pan: CGSize = .zero
) -> CGPoint {
  let clampedPan = agentOpsClampedPanOffset(pan, bounds: bounds, scale: scale, in: size)
  return CGPoint(
    x: (size.width - CGFloat(bounds.width) * scale) / 2 + clampedPan.width,
    y: (size.height - CGFloat(bounds.height) * scale) / 2 + clampedPan.height
  )
}

func agentOpsClampedPanOffset(
  _ pan: CGSize, bounds: AgentOpsVisualRect, scale: CGFloat, in size: CGSize
) -> CGSize {
  let contentWidth = CGFloat(bounds.width) * scale
  let contentHeight = CGFloat(bounds.height) * scale
  let horizontalLimit = max(0, (contentWidth - size.width) / 2)
  let verticalLimit = max(0, (contentHeight - size.height) / 2)
  return CGSize(
    width: min(max(pan.width, -horizontalLimit), horizontalLimit),
    height: min(max(pan.height, -verticalLimit), verticalLimit)
  )
}

func agentOpsSceneRect(_ rect: AgentOpsVisualRect, scale: CGFloat, offset: CGPoint) -> CGRect {
  CGRect(
    x: offset.x + CGFloat(rect.x) * scale,
    y: offset.y + CGFloat(rect.y) * scale,
    width: CGFloat(rect.width) * scale,
    height: CGFloat(rect.height) * scale
  )
}

func agentOpsScenePoint(_ point: AgentOpsVisualPoint, scale: CGFloat, offset: CGPoint) -> CGPoint {
  CGPoint(
    x: offset.x + CGFloat(point.x) * scale,
    y: offset.y + CGFloat(point.y) * scale
  )
}

func agentOpsImagePoint(
  _ location: CGPoint,
  bounds: AgentOpsVisualRect,
  scale: CGFloat,
  offset: CGPoint,
  snapToGrid: Bool
) -> AgentOpsVisualPoint {
  let rawX = (location.x - offset.x) / max(scale, 0.001)
  let rawY = (location.y - offset.y) / max(scale, 0.001)
  let clampedX = min(max(rawX, CGFloat(bounds.x)), CGFloat(bounds.x + bounds.width))
  let clampedY = min(max(rawY, CGFloat(bounds.y)), CGFloat(bounds.y + bounds.height))
  if snapToGrid {
    return AgentOpsVisualPoint(
      x: Double((clampedX / 8).rounded() * 8),
      y: Double((clampedY / 8).rounded() * 8)
    )
  }
  return AgentOpsVisualPoint(x: Double(clampedX.rounded()), y: Double(clampedY.rounded()))
}

func agentOpsPathColor<S: Sequence>(_ tags: S) -> Color where S.Element == AgentOpsLayoutPathTag {
  let tagSet = Set(tags)
  if tagSet.contains(.restricted) {
    return Color(red: 1, green: 0.38, blue: 0.34)
  }
  if tagSet.contains(.social) {
    return Color(red: 0.72, green: 0.54, blue: 1)
  }
  if tagSet.contains(.outside) {
    return Color(red: 0.54, green: 0.84, blue: 0.48)
  }
  if tagSet.contains(.roomEntry) {
    return Color(red: 1, green: 0.67, blue: 0.22)
  }
  if tagSet.contains(.main), tagSet.contains(.idle) {
    return Color(red: 0.4, green: 0.97, blue: 0.89)
  }
  if tagSet.contains(.idle) {
    return Color(red: 0.22, green: 0.74, blue: 0.97)
  }
  return Color.white.opacity(0.92)
}

func agentOpsAnchorColor(_ group: AgentOpsLayoutAnchorGroup) -> Color {
  switch group {
  case .entryAnchors:
    return Color(red: 1, green: 0.64, blue: 0.18)
  case .workstations:
    return Color(red: 0.35, green: 0.68, blue: 1)
  case .screenAnchors:
    return Color(red: 0.22, green: 0.93, blue: 0.95)
  case .idleAnchors:
    return Color(red: 0.72, green: 0.54, blue: 1)
  case .lightAnchors:
    return Color(red: 1, green: 0.91, blue: 0.44)
  }
}

func agentOpsAnchorPoints(room: AgentOpsVisualRoom, group: AgentOpsLayoutAnchorGroup)
  -> [AgentOpsVisualPoint]
{
  switch group {
  case .entryAnchors:
    return room.entryAnchors ?? []
  case .workstations:
    return room.workstationAnchors ?? []
  case .screenAnchors:
    return room.screenAnchors ?? []
  case .idleAnchors:
    return room.idleAnchors ?? []
  case .lightAnchors:
    return room.lightAnchors ?? []
  }
}

func agentOpsAnchorShape(group: AgentOpsLayoutAnchorGroup) -> AgentOpsAnchorMarkerShape {
  AgentOpsAnchorMarkerShape(group: group)
}

struct AgentOpsAnchorMarkerShape: Shape {
  let group: AgentOpsLayoutAnchorGroup

  func path(in rect: CGRect) -> Path {
    switch group {
    case .entryAnchors:
      var path = Path()
      path.move(to: CGPoint(x: rect.midX, y: rect.minY))
      path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
      path.addLine(to: CGPoint(x: rect.midX, y: rect.maxY))
      path.addLine(to: CGPoint(x: rect.minX, y: rect.midY))
      path.closeSubpath()
      return path
    case .workstations:
      return Rectangle().path(in: rect)
    case .screenAnchors:
      return RoundedRectangle(cornerRadius: 2).path(in: rect)
    case .idleAnchors:
      return Circle().path(in: rect)
    case .lightAnchors:
      return Capsule().path(in: rect)
    }
  }
}

func agentOpsFloorImage(_ floor: AgentOpsVisualFloor?) -> NSImage? {
  guard let resourceName = floor?.backgroundResourceName else { return nil }
  let subdirectory = floor?.backgroundResourceSubdirectory
  let url =
    Bundle.module.url(forResource: resourceName, withExtension: "png", subdirectory: subdirectory)
    ?? Bundle.module.url(forResource: resourceName, withExtension: "png")
  guard let url else { return nil }
  return NSImage(contentsOf: url)
}

func agentOpsSpriteImage(_ entity: AgentOpsVisualEntity) -> NSImage? {
  guard let resourceName = entity.spriteResourceName else { return nil }
  let url =
    Bundle.module.url(
      forResource: resourceName, withExtension: "png",
      subdirectory: entity.spriteResourceSubdirectory)
    ?? Bundle.module.url(forResource: resourceName, withExtension: "png")
  guard let url, let source = NSImage(contentsOf: url) else { return nil }
  guard let cgImage = source.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    return nil
  }
  let frameWidth = max(1, Int(entity.spriteFrameWidth ?? 64))
  let frameHeight = max(1, Int(entity.spriteFrameHeight ?? 64))
  guard cgImage.width % frameWidth == 0, cgImage.height % frameHeight == 0 else {
    return nil
  }
  let origin = entity.spriteFrameOrigin ?? AgentOpsVisualPoint(x: 0, y: 0)
  let crop = CGRect(
    x: max(0, min(Int(origin.x), cgImage.width - frameWidth)),
    y: max(0, min(Int(origin.y), cgImage.height - frameHeight)),
    width: frameWidth,
    height: frameHeight
  )
  guard let cropped = cgImage.cropping(to: crop) else { return nil }
  return NSImage(cgImage: cropped, size: NSSize(width: frameWidth, height: frameHeight))
}
