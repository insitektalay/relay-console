import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  func selectInsightsReport(_ row: InsightsReportRow) {
    insightsSelectedReportId = row.id
    persistInsightsViewState()
    Task { await refreshInsightsState() }
  }

  func setInsightsSearch(_ query: String) {
    insightsSearch = query
    persistInsightsViewState()
    Task { await refreshInsightsState() }
  }

  func setInsightsSourceFilter(_ filter: InsightsReportSourceFilter) {
    insightsSourceFilter = filter
    persistInsightsViewState()
    Task { await refreshInsightsState() }
  }

  func setInsightsSort(_ sort: InsightsReportSort) {
    insightsSort = sort
    persistInsightsViewState()
    Task { await refreshInsightsState() }
  }

  func toggleInsightsArchived() {
    insightsIncludeArchived.toggle()
    persistInsightsViewState()
    Task { await refreshInsightsState() }
  }

  func setInsightsActivityGap(_ minutes: Int) {
    insightsActivityGapMinutes = min(max(minutes, 1), 1440)
    persistInsightsViewState()
    Task { await refreshInsightsState() }
  }

  func setInsightsShowingAnalytics(_ showingAnalytics: Bool) {
    insightsShowingAnalytics = showingAnalytics
    persistInsightsViewState()
    Task { await refreshInsightsState() }
  }

  func toggleInsightsGroup(_ group: InsightsReportGroup) {
    if collapsedInsightsGroupIds.contains(group.id) {
      collapsedInsightsGroupIds.remove(group.id)
    } else {
      collapsedInsightsGroupIds.insert(group.id)
    }
  }

  func archiveSelectedInsightsReport() {
    guard let workspace = workspace, !insightsSelectedReportId.isEmpty else { return }
    let reportId = insightsSelectedReportId
    runAction("insights-archive", refresh: .insights) {
      guard let services = self.services else { return nil }
      let context = self.chatContext(
        workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      _ = try services.insights.archiveReport(context: context, reportId: reportId)
      self.insightsStatus = "Report archived from this list"
      return self.selectedThreadId
    }
  }

  func archiveInsightsReport(_ row: InsightsReportRow) {
    guard let workspace = workspace else { return }
    runAction("insights-archive", refresh: .insights) {
      guard let services = self.services else { return nil }
      let context = self.chatContext(
        workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      _ = try services.insights.archiveReport(context: context, reportId: row.id)
      if self.insightsSelectedReportId == row.id {
        self.insightsSelectedReportId = ""
        self.persistInsightsViewState()
      }
      self.insightsStatus = "Report archived from this list"
      return self.selectedThreadId
    }
  }

  func archiveInsightsGroup(_ group: InsightsReportGroup) {
    guard let workspace = workspace else { return }
    runAction("insights-archive-group-\(group.id)", refresh: .insights) {
      guard let services = self.services else { return nil }
      let context = self.chatContext(
        workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      _ = try services.insights.archiveReportGroup(context: context, groupId: group.id)
      if group.rows.contains(where: { $0.id == self.insightsSelectedReportId }) {
        self.insightsSelectedReportId = ""
        self.persistInsightsViewState()
      }
      self.insightsStatus = "Report archived from this list"
      return self.selectedThreadId
    }
  }

  func retrySelectedInsightsReport() {
    guard let workspace = workspace, !insightsSelectedReportId.isEmpty else { return }
    let reportId = insightsSelectedReportId
    runAction("insights-retry", refresh: .insights) {
      guard let services = self.services else { return nil }
      let context = self.chatContext(
        workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      try services.insights.retryReport(context: context, reportId: reportId)
      return self.selectedThreadId
    }
  }

  func runInsightsRepeatAnalysis(session: ThreadAnalyticsSession) {
    guard let workspace = workspace, let threadId = insightsAnalytics?.threadId else { return }
    runAction("insights-repeat-analysis-\(session.id)", refresh: .insights) {
      guard let services = self.services else { return nil }
      let context = self.chatContext(
        workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      try services.insights.runRepeatAnalysis(
        context: context,
        threadId: threadId,
        sessionId: session.id
      )
      return self.selectedThreadId
    }
  }

  func copyInsightsAnalyticsCSV() {
    guard let workspace = workspace, let threadId = insightsReportDetail?.row.threadId else {
      return
    }
    runAction("insights-export-csv", refresh: .none) {
      guard let services = self.services else { return nil }
      let context = self.chatContext(
        workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      let csv = try services.insights.exportAnalyticsCSV(
        context: context,
        threadId: threadId,
        activityGapMinutes: self.insightsActivityGapMinutes
      )
      NSPasteboard.general.clearContents()
      NSPasteboard.general.setString(csv, forType: .string)
      self.showToast("Copied analytics CSV", tone: .success)
      return self.selectedThreadId
    }
  }

  func copyInsightsAnalyticsJSON() {
    guard let workspace = workspace, let threadId = insightsReportDetail?.row.threadId else {
      return
    }
    runAction("insights-export-json", refresh: .none) {
      guard let services = self.services else { return nil }
      let context = self.chatContext(
        workspaceId: workspace.id, profileId: self.appState?.activeProfile?.id)
      let payload = try services.insights.exportAnalyticsJSON(
        context: context,
        threadId: threadId,
        activityGapMinutes: self.insightsActivityGapMinutes
      )
      NSPasteboard.general.clearContents()
      NSPasteboard.general.setString(encodeJSONRecord(payload), forType: .string)
      self.showToast("Copied analytics JSON", tone: .success)
      return self.selectedThreadId
    }
  }

  func currentInsightsViewState() -> InsightsViewState {
    InsightsViewState(
      searchQuery: insightsSearch,
      sourceFilter: insightsSourceFilter,
      sort: insightsSort,
      includeArchived: insightsIncludeArchived,
      selectedReportId: insightsSelectedReportId.isEmpty ? nil : insightsSelectedReportId,
      showingAnalytics: insightsShowingAnalytics,
      activityGapMinutes: insightsActivityGapMinutes
    )
  }

  func applyInsightsViewState(_ state: InsightsViewState) {
    insightsSearch = state.searchQuery
    insightsSourceFilter = state.sourceFilter
    insightsSort = state.sort
    insightsIncludeArchived = state.includeArchived
    insightsSelectedReportId = state.selectedReportId ?? ""
    insightsShowingAnalytics = state.showingAnalytics
    insightsActivityGapMinutes = min(max(state.activityGapMinutes, 1), 1440)
  }

  func persistInsightsViewState() {
    guard let services, let workspace else { return }
    let context = chatContext(workspaceId: workspace.id, profileId: appState?.activeProfile?.id)
    _ = try? services.insights.saveViewState(context: context, state: currentInsightsViewState())
  }
}
