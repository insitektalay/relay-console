import AppKit
import CryptoKit
import Foundation
import RelayConsoleCore
import SwiftUI
import UniformTypeIdentifiers

enum NavKey: String, CaseIterable {
  case chat
  case agents
  case agentOps
  case artifacts
  case applications
  case approvals
  case insights
  case settings

  var shellSectionKey: ShellSectionKey {
    switch self {
    case .chat:
      return .chats
    case .agents:
      return .agents
    case .agentOps:
      return .agentOpsHQ
    case .artifacts:
      return .artifacts
    case .applications:
      return .applications
    case .approvals:
      return .approvals
    case .insights:
      return .insights
    case .settings:
      return .settings
    }
  }

  init?(shellSectionKey: ShellSectionKey) {
    switch shellSectionKey {
    case .chats:
      self = .chat
    case .agents:
      self = .agents
    case .agentOpsHQ:
      self = .agentOps
    case .artifacts:
      self = .artifacts
    case .applications:
      self = .applications
    case .approvals:
      self = .approvals
    case .insights:
      self = .insights
    case .settings:
      self = .settings
    }
  }
}

struct ArtifactSidebarGroup: Identifiable, Equatable {
  var id: RelayId
  var title: String
  var subtitle: String
  var agentId: RelayId?
  var agentName: String?
  var agentAvatarURL: String?
  var artifacts: [AgentArtifactRecord]
  var expanded: Bool
}

enum AgentOpsLayoutPathTag: String, CaseIterable, Codable, Identifiable {
  case main
  case idle
  case roomEntry = "room_entry"
  case outside
  case social
  case restricted

  var id: String { rawValue }

  var title: String {
    rawValue.replacingOccurrences(of: "_", with: " ")
  }
}

struct AgentOpsLayoutWaypoint: Identifiable, Codable, Equatable {
  var id: RelayId
  var position: AgentOpsVisualPoint
  var tags: Set<AgentOpsLayoutPathTag>
}

struct AgentOpsLayoutEdge: Identifiable, Codable, Equatable {
  var id: RelayId
  var from: RelayId
  var to: RelayId
  var tags: Set<AgentOpsLayoutPathTag>
}

enum AgentOpsLayoutPathSelection: Codable, Equatable {
  case waypoint(RelayId)
  case edge(RelayId)
}

enum AgentOpsLayoutAnchorGroup: String, CaseIterable, Codable, Identifiable {
  case entryAnchors
  case workstations
  case screenAnchors
  case idleAnchors
  case lightAnchors

  var id: String { rawValue }

  var title: String {
    switch self {
    case .entryAnchors:
      return "Entry"
    case .workstations:
      return "Desk"
    case .screenAnchors:
      return "Screen"
    case .idleAnchors:
      return "Idle"
    case .lightAnchors:
      return "Light"
    }
  }
}

struct AgentOpsLayoutAnchorSelection: Codable, Equatable {
  var roomId: RelayId
  var group: AgentOpsLayoutAnchorGroup
  var index: Int
}

struct AgentOpsLayoutRoomAnchorDraft: Codable, Equatable {
  var roomId: RelayId
  var entryAnchors: [AgentOpsVisualPoint]?
  var workstationAnchors: [AgentOpsVisualPoint]?
  var screenAnchors: [AgentOpsVisualPoint]?
  var idleAnchors: [AgentOpsVisualPoint]?
  var lightAnchors: [AgentOpsVisualPoint]?
}

struct AgentOpsLayoutDraft: Codable, Equatable {
  var waypoints: [AgentOpsLayoutWaypoint]
  var edges: [AgentOpsLayoutEdge]
  var roomAnchorOverrides: [AgentOpsLayoutRoomAnchorDraft]
}

private struct AgentOpsLayoutExport: Codable, Equatable {
  var workspaceId: RelayId
  var floorId: RelayId
  var layoutPersistenceStatus: String
  var pathNetwork: AgentOpsLayoutPathNetworkExport
  var roomAnchorOverrides: [AgentOpsLayoutRoomAnchorDraft]
}

private struct AgentOpsLayoutPathNetworkExport: Codable, Equatable {
  var waypoints: [AgentOpsLayoutWaypoint]
  var edges: [AgentOpsLayoutEdge]
}

enum AgentPanelMode {
  case detail
  case edit
  case create
}

enum NewChatKind: String, CaseIterable {
  case direct
  case team

  var title: String {
    switch self {
    case .direct: return "Direct"
    case .team: return "Team"
    }
  }
}

enum AgentSubviewKey: String, CaseIterable {
  case instructions
  case memory
  case skills
  case createOrg
  case structure
  case category
  case workCalendar
  case tasks
  case cronJobs

  var title: String {
    switch self {
    case .instructions: return "Agent Instructions"
    case .memory: return "Agent Memory"
    case .skills: return "Agent Skills"
    case .createOrg: return "Create Org"
    case .structure: return "Org Structure"
    case .category: return "Agent Classification"
    case .workCalendar: return "Work Calendar"
    case .tasks: return "Schedule Tasks"
    case .cronJobs: return "Cron Jobs"
    }
  }

  var navigationTitle: String {
    switch self {
    case .instructions: return "Agent Instructions"
    case .memory: return "Agent Memory"
    case .skills: return "Agent Skills"
    case .createOrg: return "Create Org"
    case .structure: return "Org Structure"
    case .category: return "Agent Classification"
    case .workCalendar: return "Work Calendar"
    case .tasks: return "Work Task Schedule"
    case .cronJobs: return "Cron Jobs"
    }
  }

  var subtitle: String {
    switch self {
    case .instructions: return "Identity, project rules, and tool guidance"
    case .memory: return "Pinned facts, daily notes, and summaries"
    case .skills: return "Reusable procedures and capabilities"
    case .createOrg: return "Create organizations, departments, and teams"
    case .structure: return "Organizations, departments, teams, and groups"
    case .category: return "Assign agents to the right operating area"
    case .workCalendar: return "Scheduled work by group"
    case .tasks: return "Scheduled messages and dispatch history"
    case .cronJobs: return "Recurring agent jobs and generated outputs"
    }
  }

  var requiresAgent: Bool {
    switch self {
    case .instructions, .memory, .skills, .tasks:
      return true
    case .createOrg, .structure, .category, .workCalendar, .cronJobs:
      return false
    }
  }
}

enum AgentWorkCalendarSortMode: String, CaseIterable, Identifiable {
  case recentHours = "recent-hours"
  case rangeHours = "range-hours"
  case name

  var id: String { rawValue }

  var title: String {
    switch self {
    case .recentHours: return "Most hours recently"
    case .rangeHours: return "Most hours in range"
    case .name: return "Name"
    }
  }
}

enum AgentWorkCalendarGroupFilter: String, CaseIterable, Identifiable {
  case all
  case business
  case family
  case personal

  var id: String { rawValue }

  var title: String {
    switch self {
    case .all: return "All"
    case .business: return "Business"
    case .family: return "Family"
    case .personal: return "Personal"
    }
  }

  var groupType: AgentGroupType? {
    switch self {
    case .all: return nil
    case .business: return .business
    case .family: return .family
    case .personal: return .personal
    }
  }

  init(groupType: AgentGroupType) {
    switch groupType {
    case .business:
      self = .business
    case .family:
      self = .family
    case .personal, .unassigned:
      self = .personal
    }
  }
}

enum SettingsPanelKey: String, CaseIterable, Identifiable {
  case account
  case cloud
  case appearance
  case workspace
  case team
  case integrations
  case notifications
  case security
  case harnesses
  case runtime

  static let visiblePanels: [SettingsPanelKey] = [
    .account, .cloud, .security, .harnesses, .runtime,
  ]

  var id: String { rawValue }

  var isVisibleInFirstLaunch: Bool {
    Self.visiblePanels.contains(self)
  }

  var title: String {
    switch self {
    case .account: return "Account"
    case .cloud: return "Relay"
    case .appearance: return "Appearance"
    case .workspace: return "Workspace"
    case .team: return "Team & members"
    case .integrations: return "Integrations"
    case .notifications: return "Notifications"
    case .security: return "Security"
    case .harnesses: return "Harnesses"
    case .runtime: return "Runtime"
    }
  }

  var navigationTitle: String {
    switch self {
    case .harnesses: return "Harness"
    default: return title
    }
  }

  var subtitle: String {
    switch self {
    case .account: return "Your name, email, and profile details."
    case .cloud: return "Cross-device sync, offline data, and user-managed runtime bridges."
    case .appearance: return "Theme colors and interface presentation."
    case .workspace: return "Workspace name and shared workspace details."
    case .team: return "Manage groups, teammates, and who belongs where."
    case .integrations: return "Connected services and workspace integrations."
    case .notifications: return "How updates reach you in the app."
    case .security: return "Local data, privacy choices, and account security."
    case .harnesses: return "Hermes Agent, OpenClaw"
    case .runtime: return "Activity and action approvals"
    }
  }

  var icon: String {
    switch self {
    case .account: return "person.crop.circle"
    case .cloud: return "cloud"
    case .appearance: return "paintpalette"
    case .workspace: return "building.2"
    case .team: return "person.3"
    case .integrations: return "point.3.connected.trianglepath.dotted"
    case .notifications: return "bell"
    case .security: return "lock.shield"
    case .harnesses: return "terminal"
    case .runtime: return "list.bullet.rectangle"
    }
  }

  var detailSubtitle: String {
    switch self {
    case .account: return "Manage the profile details shown across your workspace."
    case .cloud:
      return "Use Relay on this Mac and connect customer-operated hosts for remote access."
    case .appearance: return "Choose how the interface is rendered across the app."
    case .workspace: return "Workspace settings are durable and read-only until service edits land."
    case .team: return "Organize the people and groups that make up this workspace."
    case .integrations:
      return "Connected services remain unavailable until retained integration services land."
    case .notifications: return "In-app alerts are retained; delivery controls stay unavailable."
    case .security:
      return "Local-first security state is retained; cloud account lifecycle is decision-gated."
    case .harnesses: return "Manage local Hermes Agent and OpenClaw harness lifecycle."
    case .runtime:
      return "Control live runtime activity and consequential-action approval preferences."
    }
  }

  var isUnavailableFoundation: Bool {
    switch self {
    case .integrations, .notifications, .security:
      return true
    case .account, .cloud, .appearance, .workspace, .team, .harnesses, .runtime:
      return false
    }
  }
}

enum ProviderApprovalFilter: String, CaseIterable, Identifiable {
  case pending
  case all
  case approved
  case executed
  case failed
  case rejected
  case expired
  case cancelled

  var id: String { rawValue }

  var title: String {
    switch self {
    case .pending: return "Pending"
    case .all: return "All"
    case .approved: return "Approved"
    case .executed: return "Executed"
    case .failed: return "Failed"
    case .rejected: return "Rejected"
    case .expired: return "Expired"
    case .cancelled: return "Cancelled"
    }
  }

  func includes(_ status: ProviderActionApprovalCardStatus) -> Bool {
    switch self {
    case .all:
      return true
    case .pending:
      return status == .pending
    case .approved:
      return status == .approved
    case .executed:
      return status == .executed
    case .failed:
      return status == .failed
    case .rejected:
      return status == .rejected
    case .expired:
      return status == .expired
    case .cancelled:
      return status == .cancelled
    }
  }
}

enum AppViewModelActionRefresh: Hashable {
  case full
  case chat
  case agents
  case operationalOutputs
  case applications
  case approvals
  case insights
  case settings
  case none
}

struct UserProfilePreference: Codable, Equatable {
  var displayName: String = ""
  var email: String = ""
  var avatarUrl: String?
  var telemetryEnabled: Bool = false
  var crashReportingEnabled: Bool = false
  var theme: String = "classic"

  init() {}

  init(profile: LocalProfile) {
    self.displayName = profile.displayName
    self.email = profile.email ?? ""
    self.avatarUrl = profile.avatarUrl
    self.telemetryEnabled = profile.telemetryEnabled
    self.crashReportingEnabled = profile.crashReportingEnabled
    self.theme = profile.theme
  }

  var snapshot: LocalProfilePreferenceSnapshot {
    LocalProfilePreferenceSnapshot(
      displayName: displayName,
      email: email,
      avatarUrl: avatarUrl,
      telemetryEnabled: telemetryEnabled,
      crashReportingEnabled: crashReportingEnabled,
      theme: theme
    )
  }

  enum CodingKeys: String, CodingKey {
    case displayName
    case email
    case avatarUrl
    case telemetryEnabled
    case crashReportingEnabled
    case theme
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    self.displayName = try container.decodeIfPresent(String.self, forKey: .displayName) ?? ""
    self.email = try container.decodeIfPresent(String.self, forKey: .email) ?? ""
    self.avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
    self.telemetryEnabled =
      try container.decodeIfPresent(Bool.self, forKey: .telemetryEnabled) ?? false
    self.crashReportingEnabled =
      try container.decodeIfPresent(Bool.self, forKey: .crashReportingEnabled) ?? false
    self.theme = try container.decodeIfPresent(String.self, forKey: .theme) ?? "classic"
  }
}

struct WorkspaceSettingsDraft: Equatable {
  var name: String = ""
  var workspaceType: String = "personal"

  init() {}

  init(workspace: Workspace) {
    self.name = workspace.name
    self.workspaceType = workspace.workspaceType
  }
}

struct CreateAgentDraft {
  var avatarUrl: String?
  var isManager: Bool = false
  var agentType: HarnessKey = .hermes
  var name: String = ""
  var role: String = ""
  var selectedModel: String = "gpt-5.5"
  var placement: String = AgentGroupType.unassigned.rawValue
  var groupLabel: String = ""
  var companyId: String = ""
  var departmentId: String = ""
  var teamId: String = ""
  var confirmManagerReplacement: Bool = false

  var groupType: AgentGroupType {
    AgentGroupType(rawValue: placement) ?? .unassigned
  }
}

struct ChatRuntimeContextUsageDisplay: Identifiable, Equatable {
  var id: String { agentId }
  var agentId: RelayId
  var agentName: String
  var avatarURL: String?
  var runtimeType: RuntimeType?
  var percentUsed: Double?
  var tokenCount: Int?
  var maxTokens: Int?
  var level: String
  var isEstimate: Bool
  var referencesCount: Int
  var updatedAt: IsoTimestamp?
}

struct AppToast: Identifiable, Equatable {
  enum Tone: Equatable {
    case info
    case success
    case error
  }

  let id = UUID()
  var title: String
  var message: String?
  var tone: Tone
}

@MainActor
final class AppViewModel: ObservableObject {
  let chatFeatureStore = FeatureOperationStore()
  let agentFeatureStore = FeatureOperationStore()
  let applicationsFeatureStore = FeatureOperationStore()
  let approvalsFeatureStore = FeatureOperationStore()
  let insightsFeatureStore = FeatureOperationStore()
  let settingsFeatureStore = FeatureOperationStore()

  @Published var nav: NavKey = .chat {
    didSet {
      guard oldValue != nav else { return }
      telemetry.screenViewed(nav == .agentOps ? "agent_ops" : nav.rawValue)
    }
  }
  @Published var loading = true
  @Published var relayLaunchAccessCheckInProgress = true
  @Published var busy: String?
  @Published var error: String?
  @Published var relayEntitlementAccess = RelayEntitlementAccess(
    state: .verificationRequired,
    message: "Relay must verify an active subscription before ordinary use."
  )
  @Published var relayAccountSetupInProgress = false
  var hasSignedInRelayAccount: Bool {
    guard let services else { return false }
    return ((try? services.cloudConnections.listAccounts().isEmpty) == false)
  }
  @Published var telemetryChoiceRequired = false
  @Published var telemetryChoiceSaving = false
  @Published var telemetryChoiceError: String?
  @Published var appState: AppState?
  @Published var records: [HarnessInstallRecord] = []
  @Published var runtimeModelCatalogs: [RuntimeType: HarnessRuntimeModelCatalog] = [:]
  @Published var installProgress: [HarnessKey: HarnessInstallProgressEvent] = [:]
  @Published var agents: [AgentWithBinding] = [] {
    didSet { agentsByIdCache = nil }
  }
  var agentsByIdCache: [RelayId: AgentWithBinding]?
  var runtimeModelCatalogLastRefreshedAt: Date?
  @Published var showRelayCloudAgents = true
  @Published var threads: [ThreadSummary] = []
  @Published var threadAgentIdsByThreadId: [RelayId: [RelayId]] = [:]
  @Published var selectedThreadId: String?
  @Published var selectedThreadDetail: ThreadDetail?
  @Published var selectedWrapUpReportId: String?
  @Published var messages: [Message] = []
  @Published var messageHistoryHasOlder = false
  @Published var messageHistoryHasNewer = false
  @Published var messageHistoryLoadingOlder = false
  @Published var messageHistoryLoadingNewer = false
  @Published var messageHistoryUnseenNewerCount = 0
  @Published var messageHistoryPrependAnchorId: RelayId?
  @Published var messageHistoryRevision = 0
  @Published var dispatches: [RuntimeDispatch] = []
  @Published var composerText = ""
  @Published var composerAttachments: [ChatAttachment] = []
  @Published var composerSendingAttachmentIds: Set<String> = []
  @Published var composerUploadInProgress = false
  @Published var composerMentionAvailability: ChatMentionAvailability?
  @Published var threadSearch = ""
  @Published var isStartingChat = false
  @Published var newChatKind: NewChatKind = .direct
  @Published var newChatSearch = ""
  @Published var newChatSelectedAgentId = ""
  @Published var newChatTeamDepartmentId = ""
  @Published var newChatTeamName = ""
  @Published var newChatTeamAgentIds: Set<String> = []
  @Published var selectedAgentId = ""
  @Published var agentPanelMode: AgentPanelMode = .detail
  @Published var agentPickerOpen = false
  @Published var agentSearch = ""
  @Published var createAgentDefaultType: HarnessKey = .hermes
  @Published var agentSubview: AgentSubviewKey = .instructions
  @Published var settingsPanel: SettingsPanelKey = .account
  @Published var runtimeActivityDetailEnabled = RuntimeExperienceSettings
    .defaultDetailedActivityEnabled
  @Published var runtimeApprovalMode = RuntimeExperienceSettings.defaultApprovalMode
  @Published var runtimeRunConfirmationEnabled = RuntimeExperienceSettings
    .defaultRunConfirmationEnabled
  @Published var agentDisplayNames: [String: String]
  @Published var agentAvatarUrls: [String: String]
  @Published var agentPreferences: [String: AgentPreferences] = [:]
  @Published var provisioningJobs: [AgentProvisioningJob] = []
  @Published var orgCompanies: [AgentOrgCompany] = []
  @Published var orgDepartments: [AgentOrgDepartment] = []
  @Published var orgTeams: [AgentOrgTeam] = []
  @Published var orgDashboardCounts: AgentOrgDashboardCounts?
  @Published var agentStructureDashboard: AgentStructureDashboardSnapshot?
  @Published var agentWorkCalendar: AgentWorkCalendarSnapshot?
  @Published var selectedCalendarGroup: AgentWorkCalendarGroupFilter = .all
  @Published var selectedCalendarSortMode: AgentWorkCalendarSortMode = .recentHours
  @Published var agentTasks: [AgentTask] = []
  @Published var agentTaskRuns: [AgentTaskRun] = []
  @Published var selectedAgentTaskId = ""
  @Published var agentTaskSearch = ""
  @Published var taskSchedulerOpen = false
  var agentTaskSchedulerLoop: Task<Void, Never>?
  @Published var cronJobsSnapshot: AgentCronJobsSnapshot?
  @Published var cronJobs: [AgentCronJobRecord] = []
  @Published var selectedCronJobId = ""
  @Published var cronJobSearch = ""
  @Published var dismissedCronDeliveryErrorKeys: Set<String>
  @Published var artifactsSnapshot: AgentArtifactsSnapshot?
  @Published var artifacts: [AgentArtifactRecord] = []
  @Published var artifactCatalogueSyncError: String? = nil
  @Published var selectedArtifactId = ""
  @Published var selectedArtifactGroupId = ""
  @Published var artifactSearch = ""
  @Published var artifactKindFilter: AgentArtifactKind?
  @Published var expandedArtifactGroupIds: Set<String> = []
  @Published var teamMemoryEntries: [AgentTeamMemoryEntry] = []
  @Published var teamHandovers: [AgentTeamHandover] = []
  @Published var agentOpsSnapshot: AgentOpsLiveStateSnapshot?
  @Published var agentOpsSceneSnapshot: AgentOpsVisualSceneSnapshot?
  @Published var runtimeDashboardSnapshot: RuntimeDashboardSnapshot?
  @Published var runtimeActionCapabilities: [RuntimeActionCapability] = []
  @Published var runtimeActionRuns: [RuntimeActionRun] = []
  @Published var runtimeStructuredJobs: [RuntimeStructuredJob] = []
  @Published var runtimeMissingTools: [RuntimeMissingToolEvent] = []
  @Published var runtimeRecoveryRecords: [RuntimeRecoveryRecord] = []
  @Published var applicationsCatalogSnapshot: ApplicationsCatalogSnapshot? {
    didSet { conversationInstalledAppsByAgentId = nil }
  }
  @Published var applicationsCatalogApps: [MarketplaceCatalogApp] = [] {
    didSet { conversationInstalledAppsByAgentId = nil }
  }
  var conversationInstalledAppsByAgentId: [RelayId: [MarketplaceCatalogApp]]?
  @Published var providerConnectionSnapshot: ProviderConnectionSnapshot?
  @Published var providerConnectionsByAppId: [RelayId: MarketplaceProviderConnection] = [:]
  @Published var exaInstallSnapshot: MarketplaceInstallSnapshot?
  @Published var marketplaceActionPermissionMapsByInstallId:
    [RelayId: MarketplaceActionPermissionMap] = [:]
  @Published var applicationsSearch = ""
  @Published var applicationsSelectedCategory: String?
  @Published var applicationsSelectedAppId = ""
  @Published var applicationsLoadingMore = false
  @Published var exaAPIKeyDraft = ""
  @Published var exaAPIConnectionNameDraft = ""
  @Published var exaConnectionStatus: String?
  @Published var exaSelectedConnectionId = ""
  @Published var exaAgentSearch = ""
  @Published var exaSelectedAgentIds: Set<String> = []
  @Published var marketplaceManifestConnectionStatus: String?
  @Published var marketplaceOAuthConnectionStatus: String?
  @Published var marketplaceAgentAssignmentStatus: String?
  @Published var mailgunAPIKeyDraft = ""
  @Published var mailgunDomainDraft = ""
  @Published var mailgunRegionDraft = "US"
  @Published var mailgunKeyTypeDraft = "account"
  @Published var mailgunConnectionStatus: String?
  @Published var paypalClientIdDraft = ""
  @Published var paypalClientSecretDraft = ""
  @Published var paypalEnvironmentDraft = "sandbox"
  @Published var paypalConnectionStatus: String?
  @Published var sendGridAPIKeyDraft = ""
  @Published var sendGridRegionDraft = "GLOBAL"
  @Published var sendGridSenderBoundaryDraft = ""
  @Published var sendGridConnectionStatus: String?
  @Published var postmarkServerTokenDraft = ""
  @Published var postmarkAccountTokenDraft = ""
  @Published var postmarkSenderBoundaryDraft = ""
  @Published var postmarkMessageStreamDraft = "outbound"
  @Published var postmarkConnectionStatus: String?
  @Published var resendAPITokenDraft = ""
  @Published var resendKeyPermissionDraft = "SENDING"
  @Published var resendDomainDraft = ""
  @Published var resendConnectionStatus: String?
  @Published var sparkPostAPIKeyDraft = ""
  @Published var sparkPostRegionDraft = "US"
  @Published var sparkPostSenderDomainDraft = ""
  @Published var sparkPostSubaccountDraft = ""
  @Published var sparkPostConnectionStatus: String?
  @Published var brevoAPIKeyDraft = ""
  @Published var brevoSenderBoundaryDraft = ""
  @Published var brevoConnectionStatus: String?
  @Published var mailjetAPIKeyDraft = ""
  @Published var mailjetSecretKeyDraft = ""
  @Published var mailjetSenderBoundaryDraft = ""
  @Published var mailjetConnectionStatus: String?
  @Published var fuseBaseMCPURLDraft = ""
  @Published var fuseBaseMCPTokenDraft = ""
  @Published var fuseBaseConnectionStatus: String?
  @Published var memAPIKeyDraft = ""
  @Published var readwiseAccessTokenDraft = ""
  @Published var readwiseConnectionStatus: String?
  @Published var instapaperUsernameDraft = ""
  @Published var instapaperPasswordDraft = ""
  @Published var instaparserAPIKeyDraft = ""
  @Published var instapaperConnectionStatus: String?
  @Published var feedlyAccessTokenDraft = ""
  @Published var feedlyConnectionStatus: String?
  @Published var readMeAPIKeyDraft = ""
  @Published var readMeConnectionStatus: String?
  @Published var document360APITokenDraft = ""
  @Published var document360APIOriginDraft = "https://apihub.document360.io"
  @Published var document360ConnectionStatus: String?
  @Published var archbeeDocSpaceIDDraft = ""
  @Published var archbeeAPIKeyDraft = ""
  @Published var archbeeConnectionStatus: String?
  @Published var tettraTeamIDDraft = ""
  @Published var tettraAPIKeyDraft = ""
  @Published var tettraConnectionStatus: String?
  @Published var knowledgeOwlProjectIDDraft = ""
  @Published var knowledgeOwlAPIKeyDraft = ""
  @Published var knowledgeOwlConnectionStatus: String?
  @Published var freshdeskDomainDraft = ""
  @Published var freshdeskAPIKeyDraft = ""
  @Published var freshdeskConnectionStatus: String?
  @Published var sanityProjectIDDraft = ""
  @Published var sanityDatasetDraft = "production"
  @Published var sanityAPITokenDraft = ""
  @Published var sanityConnectionStatus: String?
  @Published var strapiCloudInstanceURLDraft = ""
  @Published var strapiCloudAllowedAPIIDsDraft = ""
  @Published var strapiCloudAPITokenDraft = ""
  @Published var strapiCloudConnectionStatus: String?
  @Published var ghostAdminURLDraft = ""
  @Published var ghostAdminAPIKeyDraft = ""
  @Published var ghostConnectionStatus: String?
  @Published var codaAPITokenDraft = ""
  @Published var codaConnectionStatus: String?
  @Published var vidyardAPITokenDraft = ""
  @Published var vidyardConnectionStatus: String?
  @Published var padletAPITokenDraft = ""
  @Published var padletConnectionStatus: String?
  @Published var descriptAPITokenDraft = ""
  @Published var descriptConnectionStatus: String?
  @Published var tlDvAPIKeyDraft = ""
  @Published var tlDvConnectionStatus: String?
  @Published var revClientAPIKeyDraft = ""
  @Published var revUserAPIKeyDraft = ""
  @Published var revConnectionStatus: String?
  @Published var buzzsproutAPITokenDraft = ""
  @Published var buzzsproutPodcastIDDraft = ""
  @Published var buzzsproutConnectionStatus: String?
  @Published var captivateAPIKeyDraft = ""
  @Published var captivateUserIDDraft = ""
  @Published var captivateShowIDDraft = ""
  @Published var captivateConnectionStatus: String?
  @Published var transistorAPIKeyDraft = ""
  @Published var transistorShowIDDraft = ""
  @Published var transistorConnectionStatus: String?
  @Published var riversideAPIKeyDraft = ""
  @Published var riversideConnectionStatus: String?
  @Published var slabAPITokenDraft = ""
  @Published var slabConnectionStatus: String?
  @Published var roadmunkAPITokenDraft = ""
  @Published var roadmunkRegionDraft = "na"
  @Published var roadmunkConnectionStatus: String?
  @Published var shortcutAPITokenDraft = ""
  @Published var shortcutConnectionStatus: String?
  @Published var hiveAPIKeyDraft = ""
  @Published var hiveUserIDDraft = ""
  @Published var hiveConnectionStatus: String?
  @Published var paymoAPIKeyDraft = ""
  @Published var paymoConnectionStatus: String?
  @Published var krakenAPIKeyDraft = ""
  @Published var krakenAPISecretDraft = ""
  @Published var krakenConnectionStatus: String?
  @Published var binanceAPIKeyDraft = ""
  @Published var binanceAPISecretDraft = ""
  @Published var binanceConnectionStatus: String?
  @Published var geminiAPIKeyDraft = ""
  @Published var geminiAPISecretDraft = ""
  @Published var geminiConnectionStatus: String?
  @Published var nozbeAPITokenDraft = ""
  @Published var nozbeConnectionStatus: String?
  @Published var proofHubAccountDraft = ""
  @Published var proofHubAPIKeyDraft = ""
  @Published var proofHubConnectionStatus: String?
  @Published var quipClientIDDraft = ""
  @Published var quipClientSecretDraft = ""
  @Published var quipConnectionStatus: String?
  @Published var bynderPortalDraft = ""
  @Published var bynderClientIDDraft = ""
  @Published var bynderClientSecretDraft = ""
  @Published var bynderConnectionStatus: String?
  @Published var brandfolderAPIKeyDraft = ""
  @Published var brandfolderConnectionStatus: String?
  @Published var widenCollectiveSubdomainDraft = ""
  @Published var widenCollectiveAccessTokenDraft = ""
  @Published var widenCollectiveConnectionStatus: String?
  @Published var kontainerTenantDraft = ""
  @Published var kontainerAccessTokenDraft = ""
  @Published var kontainerConnectionStatus: String?
  @Published var jiraAlignSiteURLDraft = ""
  @Published var jiraAlignEmailDraft = ""
  @Published var jiraAlignAPITokenDraft = ""
  @Published var jiraAlignConnectionStatus: String?
  @Published var daminionTenantDraft = ""
  @Published var daminionUsernameDraft = ""
  @Published var daminionPasswordDraft = ""
  @Published var daminionConnectionStatus: String?
  @Published var msProjectEnvironmentDraft = ""
  @Published var msProjectConnectionStatus: String?
  @Published var cantoAccountDraft = ""
  @Published var cantoClientIDDraft = ""
  @Published var cantoClientSecretDraft = ""
  @Published var cantoConnectionStatus: String?
  @Published var frontifyAccountDraft = ""
  @Published var frontifyClientIDDraft = ""
  @Published var frontifyClientSecretDraft = ""
  @Published var frontifyConnectionStatus: String?
  @Published var assetBankSiteDraft = ""
  @Published var assetBankClientIDDraft = ""
  @Published var assetBankClientSecretDraft = ""
  @Published var assetBankConnectionStatus: String?
  @Published var memConnectionStatus: String?
  @Published var xSelectedConnectionId = ""
  @Published var xAgentSearch = ""
  @Published var xConnectionStatus: String?
  @Published var facebookPagesSelectedConnectionId = ""
  @Published var facebookPagesConnectionStatus: String?
  @Published var facebookPagesAgentSearch = ""
  @Published var instagramBusinessSelectedConnectionId = ""
  @Published var instagramBusinessConnectionStatus: String?
  @Published var instagramBusinessAgentSearch = ""
  @Published var threadsSelectedConnectionId = ""
  @Published var threadsConnectionStatus: String?
  @Published var threadsAgentSearch = ""
  @Published var pinterestSelectedConnectionId = ""
  @Published var pinterestConnectionStatus: String?
  @Published var pinterestAgentSearch = ""
  @Published var tumblrSelectedConnectionId = ""
  @Published var tumblrConnectionStatus: String?
  @Published var tumblrAgentSearch = ""
  @Published var mastodonInstanceOriginDraft = ""
  @Published var mastodonSelectedConnectionId = ""
  @Published var mastodonConnectionStatus: String?
  @Published var mastodonAgentSearch = ""
  @Published var blueskyHandleDraft = ""
  @Published var blueskySelectedConnectionId = ""
  @Published var blueskyConnectionStatus: String?
  @Published var blueskyAgentSearch = ""
  @Published var nextdoorExpectedProfileDraft = ""
  @Published var nextdoorSelectedConnectionId = ""
  @Published var nextdoorConnectionStatus: String?
  @Published var nextdoorAgentSearch = ""
  @Published var meetupSelectedConnectionId = ""
  @Published var meetupConnectionStatus: String?
  @Published var meetupAgentSearch = ""
  @Published var eventbriteSelectedConnectionId = ""
  @Published var eventbriteConnectionStatus: String?
  @Published var eventbriteAgentSearch = ""
  @Published var webexSelectedConnectionId = ""
  @Published var webexConnectionStatus: String?
  @Published var webexAgentSearch = ""
  @Published var goToMeetingSelectedConnectionId = ""
  @Published var goToMeetingConnectionStatus: String?
  @Published var goToMeetingAgentSearch = ""
  @Published var ringCentralSelectedConnectionId = ""
  @Published var ringCentralConnectionStatus: String?
  @Published var dialpadSelectedConnectionId = ""
  @Published var dialpadConnectionStatus: String?
  @Published var aircallSelectedConnectionId = ""
  @Published var aircallConnectionStatus: String?
  @Published var openPhoneAPIKeyDraft = ""
  @Published var openPhoneSelectedConnectionId = ""
  @Published var openPhoneConnectionStatus: String?
  @Published var twilioAccountSIDDraft = ""
  @Published var twilioAPIKeySIDDraft = ""
  @Published var twilioAPIKeySecretDraft = ""
  @Published var twilioSelectedConnectionId = ""
  @Published var twilioConnectionStatus: String?
  @Published var vonageAPIKeyDraft = ""
  @Published var vonageAPISecretDraft = ""
  @Published var vonageSelectedConnectionId = ""
  @Published var vonageConnectionStatus: String?
  @Published var messageBirdOrganizationIDDraft = ""
  @Published var messageBirdWorkspaceIDDraft = ""
  @Published var messageBirdAccessKeyDraft = ""
  @Published var messageBirdSelectedConnectionId = ""
  @Published var messageBirdConnectionStatus: String?
  @Published var fredAPIKeyDraft = ""
  @Published var fredSelectedConnectionId = ""
  @Published var fredConnectionStatus: String?
  @Published var lineSelectedConnectionId = ""
  @Published var lineConnectionStatus: String?
  @Published var twistSelectedConnectionId = ""
  @Published var twistConnectionStatus: String?
  @Published var twistAgentSearch = ""
  @Published var zohoMailSelectedConnectionId = ""
  @Published var zohoMailConnectionStatus: String?
  @Published var zohoMailAgentSearch = ""
  @Published var ringCentralAgentSearch = ""
  @Published var linkedinAccessTokenDraft = ""
  @Published var linkedinClientIdDraft = ""
  @Published var linkedinClientSecretDraft = ""
  @Published var linkedinRefreshTokenDraft = ""
  @Published var linkedinTokenExpiresAtDraft = ""
  @Published var linkedinTokenConnectionNameDraft = ""
  @Published var linkedinAgentSearch = ""
  @Published var linkedinConnectionStatus: String?
  @Published var gmailConnectionNameDraft = ""
  @Published var gmailClientIdDraft = ""
  @Published var gmailClientSecretDraft = ""
  @Published var gmailRefreshTokenDraft = ""
  @Published var gmailAccessTokenDraft = ""
  @Published var gmailAccountEmailDraft = ""
  @Published var gmailSelectedConnectionId = ""
  @Published var gmailAgentSearch = ""
  @Published var gmailConnectionStatus: String?
  @Published var googleDocsConnectionNameDraft = ""
  @Published var googleDocsClientIdDraft = ""
  @Published var googleDocsClientSecretDraft = ""
  @Published var googleDocsRefreshTokenDraft = ""
  @Published var googleDocsAccessTokenDraft = ""
  @Published var googleDocsAccountEmailDraft = ""
  @Published var googleDocsProjectIdDraft = ""
  @Published var googleDocsSelectedConnectionId = ""
  @Published var googleDocsAgentSearch = ""
  @Published var googleDocsConnectionStatus: String?
  @Published var googleCalendarConnectionNameDraft = ""
  @Published var googleCalendarClientIdDraft = ""
  @Published var googleCalendarClientSecretDraft = ""
  @Published var googleCalendarRefreshTokenDraft = ""
  @Published var googleCalendarAccessTokenDraft = ""
  @Published var googleCalendarAccountEmailDraft = ""
  @Published var googleCalendarDefaultCalendarIdDraft = "primary"
  @Published var googleCalendarSelectedConnectionId = ""
  @Published var googleCalendarAgentSearch = ""
  @Published var googleCalendarConnectionStatus: String?
  @Published var googleDriveConnectionNameDraft = ""
  @Published var googleDriveClientIdDraft = ""
  @Published var googleDriveClientSecretDraft = ""
  @Published var googleDriveRefreshTokenDraft = ""
  @Published var googleDriveAccessTokenDraft = ""
  @Published var googleDriveAccountEmailDraft = ""
  @Published var googleDriveSelectedConnectionId = ""
  @Published var googleDriveAgentSearch = ""
  @Published var googleDriveConnectionStatus: String?
  @Published var googleSheetsSelectedConnectionId = ""
  @Published var googleSheetsConnectionStatus: String?
  @Published var googleSlidesSelectedConnectionId = ""
  @Published var googleSlidesConnectionStatus: String?
  @Published var googleFormsSelectedConnectionId = ""
  @Published var googleFormsConnectionStatus: String?
  @Published var googleTasksSelectedConnectionId = ""
  @Published var googleTasksConnectionStatus: String?
  @Published var googleContactsSelectedConnectionId = ""
  @Published var googleContactsConnectionStatus: String?
  @Published var googlePhotosSelectedConnectionId = ""
  @Published var googlePhotosConnectionStatus: String?
  @Published var googleMeetSelectedConnectionId = ""
  @Published var googleMeetConnectionStatus: String?
  @Published var googleChatSelectedConnectionId = ""
  @Published var googleChatConnectionStatus: String?
  @Published var googleAdsSelectedConnectionId = ""
  @Published var googleAdsConnectionStatus: String?
  @Published var googleSearchConsoleSelectedConnectionId = ""
  @Published var googleSearchConsoleAgentSearch = ""
  @Published var googleSearchConsoleConnectionStatus: String?
  @Published var googleAnalyticsSelectedConnectionId = ""
  @Published var googleAnalyticsAgentSearch = ""
  @Published var googleAnalyticsConnectionStatus: String?
  @Published var googleMerchantCenterSelectedConnectionId = ""
  @Published var googleMerchantCenterConnectionStatus: String?
  @Published var youTubeSelectedConnectionId = ""
  @Published var youTubeConnectionStatus: String?
  @Published var googleClassroomSelectedConnectionId = ""
  @Published var googleClassroomConnectionStatus: String?
  @Published var outlookSelectedConnectionId = ""
  @Published var outlookConnectionStatus: String?
  @Published var microsoftTeamsSelectedConnectionId = ""
  @Published var microsoftTeamsConnectionStatus: String?
  @Published var oneDriveSelectedConnectionId = ""
  @Published var oneDriveConnectionStatus: String?
  @Published var sharePointSelectedConnectionId = ""
  @Published var sharePointConnectionStatus: String?
  @Published var microsoftPlannerSelectedConnectionId = ""
  @Published var microsoftPlannerConnectionStatus: String?
  @Published var microsoftToDoSelectedConnectionId = ""
  @Published var microsoftToDoConnectionStatus: String?
  @Published var microsoftListsSelectedConnectionId = ""
  @Published var microsoftListsConnectionStatus: String?
  @Published var oneNoteSelectedConnectionId = ""
  @Published var oneNoteConnectionStatus: String?
  @Published var microsoftBookingsSelectedConnectionId = ""
  @Published var microsoftBookingsConnectionStatus: String?
  @Published var microsoftPowerBISelectedConnectionId = ""
  @Published var microsoftPowerBIConnectionStatus: String?
  @Published var microsoftDynamics365SelectedConnectionId = ""
  @Published var microsoftDynamics365ConnectionStatus: String?
  @Published var microsoftVivaEngageSelectedConnectionId = ""
  @Published var microsoftVivaEngageConnectionStatus: String?
  @Published var zoomSelectedConnectionId = ""
  @Published var zoomConnectionStatus: String?
  @Published var discordSelectedConnectionId = ""
  @Published var discordConnectionStatus: String?
  @Published var postHogConnectionNameDraft = ""
  @Published var postHogBaseURLDraft = "https://us.posthog.com"
  @Published var postHogPersonalAPIKeyDraft = ""
  @Published var postHogOrganizationIdDraft = ""
  @Published var postHogOrganizationNameDraft = ""
  @Published var postHogProjectIdDraft = ""
  @Published var postHogProjectNameDraft = ""
  @Published var postHogSelectedConnectionId = ""
  @Published var postHogAgentSearch = ""
  @Published var postHogConnectionStatus: String?
  @Published var microsoftClarityConnectionNameDraft = ""
  @Published var microsoftClarityAPITokenDraft = ""
  @Published var microsoftClarityProjectLabelDraft = ""
  @Published var microsoftClarityProjectURLDraft = ""
  @Published var microsoftClarityProjectIdDraft = ""
  @Published var microsoftClaritySelectedConnectionId = ""
  @Published var microsoftClarityAgentSearch = ""
  @Published var microsoftClarityConnectionStatus: String?
  @Published var telemetryDeckConnectionNameDraft = ""
  @Published var telemetryDeckPATDraft = ""
  @Published var telemetryDeckNamespaceDraft = ""
  @Published var telemetryDeckAppIdDraft = ""
  @Published var telemetryDeckAppDisplayNameDraft = ""
  @Published var telemetryDeckDefaultInsightIdDraft = ""
  @Published var telemetryDeckSelectedConnectionId = ""
  @Published var telemetryDeckAgentSearch = ""
  @Published var telemetryDeckConnectionStatus: String?
  @Published var sentryConnectionNameDraft = ""
  @Published var sentryAuthTokenDraft = ""
  @Published var sentryOrganizationSlugDraft = ""
  @Published var sentryBaseURLDraft = ""
  @Published var sentryDefaultProjectSlugDraft = ""
  @Published var sentryDefaultEnvironmentDraft = ""
  @Published var sentrySelectedConnectionId = ""
  @Published var sentryAgentSearch = ""
  @Published var sentryConnectionStatus: String?
  @Published var datadogSelectedConnectionId = ""
  @Published var datadogAgentSearch = ""
  @Published var datadogConnectionStatus: String?
  @Published var pagerDutySelectedConnectionId = ""
  @Published var pagerDutyAgentSearch = ""
  @Published var pagerDutyConnectionStatus: String?
  @Published var cloudflareSelectedConnectionId = ""
  @Published var cloudflareAgentSearch = ""
  @Published var cloudflareConnectionStatus: String?
  @Published var vercelSelectedConnectionId = ""
  @Published var vercelAgentSearch = ""
  @Published var vercelConnectionStatus: String?
  @Published var herokuSelectedConnectionId = ""
  @Published var herokuAgentSearch = ""
  @Published var herokuConnectionStatus: String?
  @Published var digitalOceanSelectedConnectionId = ""
  @Published var digitalOceanAgentSearch = ""
  @Published var digitalOceanConnectionStatus: String?
  @Published var firebaseSelectedConnectionId = ""
  @Published var firebaseAgentSearch = ""
  @Published var firebaseConnectionStatus: String?
  @Published var supabaseSelectedConnectionId = ""
  @Published var supabaseAgentSearch = ""
  @Published var supabaseConnectionStatus: String?
  @Published var oktaOrgDomainDraft = ""
  @Published var oktaClientIdDraft = ""
  @Published var oktaClientSecretDraft = ""
  @Published var oktaApplicationIdDraft = ""
  @Published var oktaApplicationLabelDraft = ""
  @Published var oktaSelectedConnectionId = ""
  @Published var oktaAgentSearch = ""
  @Published var oktaConnectionStatus: String?
  @Published var bambooHRSelectedConnectionId = ""
  @Published var bambooHRAgentSearch = ""
  @Published var bambooHRConnectionStatus: String?
  @Published var greenhouseSelectedConnectionId = ""
  @Published var greenhouseConnectionStatus: String?
  @Published var leverSelectedConnectionId = ""
  @Published var leverConnectionStatus: String?
  @Published var notionConnectionNameDraft = ""
  @Published var notionCredentialModeDraft = "personal_access_token"
  @Published var notionAPITokenDraft = ""
  @Published var notionWorkspaceLabelDraft = ""
  @Published var notionSelectedConnectionId = ""
  @Published var notionAgentSearch = ""
  @Published var notionConnectionStatus: String?
  @Published var slackSelectedConnectionId = ""
  @Published var slackConnectionStatus: String?
  @Published var githubSelectedConnectionId = ""
  @Published var githubAgentSearch = ""
  @Published var githubConnectionStatus: String?
  @Published var gitLabSelectedConnectionId = ""
  @Published var gitLabAgentSearch = ""
  @Published var gitLabConnectionStatus: String?
  @Published var bitbucketSelectedConnectionId = ""
  @Published var bitbucketAgentSearch = ""
  @Published var bitbucketConnectionStatus: String?
  @Published var linearSelectedConnectionId = ""
  @Published var linearAgentSearch = ""
  @Published var linearConnectionStatus: String?
  @Published var asanaSelectedConnectionId = ""
  @Published var asanaAgentSearch = ""
  @Published var asanaConnectionStatus: String?
  @Published var trelloSelectedConnectionId = ""
  @Published var trelloAgentSearch = ""
  @Published var trelloConnectionStatus: String?
  @Published var clickUpSelectedConnectionId = ""
  @Published var clickUpAgentSearch = ""
  @Published var clickUpConnectionStatus: String?
  @Published var mondaySelectedConnectionId = ""
  @Published var mondayAgentSearch = ""
  @Published var mondayConnectionStatus: String?
  @Published var airtableSelectedConnectionId = ""
  @Published var airtableAgentSearch = ""
  @Published var airtableConnectionStatus: String?
  @Published var dropboxSelectedConnectionId = ""
  @Published var dropboxAgentSearch = ""
  @Published var dropboxConnectionStatus: String?
  @Published var boxSelectedConnectionId = ""
  @Published var boxAgentSearch = ""
  @Published var boxConnectionStatus: String?
  @Published var figmaSelectedConnectionId = ""
  @Published var figmaAgentSearch = ""
  @Published var figmaConnectionStatus: String?
  @Published var miroSelectedConnectionId = ""
  @Published var miroAgentSearch = ""
  @Published var miroConnectionStatus: String?
  @Published var canvaSelectedConnectionId = ""
  @Published var canvaAgentSearch = ""
  @Published var canvaConnectionStatus: String?
  @Published var webflowSelectedConnectionId = ""
  @Published var webflowAgentSearch = ""
  @Published var webflowConnectionStatus: String?
  @Published var wordpressComSelectedConnectionId = ""
  @Published var wordpressComAgentSearch = ""
  @Published var wordpressComConnectionStatus: String?
  @Published var contentfulSelectedConnectionId = ""
  @Published var contentfulAgentSearch = ""
  @Published var contentfulConnectionStatus: String?
  @Published var shopifySelectedConnectionId = ""
  @Published var shopifyAgentSearch = ""
  @Published var shopifyConnectionStatus: String?
  @Published var wooCommerceSelectedConnectionId = ""
  @Published var wooCommerceAgentSearch = ""
  @Published var wooCommerceConnectionStatus: String?
  @Published var stripeSelectedConnectionId = ""
  @Published var stripeAgentSearch = ""
  @Published var stripeConnectionStatus: String?
  @Published var xeroSelectedConnectionId = ""
  @Published var xeroClientIDDraft = ""
  @Published var xeroClientSecretDraft = ""
  @Published var xeroAgentSearch = ""
  @Published var xeroConnectionStatus: String?
  @Published var quickBooksSelectedConnectionId = ""
  @Published var quickBooksAgentSearch = ""
  @Published var quickBooksConnectionStatus: String?
  @Published var freshBooksSelectedConnectionId = ""
  @Published var freshBooksAgentSearch = ""
  @Published var freshBooksConnectionStatus: String?
  @Published var waveSelectedConnectionId = ""
  @Published var waveAgentSearch = ""
  @Published var waveConnectionStatus: String?
  @Published var freeAgentSelectedConnectionId = ""
  @Published var freeAgentAgentSearch = ""
  @Published var freeAgentConnectionStatus: String?
  @Published var salesforceSelectedConnectionId = ""
  @Published var salesforceAgentSearch = ""
  @Published var salesforceConnectionStatus: String?
  @Published var hubSpotSelectedConnectionId = ""
  @Published var hubSpotAgentSearch = ""
  @Published var hubSpotConnectionStatus: String?
  @Published var pipedriveSelectedConnectionId = ""
  @Published var pipedriveAgentSearch = ""
  @Published var pipedriveConnectionStatus: String?
  @Published var copperSelectedConnectionId = ""
  @Published var copperAgentSearch = ""
  @Published var copperConnectionStatus: String?
  @Published var closeSelectedConnectionId = ""
  @Published var closeAgentSearch = ""
  @Published var closeConnectionStatus: String?
  @Published var zendeskSelectedConnectionId = ""
  @Published var zendeskAgentSearch = ""
  @Published var zendeskSubdomainDraft = ""
  @Published var zendeskConnectionStatus: String?
  @Published var intercomSelectedConnectionId = ""
  @Published var intercomAgentSearch = ""
  @Published var intercomConnectionStatus: String?
  @Published var helpScoutSelectedConnectionId = ""
  @Published var helpScoutAgentSearch = ""
  @Published var helpScoutConnectionStatus: String?
  @Published var frontSelectedConnectionId = ""
  @Published var frontAgentSearch = ""
  @Published var frontConnectionStatus: String?
  @Published var grooveSelectedConnectionId = ""
  @Published var grooveAgentSearch = ""
  @Published var grooveAPITokenDraft = ""
  @Published var grooveConnectionStatus: String?
  @Published var teamworkSelectedConnectionId = ""
  @Published var teamworkAgentSearch = ""
  @Published var teamworkConnectionStatus: String?
  @Published var basecampSelectedConnectionId = ""
  @Published var basecampAgentSearch = ""
  @Published var basecampConnectionStatus: String?
  @Published var wrikeSelectedConnectionId = ""
  @Published var wrikeAgentSearch = ""
  @Published var wrikeConnectionStatus: String?
  @Published var smartsheetSelectedConnectionId = ""
  @Published var smartsheetAgentSearch = ""
  @Published var smartsheetConnectionStatus: String?
  @Published var todoistSelectedConnectionId = ""
  @Published var todoistAgentSearch = ""
  @Published var todoistConnectionStatus: String?
  @Published var harvestSelectedConnectionId = ""
  @Published var harvestAgentSearch = ""
  @Published var harvestConnectionStatus: String?
  @Published var calendlySelectedConnectionId = ""
  @Published var calendlyAgentSearch = ""
  @Published var calendlyConnectionStatus: String?
  @Published var calComSelectedConnectionId = ""
  @Published var calComAgentSearch = ""
  @Published var calComConnectionStatus: String?
  @Published var docusignSelectedConnectionId = ""
  @Published var docusignAgentSearch = ""
  @Published var docusignConnectionStatus: String?
  @Published var dropboxSignSelectedConnectionId = ""
  @Published var dropboxSignAgentSearch = ""
  @Published var dropboxSignConnectionStatus: String?
  @Published var pandaDocSelectedConnectionId = ""
  @Published var pandaDocAgentSearch = ""
  @Published var pandaDocConnectionStatus: String?
  @Published var typeformSelectedConnectionId = ""
  @Published var typeformAgentSearch = ""
  @Published var typeformConnectionStatus: String?
  @Published var surveyMonkeySelectedConnectionId = ""
  @Published var surveyMonkeyAgentSearch = ""
  @Published var surveyMonkeyConnectionStatus: String?
  @Published var filloutSelectedConnectionId = ""
  @Published var filloutAgentSearch = ""
  @Published var filloutConnectionStatus: String?
  @Published var mailchimpSelectedConnectionId = ""
  @Published var mailchimpAgentSearch = ""
  @Published var mailchimpConnectionStatus: String?
  @Published var klaviyoSelectedConnectionId = ""
  @Published var klaviyoAgentSearch = ""
  @Published var klaviyoConnectionStatus: String?
  @Published var convertKitSelectedConnectionId = ""
  @Published var convertKitAgentSearch = ""
  @Published var convertKitConnectionStatus: String?
  @Published var campaignMonitorSelectedConnectionId = ""
  @Published var campaignMonitorAgentSearch = ""
  @Published var campaignMonitorConnectionStatus: String?
  @Published var constantContactSelectedConnectionId = ""
  @Published var constantContactAgentSearch = ""
  @Published var constantContactConnectionStatus: String?
  @Published var providerApprovalInbox: ProviderActionApprovalInboxSnapshot?
  @Published var approvalSearch = ""
  @Published var approvalStatusFilter: ProviderApprovalFilter = .pending
  @Published var selectedProviderApprovalId = ""
  @Published var commandPalettePresented = false
  @Published var commandPaletteQuery = ""
  @Published var appToast: AppToast?
  @Published var insightsReportList: InsightsReportListSnapshot?
  @Published var insightsReportDetail: InsightsReportDetail?
  @Published var insightsAnalytics: ThreadAnalyticsSnapshot?
  @Published var insightsSearch = ""
  @Published var insightsSourceFilter: InsightsReportSourceFilter = .all
  @Published var insightsSort: InsightsReportSort = .newest
  @Published var insightsIncludeArchived = false
  @Published var insightsSelectedReportId = ""
  @Published var insightsShowingAnalytics = false
  @Published var insightsActivityGapMinutes = 30
  @Published var insightsStatus: String?
  @Published var collapsedInsightsGroupIds: Set<String> = []
  @Published var agentOpsSearch = ""
  @Published var selectedAgentOpsAgentId = ""
  @Published var selectedAgentOpsSceneEntityId = ""
  @Published var agentOpsStatusVisible = false
  @Published var agentOpsBoundsVisible = false
  @Published var agentOpsPathsVisible = false
  @Published var agentOpsLayoutEditorVisible = false
  @Published var agentOpsLayoutSnapToGrid = true
  @Published var agentOpsLayoutLabelsVisible = true
  @Published var agentOpsLayoutPathEditing = false
  @Published var agentOpsLayoutPathAddMode = false
  @Published var agentOpsLayoutShowPathNetwork = true
  @Published var agentOpsLayoutActivePathTags: Set<AgentOpsLayoutPathTag> = [.main, .idle]
  @Published var agentOpsLayoutSelectedPathItem: AgentOpsLayoutPathSelection?
  @Published var agentOpsLayoutPathConnectFromId: RelayId?
  @Published var agentOpsLayoutAnchorVisibility: Set<AgentOpsLayoutAnchorGroup> = Set(
    AgentOpsLayoutAnchorGroup.allCases)
  @Published var agentOpsLayoutSelectedAnchor: AgentOpsLayoutAnchorSelection?
  @Published var agentOpsLayoutCursorPoint: AgentOpsVisualPoint?
  @Published var agentOpsLayoutOverlayOpacity = 0.72
  @Published var agentOpsLayoutPathWaypoints: [AgentOpsLayoutWaypoint] = []
  @Published var agentOpsLayoutPathEdges: [AgentOpsLayoutEdge] = []
  @Published var agentOpsLayoutStatus: String?
  @Published var agentDisplayNameSuccess: [String: String] = [:]
  @Published var agentClassificationSuccess: [String: String] = [:]
  @Published var pendingAgentDeletionImpact: AgentDeletionImpact?
  @Published var userProfile: UserProfilePreference
  @Published var guardedShellNotice: ShellRouteResolution?
  @Published var workspaceSettingsDraft = WorkspaceSettingsDraft()
  @Published var settingsStatus: String?
  @Published var settingsIntegrationSummary: SettingsIntegrationSummary?
  @Published var settingsNotificationPreferences: SettingsNotificationPreferences?
  @Published var settingsSecuritySummary: SettingsSecuritySummary?
  @Published var settingsAlerts: [SettingsAlertRecord] = []
  @Published var settingsAlertsUnreadOnly = false
  @Published var settingsUnreadAlertCount = 0

  let services: RelayConsoleServices?
  let shellNavigation = ShellNavigationResolver()
  let telemetry = RelayTelemetry.shared
  var scheduledFeatureRefreshTasks: [AppViewModelActionRefresh: Task<Void, Never>] = [:]
  var scheduledApplicationsRefreshTask: Task<Void, Never>?
  var scheduledAccountSettingsSaveTask: Task<Void, Never>?
  var automaticCloudLinkTask: Task<Void, Never>?
  var automaticRuntimeBridge: CloudRuntimeDeviceTransport?
  var toastDismissTask: Task<Void, Never>?
  var isRefreshing = false
  var isRefreshingChat = false
  var isRefreshingAgents = false
  var isRefreshingApprovals = false
  var isRefreshingInsights = false
  var isRefreshingSettings = false
  var isRefreshingApplications = false
  var isRefreshingOperationalOutputs = false
  var loadedComposerThreadId: String?
  var loadedComposerProfileId: String?
  var messageWindowThreadId: RelayId?
  var messageWindowSessionId: RelayId?
  var messageWindowGeneration = 0
  var calendarGroupUserSelected = false
  var agentOpsLayoutDraftWorkspaceId: RelayId?

  var workspace: Workspace? { appState?.activeWorkspace }
  static let messagePageSize = 50
  static let messageWindowLimit = 250
  static let showRelayCloudAgentsSettingKey = "relayCloud.showAgents"
  static let telemetryChoiceCompletedSettingKey =
    "privacy.telemetryChoiceCompleted.v1"
  var activeShellSection: ShellSectionKey { nav.shellSectionKey }
  var shellSections: [ShellSectionState] { shellNavigation.sections }
  var selectedThread: ThreadSummary? { threads.first { $0.id == selectedThreadId } }
  var selectedThreadAgent: AgentWithBinding? {
    guard let agentId = selectedThread?.selectedAgentId else { return nil }
    return visibleAgents.first { $0.id == agentId }
  }
  var selectedChatAgent: AgentWithBinding? {
    if selectedThread != nil {
      if selectedThread?.threadType == .team {
        return selectedThreadAgent ?? selectedTeamAgents.first
      }
      return selectedThreadAgent
    }
    return usableAgents.first { $0.id == selectedAgentId } ?? usableAgents.first
  }
  var selectedAgent: AgentWithBinding? {
    visibleAgents.first { $0.id == selectedAgentId } ?? visibleAgents.first
  }
  var selectedTeamAgents: [AgentWithBinding] {
    guard selectedThread?.threadType == .team else { return [] }
    guard let participants = selectedThreadDetail?.participants else {
      return selectedThreadAgent.map { [$0] } ?? []
    }
    var seen: Set<RelayId> = []
    return participants.compactMap { participant -> AgentWithBinding? in
      guard participant.participantType == .agent,
        participant.leftAt == nil,
        let agentId = participant.participantId,
        !seen.contains(agentId),
        let agent = agents.first(where: { $0.id == agentId }),
        showRelayCloudAgents || !isRelayCloudAgent(agent),
        agent.status == "active"
      else {
        return nil
      }
      seen.insert(agentId)
      return agent
    }
  }
  var composerMentionSuggestions: [AgentWithBinding] {
    guard selectedThread?.threadType == .team,
      composerMentionAvailability?.isAvailable == true,
      let query = activeComposerMentionQuery
    else {
      return []
    }
    let teamAgents = selectedTeamAgents
    guard !teamAgents.isEmpty else { return [] }
    if query.isEmpty {
      return Array(teamAgents.prefix(6))
    }
    return Array(
      teamAgents.filter { agent in
        mentionSearchText(for: agent).contains(query)
      }.prefix(6))
  }
  var composerMentionedTeamAgents: [AgentWithBinding] {
    guard selectedThread?.threadType == .team else { return [] }
    let tokens = composerMentionTokens(in: composerText)
      .map(normalizeComposerMentionToken)
      .filter { !$0.isEmpty }
    guard !tokens.isEmpty else { return [] }
    for token in tokens {
      if let agent = selectedTeamAgents.first(where: { agent in
        composerMentionCandidates(for: agent).contains(token)
      }) {
        return [agent]
      }
    }
    return []
  }
  var composerMentionTargetSummary: String? {
    let names = composerMentionedTeamAgents.map(resolveAgentDisplayName)
    guard !names.isEmpty else { return nil }
    return names.joined(separator: ", ")
  }
  var chatReadyRecords: [HarnessInstallRecord] {
    records.filter {
      $0.lifecycleState == .connected && $0.modelAuthStatus == .connected && $0.harnessId != nil
    }
  }
  var usableAgents: [AgentWithBinding] {
    let ids = Set(chatReadyRecords.compactMap(\.harnessId))
    return visibleAgents.filter { ids.contains($0.harness.id) && $0.executionAvailable }
  }
  var visibleAgents: [AgentWithBinding] {
    let active = agents.filter { $0.lifecycleStatus == .active }
    return showRelayCloudAgents ? active : active.filter { !isRelayCloudAgent($0) }
  }
  var relayCloudAgentCount: Int {
    agents.lazy.filter(isRelayCloudAgent).count
  }
  var visibleMarketplaceCompatibleAgents: [MarketplaceCompatibleAgentTarget] {
    let targets = exaInstallSnapshot?.compatibleAgents ?? []
    guard !showRelayCloudAgents else { return targets }
    let visibleAgentIds = Set(visibleAgents.map(\.id))
    return targets.filter { visibleAgentIds.contains($0.agentId) }
  }
  var filteredThreads: [ThreadSummary] {
    let query = threadSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    let visibleThreads = threads.filter {
      !isResidentDirectThread($0) && isThreadVisibleForCloudAgentSetting($0)
    }
    guard !query.isEmpty else { return visibleThreads }
    return visibleThreads.filter { thread in
      "\(resolveThreadDisplayTitle(thread)) \(thread.title) \(thread.lastMessageSnippet ?? "")"
        .lowercased().contains(query)
    }
  }

  func isResidentDirectThread(_ thread: ThreadSummary) -> Bool {
    guard thread.threadType == .direct,
      let selectedAgentId = thread.selectedAgentId,
      let agent = agent(withId: selectedAgentId)
    else { return false }
    return isRelayConsoleResidentAgent(agent)
  }

  func isRelayCloudAgent(_ agent: AgentWithBinding) -> Bool {
    agent.source == "railway_sync" || agent.binding.adapterKind == "railway_cloud"
  }

  func isThreadVisibleForCloudAgentSetting(_ thread: ThreadSummary) -> Bool {
    guard !showRelayCloudAgents else { return true }
    let linkedAgents = agentIds(for: thread).compactMap(agent(withId:))
    guard !linkedAgents.isEmpty else { return true }
    return linkedAgents.contains { !isRelayCloudAgent($0) }
  }

  func agent(withId agentId: RelayId) -> AgentWithBinding? {
    if agentsByIdCache == nil {
      var indexedAgents: [RelayId: AgentWithBinding] = [:]
      for agent in agents {
        indexedAgents[agent.id] = agent
      }
      agentsByIdCache = indexedAgents
    }
    return agentsByIdCache?[agentId]
  }

  func agentIds(for thread: ThreadSummary) -> [RelayId] {
    if let cached = threadAgentIdsByThreadId[thread.id], !cached.isEmpty {
      return cached
    }
    return thread.selectedAgentId.map { [$0] } ?? []
  }

  func agents(for thread: ThreadSummary) -> [AgentWithBinding] {
    agentIds(for: thread)
      .compactMap(agent(withId:))
      .filter { showRelayCloudAgents || !isRelayCloudAgent($0) }
  }

  func installedApps(for thread: ThreadSummary) -> [MarketplaceCatalogApp] {
    let agentIds = agentIds(for: thread)
    guard !agentIds.isEmpty else { return [] }

    if conversationInstalledAppsByAgentId == nil {
      let sourceApps =
        applicationsCatalogApps.isEmpty
        ? (applicationsCatalogSnapshot?.apps ?? []) : applicationsCatalogApps
      var appsByAgentId: [RelayId: [MarketplaceCatalogApp]] = [:]
      for app in sourceApps {
        for agentId in Set(app.installedAgentIds) {
          appsByAgentId[agentId, default: []].append(app)
        }
      }
      conversationInstalledAppsByAgentId = appsByAgentId
    }

    var seen: Set<RelayId> = []
    var installed: [MarketplaceCatalogApp] = []
    for agentId in agentIds {
      for app in conversationInstalledAppsByAgentId?[agentId] ?? [] {
        guard seen.insert(app.id).inserted else { continue }
        installed.append(app)
      }
    }
    return installed
  }

  var isViewingWrapUpTranscript: Bool {
    selectedWrapUpReport != nil
  }
  var selectedWrapUpReport: ThreadWrapUpReport? {
    guard let selectedWrapUpReportId else { return nil }
    return selectedThreadDetail?.wrapUpReports.first { $0.id == selectedWrapUpReportId }
  }
  var selectedChatSession: ChatSession? {
    if let report = selectedWrapUpReport, let sessionId = report.sessionId {
      return selectedThreadDetail?.sessions.first { $0.id == sessionId }
    }
    guard let activeSessionId = selectedThreadDetail?.activeSessionId else { return nil }
    return selectedThreadDetail?.sessions.first { $0.id == activeSessionId }
  }
  var selectedTeamRelaySession: ChatSession? {
    guard selectedThread?.threadType == .team, !isViewingWrapUpTranscript else { return nil }
    return selectedChatSession
  }
  var teamRelayAgentReplyCount: Int {
    messages.filter { $0.senderType == .agent }.count
  }
  var currentChatCycleNumber: Int? {
    guard let activeSessionId = selectedThreadDetail?.activeSessionId else {
      return selectedChatSession?.sequenceNumber
    }
    return selectedThreadDetail?.sessions.first { $0.id == activeSessionId }?.sequenceNumber
  }
  var displayedChatCycleNumber: Int? {
    selectedChatSession?.sequenceNumber ?? currentChatCycleNumber
  }
  var sortedWrapUpReports: [ThreadWrapUpReport] {
    selectedThreadDetail?.wrapUpReports.sorted { lhs, rhs in
      let leftSequence =
        lhs.sessionId.flatMap { sessionId in
          selectedThreadDetail?.sessions.first { $0.id == sessionId }?.sequenceNumber
        } ?? 0
      let rightSequence =
        rhs.sessionId.flatMap { sessionId in
          selectedThreadDetail?.sessions.first { $0.id == sessionId }?.sequenceNumber
        } ?? 0
      if leftSequence != rightSequence {
        return leftSequence > rightSequence
      }
      return lhs.createdAt > rhs.createdAt
    } ?? []
  }
  var chatRuntimeContextUsageRows: [ChatRuntimeContextUsageDisplay] {
    guard let selectedThread else { return [] }
    let dispatchById = Dictionary(uniqueKeysWithValues: dispatches.map { ($0.id, $0) })
    var usageByAgentId: [RelayId: ChatRuntimeContextUsageDisplay] = [:]

    for dispatch in dispatches {
      if let usage = runtimeContextUsage(from: dispatch.resultSnapshot?["runtimeContext"]) {
        usageByAgentId[dispatch.agentId] = makeRuntimeContextUsageRow(
          agentId: dispatch.agentId,
          usage: usage,
          updatedAt: dispatch.updatedAt
        )
      }
    }

    for job in runtimeStructuredJobs {
      guard let contextUsage = job.contextUsage else { continue }
      let dispatchId = contextUsage.dispatchId ?? job.dispatchId
      guard let dispatchId, let dispatch = dispatchById[dispatchId] else { continue }
      let existing = usageByAgentId[dispatch.agentId]
      if existing?.updatedAt == nil || (job.updatedAt > (existing?.updatedAt ?? "")) {
        usageByAgentId[dispatch.agentId] = makeRuntimeContextUsageRow(
          agentId: dispatch.agentId,
          usage: contextUsage,
          updatedAt: job.updatedAt
        )
      }
    }

    var agentIds = Set<RelayId>()
    if let selectedAgentId = selectedThread.selectedAgentId {
      agentIds.insert(selectedAgentId)
    }
    for participant in selectedThreadDetail?.participants ?? [] {
      if participant.participantType == .agent,
        participant.leftAt == nil,
        let participantId = participant.participantId,
        agents.contains(where: { $0.id == participantId })
      {
        agentIds.insert(participantId)
      }
    }
    for message in messages where message.senderType == .agent {
      if let senderId = message.senderId {
        agentIds.insert(senderId)
      }
    }
    for agentId in usageByAgentId.keys {
      agentIds.insert(agentId)
    }

    return agentIds.map { agentId in
      usageByAgentId[agentId]
        ?? makeRuntimeContextUsageRow(agentId: agentId, usage: nil, updatedAt: nil)
    }
    .sorted { lhs, rhs in
      let percentDelta = (rhs.percentUsed ?? -1) - (lhs.percentUsed ?? -1)
      if percentDelta != 0 { return percentDelta > 0 }
      if let leftUpdated = lhs.updatedAt, let rightUpdated = rhs.updatedAt,
        leftUpdated != rightUpdated
      {
        return leftUpdated > rightUpdated
      }
      return lhs.agentName < rhs.agentName
    }
  }
  var agentOpsSelectedIds: [RelayId] {
    agentOpsSnapshot?.selectedAgentIds ?? agents.map(\.id)
  }
  var filteredAgentOpsStates: [AgentOpsLiveAgentState] {
    let rows = agentOpsSnapshot?.agents ?? []
    let query = agentOpsSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !query.isEmpty else { return rows }
    return rows.filter { state in
      [
        resolveAgentDisplayName(agentId: state.agentId, fallback: state.agentName),
        state.agentName,
        state.realState.rawValue,
        state.visibleState.rawValue,
        state.source.rawValue,
        state.departmentName ?? "",
        state.teamName ?? "",
        state.roomId ?? "",
      ].joined(separator: " ").lowercased().contains(query)
    }
  }
  var selectedAgentOpsState: AgentOpsLiveAgentState? {
    let rows = agentOpsSnapshot?.agents ?? []
    guard !selectedAgentOpsAgentId.isEmpty else { return nil }
    return rows.first { $0.agentId == selectedAgentOpsAgentId }
  }
  var filteredAgentOpsSceneEntities: [AgentOpsVisualEntity] {
    let rows = agentOpsSceneSnapshot?.entities ?? []
    let query = agentOpsSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    guard !query.isEmpty else { return rows }
    return rows.filter { entity in
      [
        resolveAgentDisplayName(agentId: entity.agentId, fallback: entity.title),
        entity.title,
        entity.subtitle,
        entity.state.rawValue,
        entity.source.rawValue,
        entity.roomId ?? "",
        entity.sourceRecordIds.joined(separator: " "),
      ].joined(separator: " ").lowercased().contains(query)
    }
  }
  var selectedAgentOpsEntity: AgentOpsVisualEntity? {
    let rows = agentOpsSceneSnapshot?.entities ?? []
    return rows.first { $0.id == selectedAgentOpsSceneEntityId } ?? rows.first
  }
  var selectedAgentOpsRoom: AgentOpsVisualRoom? {
    let rooms = agentOpsSceneSnapshot?.rooms ?? []
    if let roomId = selectedAgentOpsEntity?.roomId {
      return rooms.first { $0.id == roomId }
    }
    let selectedRoomId = selectedAgentOpsSceneEntityId.replacingOccurrences(of: "room-", with: "")
    return rooms.first { $0.id == selectedRoomId } ?? rooms.first
  }
  var selectedAgentOpsPathLabel: String? {
    guard let selection = agentOpsLayoutSelectedPathItem else { return nil }
    switch selection {
    case .waypoint(let id):
      guard let waypoint = agentOpsLayoutPathWaypoints.first(where: { $0.id == id }) else {
        return nil
      }
      let tags = waypoint.tags.map(\.title).sorted().joined(separator: ", ")
      return "\(id) at \(Int(waypoint.position.x)), \(Int(waypoint.position.y)) · \(tags)"
    case .edge(let id):
      guard let edge = agentOpsLayoutPathEdges.first(where: { $0.id == id }) else { return nil }
      let tags = edge.tags.map(\.title).sorted().joined(separator: ", ")
      return "\(edge.from) to \(edge.to) · \(tags)"
    }
  }
  var selectedAgentOpsAnchorLabel: String? {
    guard let anchor = agentOpsLayoutSelectedAnchor else { return nil }
    return "\(anchor.group.title) \(anchor.index + 1) in \(anchor.roomId)"
  }
  var agentOpsLayoutExportJSON: String {
    let workspaceId = workspace?.id ?? agentOpsSceneSnapshot?.workspaceId ?? "workspace-unavailable"
    let floorId = agentOpsSceneSnapshot?.activeFloorId ?? "floor_01_operations"
    let export = AgentOpsLayoutExport(
      workspaceId: workspaceId,
      floorId: floorId,
      layoutPersistenceStatus: agentOpsSceneSnapshot?.layoutPersistenceStatus
        ?? "local_agentops_layout_draft",
      pathNetwork: AgentOpsLayoutPathNetworkExport(
        waypoints: agentOpsLayoutPathWaypoints,
        edges: agentOpsLayoutPathEdges
      ),
      roomAnchorOverrides: currentAgentOpsRoomAnchorDrafts()
    )
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    guard let data = try? encoder.encode(export),
      let text = String(data: data, encoding: .utf8)
    else {
      return "{}"
    }
    return text
  }
  var selectedMarketplaceApp: MarketplaceCatalogApp? {
    applicationsCatalogSnapshot?.selectedApp
  }
  var selectedProviderConnection: MarketplaceProviderConnection? {
    providerConnectionSnapshot?.selectedConnection
  }
  func marketplaceActionPolicyPreset(for install: MarketplaceInstallRecord?)
    -> MarketplaceActionPolicyPreset?
  {
    guard let install else { return nil }
    if let map = marketplaceActionPermissionMapsByInstallId[install.id] {
      return map.policyPreset
    }
    if install.approvalProfileId == "dangerously_skip_permissions" {
      return .allowDirectWrites
    }
    if let rawPreset = install.metadata["providerActionPolicyPreset"]?.string {
      return MarketplaceActionPolicyPreset(rawValue: rawPreset)
    }
    return nil
  }
  func marketplaceActionPolicyPresets(for app: MarketplaceCatalogApp)
    -> [MarketplaceActionPolicyPreset]
  {
    _ = app
    return [.approvalRequired, .allowDirectWrites, .readOnly, .blocked]
  }
  var selectedInsightsRow: InsightsReportRow? {
    insightsReportList?.rows.first { $0.id == insightsSelectedReportId }
      ?? insightsReportList?.rows.first
  }
  var filteredProviderApprovalCards: [ProviderActionApprovalCardState] {
    let query = approvalSearch.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return (providerApprovalInbox?.cards ?? []).filter { card in
      approvalStatusFilter.includes(card.status)
        && (query.isEmpty
          || [
            card.title,
            card.subtitle,
            card.appName,
            card.appSlug,
            card.actionLabel,
            card.statusLabel,
            card.payloadSummary,
          ].joined(separator: " ").lowercased().contains(query))
    }
  }
  var selectedProviderApprovalCard: ProviderActionApprovalCardState? {
    let filtered = filteredProviderApprovalCards
    return filtered.first { $0.approvalId == selectedProviderApprovalId }
      ?? providerApprovalInbox?.selectedCard
      ?? filtered.first
  }

  init(userDataPath: URL? = nil) {
    self.agentDisplayNames = Self.readMap("relay-console.agent-display-names")
    self.agentAvatarUrls = Self.readMap("relay-console.agent-avatar-urls")
    self.userProfile = Self.readProfile()
    self.selectedCalendarGroup = Self.readCalendarGroup()
    self.selectedCalendarSortMode = Self.readCalendarSortMode()
    self.dismissedCronDeliveryErrorKeys = Self.readStringSet(
      "relay-console.cron.dismissed-delivery-errors")
    do {
      let services = try RelayConsoleServices(userDataPath: userDataPath)
      self.services = services
      let telemetryChoiceCompleted =
        (try? services.data.getAppSetting(
          Self.telemetryChoiceCompletedSettingKey,
          fallback: false
        )) ?? false
      self.telemetryChoiceRequired = !telemetryChoiceCompleted
      self.runtimeActivityDetailEnabled =
        (try? services.data.getAppSetting(
          RuntimeExperienceSettings.detailedActivityEnabledKey,
          fallback: RuntimeExperienceSettings.defaultDetailedActivityEnabled
        )) ?? RuntimeExperienceSettings.defaultDetailedActivityEnabled
      self.runtimeRunConfirmationEnabled =
        (try? services.data.getAppSetting(
          RuntimeExperienceSettings.runConfirmationEnabledKey,
          fallback: RuntimeExperienceSettings.defaultRunConfirmationEnabled
        )) ?? RuntimeExperienceSettings.defaultRunConfirmationEnabled
      self.runtimeApprovalMode =
        (try? services.data.getAppSetting(
          RuntimeExperienceSettings.approvalModeKey,
          fallback: RuntimeApprovalMode.fromLegacyRunConfirmation(
            self.runtimeRunConfirmationEnabled)
        )) ?? RuntimeApprovalMode.fromLegacyRunConfirmation(self.runtimeRunConfirmationEnabled)
      self.runtimeRunConfirmationEnabled = self.runtimeApprovalMode.requiresRunConfirmation
      self.showRelayCloudAgents =
        (try? services.data.getAppSetting(
          Self.showRelayCloudAgentsSettingKey,
          fallback: true
        )) ?? true
      if let savedPanel = try? services.data.getSelectedSettingsPanel(),
        let panel = SettingsPanelKey(rawValue: savedPanel)
      {
        if panel.isVisibleInFirstLaunch {
          self.settingsPanel = panel
        } else {
          self.settingsPanel = .account
          try? services.data.setSelectedSettingsPanel(SettingsPanelKey.account.rawValue)
        }
      }
      if let state = try? services.data.getAppState(),
        let workspace = state.activeWorkspace,
        let persisted = try? services.insights.viewState(
          context: ServiceRequestContext(
            actorId: state.activeProfile?.id ?? "local-profile",
            workspaceId: workspace.id,
            roles: [.owner],
            correlationId: "insights-view-state-load"
          )
        )
      {
        applyInsightsViewState(persisted)
      }
      registerEvents()
      startAgentTaskScheduler()
      Task {
        await refresh()
        await resolveRelayAccessBeforePresentingGate()
        startAutomaticCloudLinkRecovery()
      }
    } catch {
      self.services = nil
      self.error = error.localizedDescription
      self.loading = false
      self.relayLaunchAccessCheckInProgress = false
    }
  }

}

extension String {
  var nilIfEmpty: String? {
    let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
    return trimmed.isEmpty ? nil : trimmed
  }

  var nilJSON: JSONValue {
    nilIfEmpty.map(JSONValue.string) ?? .null
  }

  var normalizedAvatarURL: String {
    hasPrefix("/avatars/") ? String(dropFirst()) : self
  }

  var agentAvatarState: AgentAvatarState {
    hasPrefix("avatars/") ? .illustrated : .uploaded
  }
}
