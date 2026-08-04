import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

extension AppViewModel {
  @discardableResult
  func selectNav(_ nextNav: NavKey) -> ShellRouteResolution {
    selectShellSection(nextNav.shellSectionKey)
  }

  @discardableResult
  func selectShellSection(_ key: ShellSectionKey) -> ShellRouteResolution {
    let resolution = shellNavigation.resolveSelection(current: activeShellSection, requested: key)
    switch resolution.outcome {
    case .allowed:
      if let nextNav = NavKey(shellSectionKey: resolution.resolvedKey) {
        nav = nextNav
        if nextNav == .applications {
          showApplicationsMarketplace()
          scheduleApplicationsRefresh()
        } else if nextNav == .artifacts {
          Task { await refreshOperationalOutputs() }
        }
      }
      guardedShellNotice = nil
    case .deniedUnavailable, .deniedExcluded:
      guardedShellNotice = resolution
    }
    return resolution
  }

  func dismissGuardedShellNotice() {
    guardedShellNotice = nil
  }

  func uploadAvatar(completion: @escaping (String) -> Void) {
    let panel = NSOpenPanel()
    panel.allowedContentTypes = allowedAvatarUploadContentTypes
    panel.allowsMultipleSelection = false
    panel.canChooseDirectories = false
    panel.begin { response in
      guard response == .OK, let url = panel.url else { return }
      do {
        let dataURL = try avatarUploadDataURL(from: url)
        Task { @MainActor in
          completion(dataURL)
        }
      } catch {
        Task { @MainActor in
          self.error = "Could not read the selected avatar: \(error.localizedDescription)"
        }
      }
    }
  }

  func copyThreadTranscript() {
    let text = formatThreadTranscript(messages)
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(text, forType: .string)
    showToast("Copied transcript", tone: .success)
  }

  func copyThreadTranscript(from index: Int) {
    let lowerBound = min(max(index, messages.startIndex), messages.endIndex)
    let slice = Array(messages[lowerBound...])
    let text = formatThreadTranscript(slice, scope: "From selected message")
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(text, forType: .string)
    showToast("Copied transcript from here", tone: .success)
  }

  func copyMessage(_ message: Message) {
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(messageCopyText(message), forType: .string)
    showToast("Copied message", tone: .success)
  }

  func messageCopyText(_ message: Message) -> String {
    MessageRenderer.plan(
      content: message.content, format: message.contentFormat, metadata: message.metadata
    ).copyText
  }

  func resolveAgentDisplayName(_ agent: AgentWithBinding) -> String {
    agentPreferences[agent.id]?.cosmeticDisplayName?.trimmingCharacters(in: .whitespacesAndNewlines)
      .nilIfEmpty
      ?? agentDisplayNames[agent.id]?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
      ?? agent.name
  }

  func resolveAgentRoleText(_ agent: AgentWithBinding?) -> String? {
    guard let agent else { return nil }
    return [agent.role, agent.description]
      .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty }
      .first
  }

  func resolveThreadDisplayTitle(_ thread: ThreadSummary) -> String {
    if thread.threadType == .direct,
      let selectedAgentId = thread.selectedAgentId,
      let agent = agent(withId: selectedAgentId)
    {
      return resolveAgentDisplayName(agent)
    }
    return thread.title.isEmpty ? "New chat" : thread.title
  }

  func agentAvatar(_ agentId: String?) -> String? {
    guard let agentId else { return nil }
    if let preference = agentPreferences[agentId] {
      switch preference.avatarState {
      case .fallback:
        return defaultIllustratedAvatarURL(seed: agentId)
      case .illustrated, .uploaded:
        return preference.avatarReference
      case .noAvatar:
        return nil
      }
    }
    if let saved = agentAvatarUrls[agentId] {
      return saved == noAvatarPreferenceValue ? nil : saved
    }
    return defaultIllustratedAvatarURL(seed: agentId)
  }

  func makeRuntimeContextUsageRow(
    agentId: RelayId,
    usage: RuntimeContextUsageRecord?,
    updatedAt: IsoTimestamp?
  ) -> ChatRuntimeContextUsageDisplay {
    let agent = agents.first { $0.id == agentId }
    let estimate = estimatedRuntimeContextUsage(for: agent)
    let percentUsed =
      usage?.percentUsed.map(normalizedRuntimePercent)
      ?? (usage == nil ? estimate.percentUsed : nil)
    let tokenCount = usage?.tokenCount ?? (usage == nil ? estimate.tokenCount : nil)
    let maxTokens = usage?.maxTokens ?? (usage == nil ? estimate.maxTokens : nil)
    return ChatRuntimeContextUsageDisplay(
      agentId: agentId,
      agentName: agent.map(resolveAgentDisplayName) ?? "Agent",
      avatarURL: agentAvatar(agentId),
      runtimeType: agent?.harness.runtimeType,
      percentUsed: percentUsed,
      tokenCount: tokenCount,
      maxTokens: maxTokens,
      level: usage.map { normalizedContextUsageLevel($0.level, percentUsed: percentUsed) }
        ?? contextUsageLevel(percentUsed),
      isEstimate: usage?.isEstimate ?? true,
      referencesCount: usage?.referencesCount ?? estimate.referencesCount,
      updatedAt: updatedAt
    )
  }

  func estimatedRuntimeContextUsage(for agent: AgentWithBinding?)
    -> RuntimeContextUsageRecord
  {
    let tokenCount = estimatedContextTokenCount(for: agent)
    let maxTokens = contextWindowTokens(for: agent)
    let percentUsed = maxTokens > 0 ? (Double(tokenCount) / Double(maxTokens)) * 100 : 0
    return RuntimeRecoveryService.contextUsage(
      dispatchId: nil,
      percentUsed: percentUsed,
      tokenCount: tokenCount,
      maxTokens: maxTokens,
      level: contextUsageLevel(percentUsed),
      isEstimate: true,
      referencesCount: estimatedReferenceCount
    )
  }

  func estimatedContextTokenCount(for agent: AgentWithBinding?) -> Int {
    let systemAllowance = estimatedSystemPromptTokens(for: agent)
    let transcriptTokens = messages.reduce(0) { total, message in
      total
        + estimatedTokenCount(message.senderName)
        + estimatedTokenCount(message.content)
        + documentReferenceMetadataRows(message.metadata).compactMap(\.tokenCount).reduce(0, +)
    }
    return max(1, systemAllowance + transcriptTokens)
  }

  func estimatedSystemPromptTokens(for agent: AgentWithBinding?) -> Int {
    guard let agent else { return 700 }
    let descriptiveText = [
      agent.name,
      agent.description,
      agent.role,
      agent.classification,
      agent.model,
      stringValue(agent.binding.config["model"]),
      stringValue(agent.harness.config["model"]),
    ]
    .compactMap { $0 }
    .joined(separator: "\n")
    return 700 + estimatedTokenCount(descriptiveText)
  }

  private var estimatedReferenceCount: Int {
    messages.reduce(0) { total, message in
      total + documentReferenceMetadataRows(message.metadata).count
    }
  }

  func estimatedTokenCount(_ value: String) -> Int {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return 0 }
    return max(1, Int(ceil(Double(trimmed.count) / 4.0)))
  }

  func contextWindowTokens(for agent: AgentWithBinding?) -> Int {
    if let configured = configuredContextWindowTokens(for: agent) {
      return configured
    }
    let modelName =
      [
        agent?.model,
        agent.flatMap { stringValue($0.binding.config["model"]) },
        agent.flatMap { stringValue($0.harness.config["model"]) },
      ]
      .compactMap { $0?.lowercased() }
      .first { !$0.isEmpty } ?? ""
    return contextWindowTokens(forModelName: modelName, runtimeType: agent?.harness.runtimeType)
  }

  func configuredContextWindowTokens(for agent: AgentWithBinding?) -> Int? {
    guard let agent else { return nil }
    let keys = [
      "contextWindowTokens",
      "contextWindow",
      "context_window",
      "maxContextTokens",
      "max_context_tokens",
      "maxTokens",
      "limitTokens",
    ]
    for record in [agent.binding.config, agent.harness.config, agent.metrics] {
      for key in keys {
        if let value = jsonInt(record[key]), value > 0 {
          return value
        }
      }
    }
    return nil
  }

  func contextWindowTokens(forModelName modelName: String, runtimeType: RuntimeType?) -> Int {
    if modelName.contains("gemini") {
      return 1_000_000
    }
    if modelName.contains("gpt-4.1") {
      return 1_000_000
    }
    if modelName.contains("claude") {
      return 200_000
    }
    if modelName.contains("o3") || modelName.contains("o4") {
      return 200_000
    }
    if modelName.contains("gpt-4o") || modelName.contains("gpt-5") || modelName.contains("codex") {
      return 128_000
    }
    switch runtimeType {
    case .hermes, .openclaw, .codexCli, .claudeCode:
      return 128_000
    default:
      return 128_000
    }
  }

  func runtimeContextUsage(from value: JSONValue?) -> RuntimeContextUsageRecord? {
    guard case .object(let object)? = value else { return nil }
    let percentUsed = jsonDouble(
      object["percentUsed"]
        ?? object["contextPercent"]
        ?? object["context_percent"]
        ?? object["usagePercent"]
        ?? object["percent"]
    )
    let tokenCount = jsonInt(
      object["tokenCount"]
        ?? object["contextTokens"]
        ?? object["context_tokens"]
        ?? object["context_used"]
        ?? object["usedTokens"]
        ?? object["tokensUsed"]
    )
    let maxTokens = jsonInt(
      object["maxTokens"]
        ?? object["totalTokens"]
        ?? object["contextWindow"]
        ?? object["context_length"]
        ?? object["context_max"]
        ?? object["limitTokens"]
    )
    let referencesCount =
      jsonInt(
        object["referencesCount"] ?? object["referenceCount"] ?? object["documentsCount"]
          ?? object["docsCount"])
      ?? jsonArrayCount(object["references"])
      ?? jsonArrayCount(object["documentReferences"])
      ?? 0
    return RuntimeRecoveryService.contextUsage(
      dispatchId: nil,
      percentUsed: percentUsed,
      tokenCount: tokenCount,
      maxTokens: maxTokens,
      level: stringValue(object["level"]) ?? contextUsageLevel(percentUsed),
      isEstimate: boolValue(object["isEstimate"]) ?? boolValue(object["estimate"]) ?? boolValue(
        object["fresh"]
      ).map { !$0 } ?? false,
      referencesCount: referencesCount
    )
  }

  func contextUsageLevel(_ percentUsed: Double?) -> String {
    guard let percentUsed else { return "unknown" }
    switch percentUsed {
    case 90...:
      return "critical"
    case 75..<90:
      return "warning"
    default:
      return "normal"
    }
  }

  func normalizedRuntimePercent(_ value: Double) -> Double {
    value > 0 && value <= 1 ? value * 100 : value
  }

  func normalizedContextUsageLevel(_ rawLevel: String, percentUsed: Double?) -> String {
    switch rawLevel {
    case "ok", "healthy", "normal", "low", "warning", "medium", "critical", "danger", "high":
      return rawLevel == "ok" || rawLevel == "healthy" ? contextUsageLevel(percentUsed) : rawLevel
    default:
      return contextUsageLevel(percentUsed)
    }
  }

  func jsonDouble(_ value: JSONValue?) -> Double? {
    switch value {
    case .number(let number):
      return number
    case .string(let string):
      return Double(
        string.trimmingCharacters(in: .whitespacesAndNewlines).trimmingCharacters(
          in: CharacterSet(charactersIn: "%")))
    default:
      return nil
    }
  }

  func jsonInt(_ value: JSONValue?) -> Int? {
    switch value {
    case .number(let number):
      return Int(number)
    case .string(let string):
      return Int(string.trimmingCharacters(in: .whitespacesAndNewlines))
    default:
      return nil
    }
  }

  func jsonArrayCount(_ value: JSONValue?) -> Int? {
    guard case .array(let items)? = value else { return nil }
    return items.count
  }

  func companyName(_ companyId: String?) -> String? {
    guard let companyId else { return nil }
    return orgCompanies.first { $0.id == companyId }?.name
  }

  func departmentName(_ departmentId: String?) -> String? {
    guard let departmentId else { return nil }
    return orgDepartments.first { $0.id == departmentId }?.name
  }

  func teamName(_ teamId: String?) -> String? {
    guard let teamId else { return nil }
    return orgTeams.first { $0.id == teamId }?.name
  }

  func departments(for companyId: String) -> [AgentOrgDepartment] {
    orgDepartments.filter { $0.companyId == companyId }
  }

  func teams(for departmentId: String) -> [AgentOrgTeam] {
    orgTeams.filter { $0.departmentId == departmentId }
  }

  func agentsInGroup(_ groupType: AgentGroupType) -> [AgentWithBinding] {
    visibleAgents.filter { effectiveAgentGroup($0) == groupType }
  }

  func agentsInTeam(_ teamId: String) -> [AgentWithBinding] {
    visibleAgents.filter { $0.teamId == teamId }
  }

  func departmentDashboard(_ departmentId: String) -> AgentDepartmentDashboardSnapshot? {
    agentStructureDashboard?.departments.first { $0.departmentId == departmentId }
  }

  func teamDashboard(_ teamId: String) -> AgentTeamDashboardSnapshot? {
    agentStructureDashboard?.teams.first { $0.teamId == teamId }
  }

  func teamMemory(for teamId: String) -> [AgentTeamMemoryEntry] {
    teamMemoryEntries.filter { $0.teamId == teamId }
  }

  func teamHandovers(for teamId: String) -> [AgentTeamHandover] {
    teamHandovers.filter { $0.teamId == teamId }
  }

  var filteredAgentTasks: [AgentTask] {
    let query = agentTaskSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !query.isEmpty else { return agentTasks }
    return agentTasks.filter { task in
      [
        task.title,
        task.message,
        task.status.rawValue,
        task.priority.rawValue,
        task.lastError ?? "",
      ].joined(separator: " ").lowercased().contains(query)
    }
  }

  var selectedAgentTask: AgentTask? {
    agentTasks.first { $0.id == selectedAgentTaskId } ?? agentTasks.first
  }

  var filteredCronJobs: [AgentCronJobRecord] {
    let query = cronJobSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !query.isEmpty else { return cronJobs }
    return cronJobs.filter { job in
      [
        job.name,
        resolveAgentDisplayName(agentId: job.agentId, fallback: job.agentName),
        job.agentName,
        job.state,
        job.scheduleDisplay,
        job.prompt ?? "",
        job.script ?? "",
        job.workdir ?? "",
        job.sourcePath ?? "",
      ].joined(separator: " ").lowercased().contains(query)
    }
  }

  var selectedCronJob: AgentCronJobRecord? {
    cronJobs.first { $0.id == selectedCronJobId } ?? cronJobs.first
  }

  var filteredArtifacts: [AgentArtifactRecord] {
    let query = artifactSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return artifacts.filter { artifact in
      if let artifactKindFilter, artifact.kind != artifactKindFilter {
        return false
      }
      guard !query.isEmpty else { return true }
      return [
        artifact.title,
        artifact.path,
        artifact.relativePath ?? "",
        resolveAgentDisplayName(agentId: artifact.agentId, fallback: artifact.agentName),
        artifact.agentName ?? "",
        artifact.cronJobName ?? "",
        artifact.preview ?? "",
      ].joined(separator: " ").lowercased().contains(query)
    }
  }

  var artifactSidebarGroups: [ArtifactSidebarGroup] {
    let visibleArtifacts = filteredArtifacts
    let visibleIds = Set(visibleArtifacts.map(\.id))
    var groupedIds: Set<RelayId> = []
    var groups: [ArtifactSidebarGroup] = []

    for job in cronJobs {
      let jobIds = Set(job.artifactIds)
      let children = visibleArtifacts.filter {
        jobIds.contains($0.id) || job.maintainedArtifactId == $0.id
      }
      guard !children.isEmpty else { continue }
      groupedIds.formUnion(children.map(\.id))
      let artifactOwner = children.first {
        $0.agentId != nil
          || $0.agentName?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false
      }
      let groupAgentId = artifactOwner?.agentId ?? job.agentId
      let groupAgentName = resolveAgentDisplayName(
        agentId: groupAgentId,
        fallback: artifactOwner?.agentName ?? job.agentName
      )
      groups.append(
        ArtifactSidebarGroup(
          id: job.id,
          title: job.name,
          subtitle: job.outputDirectoryPath ?? job.sourceLabel,
          agentId: groupAgentId,
          agentName: groupAgentName,
          agentAvatarURL: artifactOwner?.agentAvatarURL,
          artifacts: children.sorted { lhs, rhs in
            artifactTreeSortKey(lhs, maintainedArtifactId: job.maintainedArtifactId)
              .localizedCaseInsensitiveCompare(
                artifactTreeSortKey(rhs, maintainedArtifactId: job.maintainedArtifactId))
              == .orderedAscending
          },
          expanded: expandedArtifactGroupIds.contains(job.id)
        ))
    }

    let ungrouped = visibleArtifacts.filter {
      visibleIds.contains($0.id) && !groupedIds.contains($0.id)
    }
    if !ungrouped.isEmpty {
      groups.append(
        ArtifactSidebarGroup(
          id: "ungrouped-artifacts",
          title: "Other artifacts",
          subtitle: "\(ungrouped.count) files",
          agentId: nil,
          agentName: nil,
          agentAvatarURL: nil,
          artifacts: ungrouped,
          expanded: true
        ))
    }
    return groups
  }

  var selectedArtifact: AgentArtifactRecord? {
    filteredArtifacts.first { $0.id == selectedArtifactId }
  }

  func toggleArtifactGroup(_ group: ArtifactSidebarGroup) {
    guard group.id != "ungrouped-artifacts" else { return }
    selectedArtifactId = ""
    selectedArtifactGroupId = group.id
    if expandedArtifactGroupIds.contains(group.id) {
      expandedArtifactGroupIds.remove(group.id)
    } else {
      expandedArtifactGroupIds.insert(group.id)
    }
  }

  func expandArtifactGroup(containing artifact: AgentArtifactRecord) {
    guard
      let job = cronJobs.first(where: {
        $0.artifactIds.contains(artifact.id) || $0.maintainedArtifactId == artifact.id
      })
    else { return }
    expandedArtifactGroupIds.insert(job.id)
  }

  func relatedCronArtifacts(for artifact: AgentArtifactRecord) -> [AgentArtifactRecord] {
    let matchedJob = cronJobs.first { job in
      job.artifactIds.contains(artifact.id) || job.maintainedArtifactId == artifact.id
    }
    let jobArtifactIds = Set(matchedJob?.artifactIds ?? [])
    let rootPath = (matchedJob?.outputDirectoryPath ?? artifact.directoryPath)?
      .trimmingCharacters(in: .whitespacesAndNewlines)
      .nilIfEmpty
    return artifacts.filter { candidate in
      guard candidate.id != artifact.id else { return false }
      if jobArtifactIds.contains(candidate.id) { return true }
      guard let rootPath else { return false }
      return candidate.path == rootPath || candidate.path.hasPrefix(rootPath + "/")
    }
    .sorted { lhs, rhs in
      (lhs.relativePath ?? lhs.path).localizedCaseInsensitiveCompare(rhs.relativePath ?? rhs.path)
        == .orderedAscending
    }
  }

  func artifactTreeSortKey(_ artifact: AgentArtifactRecord, maintainedArtifactId: RelayId?)
    -> String
  {
    if artifact.id == maintainedArtifactId { return "0-\(artifact.title)" }
    return "1-\(artifact.relativePath ?? artifact.path)"
  }

  func agentName(_ agentId: String?) -> String {
    guard let agentId,
      let agent = agents.first(where: { $0.id == agentId })
    else { return "Unassigned agent" }
    return resolveAgentDisplayName(agent)
  }

  func resolveAgentDisplayName(agentId: String?, fallback: String?) -> String {
    if let agentId,
      let agent = agents.first(where: { $0.id == agentId })
    {
      return resolveAgentDisplayName(agent)
    }
    if let fallback,
      let agent = agents.first(where: { $0.name == fallback })
    {
      return resolveAgentDisplayName(agent)
    }
    return fallback?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
      ?? "Unassigned agent"
  }

  func departmentManager(departmentId: String?) -> AgentWithBinding? {
    guard let departmentId,
      let managerId = orgDepartments.first(where: { $0.id == departmentId })?.headAgentId
    else { return nil }
    return agents.first { $0.id == managerId }
  }

  func existingManagerNotice(
    departmentId: String,
    replacingWith agentId: String? = nil,
    departmentName: String? = nil
  ) -> String? {
    guard let manager = departmentManager(departmentId: departmentId),
      manager.id != agentId
    else { return nil }
    let resolvedDepartmentName =
      departmentName ?? self.departmentName(departmentId) ?? "This department"
    return
      "\(resolvedDepartmentName) already has \(resolveAgentDisplayName(manager)) set as manager. Replace them with the new agent?"
  }

  func isDuplicateRuntimeIdentity(
    runtimeType: HarnessKey, externalAgentId: String, excluding agentId: String? = nil
  ) -> Bool {
    let slug = slugifyAgentId(externalAgentId)
    guard !slug.isEmpty else { return false }
    let type: RuntimeType = runtimeType == .hermes ? .hermes : .openclaw
    return agents.contains { agent in
      agent.id != agentId
        && agent.binding.runtimeType == type
        && (agent.binding.externalAgentId == slug || agent.externalId == slug)
    }
  }

  func latestProvisioningJob(for agent: AgentWithBinding) -> AgentProvisioningJob? {
    provisioningJobs.first {
      $0.createdAgentId == agent.id || $0.runtimeBindingId == agent.binding.id
    }
  }

  func latestProvisioningJob(runtimeType: HarnessKey) -> AgentProvisioningJob? {
    let type: RuntimeType = runtimeType == .hermes ? .hermes : .openclaw
    return provisioningJobs.first { $0.runtimeType == type }
  }

  func formatThreadTranscript(_ items: [Message], scope: String = "Full thread") -> String {
    guard !items.isEmpty else { return "" }
    let title = selectedThread.map(resolveThreadDisplayTitle) ?? "Chat thread"
    let body = items.enumerated().map { index, message in
      formatMessageTranscript(message, position: (index + 1, items.count))
    }.joined(separator: "\n\n---\n\n")
    return [
      "ClawChat transcript",
      "Scope: \(scope)",
      "Thread: \(title)",
      "Copied at: \(Date().formatted(date: .abbreviated, time: .standard)) (\(ISO8601DateFormatter.relayConsole.string(from: Date())))",
      "Messages: \(items.count)",
      "",
      body,
    ].joined(separator: "\n")
  }

  func formatMessageTranscript(_ message: Message, position: (Int, Int)? = nil) -> String {
    let agent =
      message.senderType == .agent ? agents.first(where: { $0.id == message.senderId }) : nil
    let sender =
      message.senderType == .user
      ? profileName : agent.map(resolveAgentDisplayName) ?? message.senderName
    let renderPlan = MessageRenderer.plan(
      content: message.content, format: message.contentFormat, metadata: message.metadata)
    let attachmentLines = attachmentMetadataRows(message.metadata).map { attachment in
      "Attachment: \(attachment.fileName) (\(attachment.mimeType), \(formatByteCount(attachment.byteSize)), \(attachment.status))"
    }
    let referenceLines = documentReferenceMetadataRows(message.metadata).map { reference in
      "Reference: \(reference.title) (\(reference.kind), \(reference.isRedacted ? "redacted" : "visible"))"
    }
    let lines: [String?] = [
      position.map { "Message \($0.0) of \($0.1)" } ?? "Message",
      "Message ID: \(message.id)",
      "Time: \(message.createdAt)",
      "Sender: \(sender)",
      "Sender kind: \(message.senderType.rawValue)",
      agent.map { "Agent type: \($0.harness.runtimeType == .hermes ? "Hermes" : "OpenClaw")" },
      agent.map { "Agent ID: \($0.id)" },
      "Content format: \(message.contentFormat.rawValue)",
      attachmentLines.isEmpty ? nil : attachmentLines.joined(separator: "\n"),
      referenceLines.isEmpty ? nil : referenceLines.joined(separator: "\n"),
      "Content:",
      renderPlan.copyText,
    ]
    return lines.compactMap { $0 }.joined(separator: "\n")
  }

  var profileName: String {
    userProfile.displayName.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty ?? appState?
      .activeProfile?.displayName ?? "Local user"
  }

  var accountSettingsCanSave: Bool {
    guard busy != "save-account-settings", let profile = appState?.activeProfile else {
      return false
    }
    let displayName = userProfile.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
    let email = userProfile.email.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !displayName.isEmpty else { return false }
    return displayName != profile.displayName
      || email.lowercased() != (profile.email ?? "").lowercased()
      || userProfile.avatarUrl != profile.avatarUrl
      || userProfile.telemetryEnabled != profile.telemetryEnabled
      || userProfile.crashReportingEnabled != profile.crashReportingEnabled
  }

  var productAnalyticsConfigurationStatus: String {
    telemetry.analyticsStatus
  }

  var productAnalyticsAvailable: Bool {
    telemetry.analyticsConfigured
  }

  var crashReportingConfigurationStatus: String {
    telemetry.crashReportingStatus
  }

  var crashReportingAvailable: Bool {
    telemetry.crashReportingConfigured
  }

  var appearanceSettingsCanSave: Bool {
    guard busy != "save-appearance-settings", let profile = appState?.activeProfile else {
      return false
    }
    return userProfile.theme.trimmingCharacters(in: .whitespacesAndNewlines) != profile.theme
  }

  var workspaceSettingsCanSave: Bool {
    guard busy != "save-workspace-settings", let workspace else {
      return false
    }
    let name = workspaceSettingsDraft.name.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !name.isEmpty else { return false }
    return name != workspace.name || workspaceSettingsDraft.workspaceType != workspace.workspaceType
  }

  func openExternalAuthURL(_ value: String) throws {
    guard let url = URL(string: value), url.scheme == "https", url.host == "auth.openai.com" else {
      throw RelayError(.unsupported, "Relay Console can only open supported sign-in links.")
    }
    NSWorkspace.shared.open(url)
  }

  var activeComposerMentionQuery: String? {
    guard let atIndex = composerText.lastIndex(of: "@") else { return nil }
    let suffix = composerText[composerText.index(after: atIndex)...]
    guard !suffix.contains(where: { $0.isWhitespace || $0.isNewline }) else {
      return nil
    }
    let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._-"))
    guard suffix.unicodeScalars.allSatisfy({ allowed.contains($0) }) else {
      return nil
    }
    return String(suffix).lowercased()
  }

  func composerMentionToken(for agent: AgentWithBinding) -> String {
    let preferred =
      agent.binding.externalAgentId?.nilIfEmpty
      ?? agent.binding.hermesProfileSlug?.nilIfEmpty
      ?? resolveAgentDisplayName(agent)
    let slug = slugifyAgentId(preferred)
    return slug.isEmpty ? agent.id : slug
  }

  func mentionSearchText(for agent: AgentWithBinding) -> String {
    [
      resolveAgentDisplayName(agent),
      composerMentionToken(for: agent),
      agent.id,
      agent.externalId,
      agent.binding.externalAgentId,
      agent.binding.hermesProfileSlug,
    ]
    .compactMap { $0?.lowercased() }
    .joined(separator: " ")
  }

  func composerMentionTokens(in content: String) -> [String] {
    let pattern = #"(?<![A-Za-z0-9_])@([A-Za-z0-9][A-Za-z0-9._-]{0,159})"#
    guard let regex = try? NSRegularExpression(pattern: pattern) else {
      return []
    }
    let nsRange = NSRange(content.startIndex..<content.endIndex, in: content)
    return regex.matches(in: content, range: nsRange).compactMap { match in
      guard match.numberOfRanges > 1,
        let range = Range(match.range(at: 1), in: content)
      else {
        return nil
      }
      return String(content[range])
    }
  }

  func composerMentionCandidates(for agent: AgentWithBinding) -> Set<String> {
    let rawValues = [
      composerMentionToken(for: agent),
      resolveAgentDisplayName(agent),
      agent.id,
      agent.externalId,
      agent.binding.externalAgentId,
      agent.binding.hermesProfileSlug,
    ].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
    var candidates: Set<String> = []
    for value in rawValues where !value.isEmpty {
      let normalized = normalizeComposerMentionToken(value)
      if !normalized.isEmpty {
        candidates.insert(normalized)
      }
      let slug = slugifyAgentId(value)
      if !slug.isEmpty {
        candidates.insert(slug)
        candidates.insert(slug.replacingOccurrences(of: "_", with: "-"))
        candidates.insert(slug.replacingOccurrences(of: "_", with: ""))
      }
    }
    return candidates
  }

  func normalizeComposerMentionToken(_ value: String) -> String {
    value
      .trimmingCharacters(in: CharacterSet(charactersIn: "@._- \n\t\r"))
      .lowercased()
  }

  var sendableComposerAttachments: [ChatAttachment] {
    composerAttachments.filter { [.staged, .uploaded].contains($0.status) }
  }

  var visibleComposerAttachments: [ChatAttachment] {
    composerAttachments.filter { !composerSendingAttachmentIds.contains($0.id) }
  }

  func ensureComposerThreadForAttachment() throws -> String {
    if let selectedThreadId {
      return selectedThreadId
    }
    guard let workspace else {
      throw RelayError(.workspaceMissing, "Workspace unavailable.")
    }
    guard let agent = selectedAgent else {
      throw RelayError(.invalidInput, "Select an agent before attaching files.")
    }
    let thread = try services?.chat.createOrReuseDirectThread(
      context: chatContext(workspaceId: workspace.id),
      selectedAgentId: agent.id,
      title: resolveAgentDisplayName(agent)
    )
    guard let thread else {
      throw RelayError(.workspaceMissing, "Chat services are unavailable.")
    }
    selectedThreadId = thread.id
    return thread.id
  }

  func messageMetadata(for attachments: [ChatAttachment]) -> JSONRecord {
    guard !attachments.isEmpty else { return [:] }
    return [
      "attachments": .array(attachments.map { .object($0.metadataSummary) }),
      "attachmentCount": .number(Double(attachments.count)),
    ]
  }

  static func runtimeApprovalModeTitle(_ mode: RuntimeApprovalMode) -> String {
    switch mode {
    case .askForApproval:
      return "Ask for approval"
    case .approveForMe:
      return "Approve for me"
    case .fullAccess:
      return "Full access"
    }
  }

  static func mimeType(for url: URL) -> String {
    if let type = UTType(filenameExtension: url.pathExtension),
      let mime = type.preferredMIMEType
    {
      return mime
    }
    return "application/octet-stream"
  }

  static func attachmentKind(for url: URL, mimeType: String) -> ChatAttachmentKind {
    if mimeType.hasPrefix("image/") { return .image }
    if mimeType.hasPrefix("audio/") { return .audio }
    if mimeType.hasPrefix("video/") { return .video }
    if let type = UTType(filenameExtension: url.pathExtension),
      type.conforms(to: .pdf) || type.conforms(to: .text) || type.conforms(to: .rtf)
    {
      return .document
    }
    return .file
  }

  func writeMaps() {
    Self.writeMap(agentDisplayNames, key: "relay-console.agent-display-names")
    Self.writeMap(agentAvatarUrls, key: "relay-console.agent-avatar-urls")
  }

  func persistCalendarPreferences() {
    UserDefaults.standard.set(
      selectedCalendarGroup.rawValue, forKey: "relay-console.agent-work-calendar.group")
    UserDefaults.standard.set(
      selectedCalendarSortMode.rawValue, forKey: "relay-console.agent-work-calendar.sort")
  }

  func cronDeliveryErrorKey(job: AgentCronJobRecord, error: String) -> String {
    [
      job.id,
      job.sourcePath ?? "",
      error.trimmingCharacters(in: .whitespacesAndNewlines),
    ].joined(separator: "\u{1f}")
  }

  func persistCronDeliveryErrorDismissals() {
    Self.writeStringSet(
      dismissedCronDeliveryErrorKeys,
      key: "relay-console.cron.dismissed-delivery-errors"
    )
  }

  static func readMap(_ key: String) -> [String: String] {
    guard let text = UserDefaults.standard.string(forKey: key),
      let data = text.data(using: .utf8),
      let value = try? JSONDecoder().decode([String: String].self, from: data)
    else { return [:] }
    return value.mapValues(\.normalizedAvatarURL)
  }

  static func writeMap(_ value: [String: String], key: String) {
    if let data = try? JSONEncoder().encode(value), let text = String(data: data, encoding: .utf8) {
      UserDefaults.standard.set(text, forKey: key)
    }
  }

  static func readStringSet(_ key: String) -> Set<String> {
    guard let text = UserDefaults.standard.string(forKey: key),
      let data = text.data(using: .utf8),
      let value = try? JSONDecoder().decode([String].self, from: data)
    else { return [] }
    return Set(value)
  }

  static func writeStringSet(_ value: Set<String>, key: String) {
    if let data = try? JSONEncoder().encode(Array(value).sorted()),
      let text = String(data: data, encoding: .utf8)
    {
      UserDefaults.standard.set(text, forKey: key)
    }
  }

  static func readProfile() -> UserProfilePreference {
    readLegacyProfile() ?? UserProfilePreference()
  }

  static func readCalendarGroup() -> AgentWorkCalendarGroupFilter {
    guard
      let rawValue = UserDefaults.standard.string(forKey: "relay-console.agent-work-calendar.group")
    else { return .all }
    if let groupFilter = AgentWorkCalendarGroupFilter(rawValue: rawValue) {
      return groupFilter
    }
    if let group = AgentGroupType(rawValue: rawValue) {
      return AgentWorkCalendarGroupFilter(groupType: group)
    }
    return .all
  }

  static func readCalendarSortMode() -> AgentWorkCalendarSortMode {
    guard
      let rawValue = UserDefaults.standard.string(forKey: "relay-console.agent-work-calendar.sort"),
      let sortMode = AgentWorkCalendarSortMode(rawValue: rawValue)
    else { return .recentHours }
    return sortMode
  }

  static func readLegacyProfile() -> UserProfilePreference? {
    guard let text = UserDefaults.standard.string(forKey: "relay-console.user-profile"),
      let data = text.data(using: .utf8),
      let value = try? JSONDecoder().decode(UserProfilePreference.self, from: data)
    else { return nil }
    return value
  }
}
