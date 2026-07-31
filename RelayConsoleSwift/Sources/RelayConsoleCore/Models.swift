import Foundation

public typealias RelayId = String
public typealias IsoTimestamp = String
public typealias JSONRecord = [String: JSONValue]

public enum JSONValue: Codable, Equatable, Hashable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            self = .object(try container.decode([String: JSONValue].self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }

    public var string: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    public var bool: Bool? {
        if case .bool(let value) = self { return value }
        return nil
    }

    public var number: Double? {
        if case .number(let value) = self { return value }
        return nil
    }
}

public enum RuntimeType: String, Codable, CaseIterable, Sendable {
    case relayEcho = "relay_echo"
    case hermes
    case openclaw
    case claudeCode = "claude_code"
    case codexCli = "codex_cli"
}

public enum RelayProductMode: String, Codable, CaseIterable, Sendable {
    case local
    case connect
    case cloud
}

public enum AgentLifecycleStatus: String, Codable, CaseIterable, Sendable {
    case active
    case retired
    case quarantined
    case deleted
}

public enum HarnessMode: String, Codable, Sendable {
    case builtinTest = "builtin_test"
    case userManaged = "user_managed"
    case appManaged = "app_managed"
    case bridgePluginCompat = "bridge_plugin_compat"
}

public enum HarnessHealthStatus: String, Codable, Sendable {
    case unknown
    case healthy
    case degraded
    case unhealthy
    case missing
    case authRequired = "auth_required"
}

public enum HarnessKey: String, Codable, CaseIterable, Sendable {
    case hermes
    case openclaw
}

public enum HarnessInstallSource: String, Codable, Sendable {
    case managed
    case located
    case missing
}

public enum HarnessModelAuthStatus: String, Codable, Sendable {
    case unknown
    case notConfigured = "not_configured"
    case checking
    case connected
    case failed
}

public enum HarnessLifecycleState: String, Codable, Sendable {
    case notInstalled = "not_installed"
    case installing
    case installed
    case starting
    case connected
    case authRequired = "auth_required"
    case chatNotWired = "chat_not_wired"
    case error
}

public enum SenderType: String, Codable, Sendable {
    case user
    case agent
    case system
}

public enum MessageFormat: String, Codable, Sendable {
    case plain
    case markdown
}

public enum DispatchStatus: String, Codable, Sendable {
    case queued
    case started
    case streaming
    case completed
    case failed
    case cancelled
}

public enum RuntimeEventType: String, Codable, Sendable {
    case queued
    case started
    case status
    case delta
    case thinking
    case tool
    case context
    case completed
    case failed
    case cancelled
    case healthChanged = "health_changed"
}

public enum ThreadType: String, Codable, CaseIterable, Sendable {
    case direct
    case team
    case department
    case companyMeeting = "company_meeting"
    case agentToAgent = "agent_to_agent"
    case groupAgent = "group_agent"
    case system
    case approval
    case incident
    case report
    case unknown
}

public enum ThreadReadStateValue: String, Codable, CaseIterable, Sendable {
    case read
    case unread
}

public enum ThreadSessionStatus: String, Codable, CaseIterable, Sendable {
    case active
    case wrapped
    case archived
    case closed
}

public enum TeamRelayRunState: String, Codable, CaseIterable, Sendable {
    case running
    case paused
}

public enum TeamRelayPauseReason: String, Codable, CaseIterable, Sendable {
    case manual
    case replyLimit = "reply_limit"
}

public enum TeamRelayReplyLimits {
    public static let defaultLimit = 50
    public static let presets = [25, 50, 100, 200, 400, 800, 1500, 3000, 5000, 10000]

    public static func normalized(_ value: Int) -> Int {
        min(max(value, 1), 100_000)
    }

    public static func nextLimit(after value: Int) -> Int {
        let normalizedValue = normalized(value)
        if let preset = presets.first(where: { $0 > normalizedValue }) {
            return preset
        }
        return normalized(normalizedValue * 2)
    }
}

public enum ThreadParticipantType: String, Codable, CaseIterable, Sendable {
    case user
    case agent
    case team
    case system
}

public enum ThreadParticipantRole: String, Codable, CaseIterable, Sendable {
    case owner
    case manager
    case member
    case viewer
}

public enum ThreadWrapUpStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case generating
    case completed
    case failed
    case unavailable
}

public enum LocalSendState: String, Codable, CaseIterable, Sendable {
    case pending
    case failed
    case dispatched
}

public enum ChatAttachmentKind: String, Codable, CaseIterable, Sendable {
    case image
    case audio
    case video
    case document
    case file
}

public enum ChatAttachmentStatus: String, Codable, CaseIterable, Sendable {
    case staged
    case importing
    case uploaded
    case failed
    case cancelled
}

public enum ChatDocumentReferenceKind: String, Codable, CaseIterable, Sendable {
    case document
    case image
    case code
    case transcript
    case unknown
}

public struct LocalProfile: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var displayName: String
    public var email: String?
    public var avatarUrl: String?
    public var telemetryEnabled: Bool
    public var crashReportingEnabled: Bool
    public var theme: String
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp

    public init(
        id: RelayId,
        displayName: String,
        email: String? = nil,
        avatarUrl: String? = nil,
        telemetryEnabled: Bool = false,
        crashReportingEnabled: Bool = false,
        theme: String = "classic",
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp
    ) {
        self.id = id
        self.displayName = displayName
        self.email = email
        self.avatarUrl = avatarUrl
        self.telemetryEnabled = telemetryEnabled
        self.crashReportingEnabled = crashReportingEnabled
        self.theme = theme
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case displayName
        case email
        case avatarUrl
        case telemetryEnabled
        case crashReportingEnabled
        case theme
        case createdAt
        case updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(RelayId.self, forKey: .id)
        self.displayName = try container.decode(String.self, forKey: .displayName)
        self.email = try container.decodeIfPresent(String.self, forKey: .email)
        self.avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
        self.telemetryEnabled = try container.decodeIfPresent(Bool.self, forKey: .telemetryEnabled) ?? false
        self.crashReportingEnabled = try container.decodeIfPresent(Bool.self, forKey: .crashReportingEnabled) ?? false
        self.theme = try container.decodeIfPresent(String.self, forKey: .theme) ?? "classic"
        self.createdAt = try container.decode(IsoTimestamp.self, forKey: .createdAt)
        self.updatedAt = try container.decode(IsoTimestamp.self, forKey: .updatedAt)
    }
}

public struct Workspace: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var profileId: RelayId
    public var name: String
    public var defaultFolderPath: String?
    public var workspaceType: String
    public var settings: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp

    public init(
        id: RelayId,
        profileId: RelayId,
        name: String,
        defaultFolderPath: String?,
        workspaceType: String = "personal",
        settings: JSONRecord = [:],
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp
    ) {
        self.id = id
        self.profileId = profileId
        self.name = name
        self.defaultFolderPath = defaultFolderPath
        self.workspaceType = workspaceType
        self.settings = settings
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case profileId
        case name
        case defaultFolderPath
        case workspaceType
        case settings
        case createdAt
        case updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(RelayId.self, forKey: .id)
        self.profileId = try container.decode(RelayId.self, forKey: .profileId)
        self.name = try container.decode(String.self, forKey: .name)
        self.defaultFolderPath = try container.decodeIfPresent(String.self, forKey: .defaultFolderPath)
        self.workspaceType = try container.decodeIfPresent(String.self, forKey: .workspaceType) ?? "personal"
        self.settings = try container.decodeIfPresent(JSONRecord.self, forKey: .settings) ?? [:]
        self.createdAt = try container.decode(IsoTimestamp.self, forKey: .createdAt)
        self.updatedAt = try container.decode(IsoTimestamp.self, forKey: .updatedAt)
    }
}

public enum SettingsAlertSeverity: String, Codable, CaseIterable, Sendable {
    case info
    case success
    case warning
    case critical
}

public struct SettingsAlertRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var title: String
    public var message: String
    public var severity: SettingsAlertSeverity
    public var category: String
    public var sourceKind: String
    public var sourceId: RelayId?
    public var actionLabel: String?
    public var actionTarget: String?
    public var expiresAt: IsoTimestamp?
    public var readAt: IsoTimestamp?
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        title: String,
        message: String,
        severity: SettingsAlertSeverity,
        category: String,
        sourceKind: String,
        sourceId: RelayId?,
        actionLabel: String?,
        actionTarget: String?,
        expiresAt: IsoTimestamp?,
        readAt: IsoTimestamp?,
        metadata: JSONRecord,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.title = title
        self.message = message
        self.severity = severity
        self.category = category
        self.sourceKind = sourceKind
        self.sourceId = sourceId
        self.actionLabel = actionLabel
        self.actionTarget = actionTarget
        self.expiresAt = expiresAt
        self.readAt = readAt
        self.metadata = metadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public enum NotificationDeliveryState: String, Codable, CaseIterable, Sendable {
    case unavailable
    case hidden
}

public struct SettingsNotificationPreferences: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var profileId: RelayId?
    public var inAppAlertsEnabled: Bool
    public var unreadBadgeEnabled: Bool
    public var emailDeliveryState: NotificationDeliveryState
    public var mobileDeliveryState: NotificationDeliveryState
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        profileId: RelayId?,
        inAppAlertsEnabled: Bool,
        unreadBadgeEnabled: Bool,
        emailDeliveryState: NotificationDeliveryState,
        mobileDeliveryState: NotificationDeliveryState,
        metadata: JSONRecord,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.profileId = profileId
        self.inAppAlertsEnabled = inAppAlertsEnabled
        self.unreadBadgeEnabled = unreadBadgeEnabled
        self.emailDeliveryState = emailDeliveryState
        self.mobileDeliveryState = mobileDeliveryState
        self.metadata = metadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct SettingsHarnessSummary: Codable, Equatable, Sendable {
    public var harnessId: RelayId?
    public var harnessKey: HarnessKey
    public var displayName: String
    public var lifecycleState: HarnessLifecycleState
    public var modelAuthStatus: HarnessModelAuthStatus
    public var source: HarnessInstallSource
    public var healthStatus: HarnessHealthStatus?
    public var secretReferencePresent: Bool
    public var lastError: String?

    public init(
        harnessId: RelayId?,
        harnessKey: HarnessKey,
        displayName: String,
        lifecycleState: HarnessLifecycleState,
        modelAuthStatus: HarnessModelAuthStatus,
        source: HarnessInstallSource,
        healthStatus: HarnessHealthStatus?,
        secretReferencePresent: Bool,
        lastError: String?
    ) {
        self.harnessId = harnessId
        self.harnessKey = harnessKey
        self.displayName = displayName
        self.lifecycleState = lifecycleState
        self.modelAuthStatus = modelAuthStatus
        self.source = source
        self.healthStatus = healthStatus
        self.secretReferencePresent = secretReferencePresent
        self.lastError = lastError
    }
}

public struct SettingsIntegrationSummary: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var refreshedAt: IsoTimestamp
    public var harnesses: [SettingsHarnessSummary]
    public var providerState: ProviderConnectionSnapshotState?
    public var providerConnectionCount: Int
    public var providerSecretReferenceCount: Int
    public var marketplaceState: MarketplaceInstallSnapshotState?
    public var marketplaceInstallCount: Int
    public var neededToolsOpenCount: Int
    public var adminSetupAvailable: Bool
    public var readOnly: Bool
    public var paperclipState: String
    public var redactionStatus: String

    public init(
        workspaceId: RelayId,
        refreshedAt: IsoTimestamp,
        harnesses: [SettingsHarnessSummary],
        providerState: ProviderConnectionSnapshotState?,
        providerConnectionCount: Int,
        providerSecretReferenceCount: Int,
        marketplaceState: MarketplaceInstallSnapshotState?,
        marketplaceInstallCount: Int,
        neededToolsOpenCount: Int,
        adminSetupAvailable: Bool,
        readOnly: Bool,
        paperclipState: String,
        redactionStatus: String
    ) {
        self.workspaceId = workspaceId
        self.refreshedAt = refreshedAt
        self.harnesses = harnesses
        self.providerState = providerState
        self.providerConnectionCount = providerConnectionCount
        self.providerSecretReferenceCount = providerSecretReferenceCount
        self.marketplaceState = marketplaceState
        self.marketplaceInstallCount = marketplaceInstallCount
        self.neededToolsOpenCount = neededToolsOpenCount
        self.adminSetupAvailable = adminSetupAvailable
        self.readOnly = readOnly
        self.paperclipState = paperclipState
        self.redactionStatus = redactionStatus
    }
}

public enum SettingsDispositionState: String, Codable, CaseIterable, Sendable {
    case available
    case hidden
    case unavailable
    case decisionGated = "decision_gated"
    case blocked
    case approved
    case externalLink = "external_link"
}

public struct SettingsDecisionGateDisposition: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var decisionId: String
    public var surface: String
    public var state: SettingsDispositionState
    public var reasonCode: GuardReasonCode
    public var currentUiState: String
    public var missingPrerequisites: String
    public var activationRequirement: String
    public var releaseImpact: String
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        decisionId: String,
        surface: String,
        state: SettingsDispositionState,
        reasonCode: GuardReasonCode,
        currentUiState: String,
        missingPrerequisites: String,
        activationRequirement: String,
        releaseImpact: String,
        metadata: JSONRecord,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.decisionId = decisionId
        self.surface = surface
        self.state = state
        self.reasonCode = reasonCode
        self.currentUiState = currentUiState
        self.missingPrerequisites = missingPrerequisites
        self.activationRequirement = activationRequirement
        self.releaseImpact = releaseImpact
        self.metadata = metadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct SettingsSecurityActionDisposition: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var title: String
    public var detail: String
    public var state: SettingsDispositionState
    public var reasonCode: GuardReasonCode
    public var decisionId: String?
    public var enabled: Bool
    public var auditRequired: Bool
    public var destructive: Bool
    public var redactionStatus: String

    public init(
        id: RelayId,
        title: String,
        detail: String,
        state: SettingsDispositionState,
        reasonCode: GuardReasonCode,
        decisionId: String?,
        enabled: Bool,
        auditRequired: Bool,
        destructive: Bool,
        redactionStatus: String
    ) {
        self.id = id
        self.title = title
        self.detail = detail
        self.state = state
        self.reasonCode = reasonCode
        self.decisionId = decisionId
        self.enabled = enabled
        self.auditRequired = auditRequired
        self.destructive = destructive
        self.redactionStatus = redactionStatus
    }
}

public struct SettingsLocalAccountExportRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var profileId: RelayId?
    public var status: String
    public var fileName: String
    public var recordCount: Int
    public var includesSecrets: Bool
    public var exportMetadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        profileId: RelayId?,
        status: String,
        fileName: String,
        recordCount: Int,
        includesSecrets: Bool,
        exportMetadata: JSONRecord,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.profileId = profileId
        self.status = status
        self.fileName = fileName
        self.recordCount = recordCount
        self.includesSecrets = includesSecrets
        self.exportMetadata = exportMetadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct SettingsSecuritySummary: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var profileId: RelayId?
    public var mode: String
    public var generatedAt: IsoTimestamp
    public var decisionDispositions: [SettingsDecisionGateDisposition]
    public var actionDispositions: [SettingsSecurityActionDisposition]
    public var latestExport: SettingsLocalAccountExportRecord?
    public var supportEvidenceState: SettingsDispositionState
    public var cloudAccountState: SettingsDispositionState
    public var destructiveLifecycleState: SettingsDispositionState
    public var redactionStatus: String

    public init(
        workspaceId: RelayId,
        profileId: RelayId?,
        mode: String,
        generatedAt: IsoTimestamp,
        decisionDispositions: [SettingsDecisionGateDisposition],
        actionDispositions: [SettingsSecurityActionDisposition],
        latestExport: SettingsLocalAccountExportRecord?,
        supportEvidenceState: SettingsDispositionState,
        cloudAccountState: SettingsDispositionState,
        destructiveLifecycleState: SettingsDispositionState,
        redactionStatus: String
    ) {
        self.workspaceId = workspaceId
        self.profileId = profileId
        self.mode = mode
        self.generatedAt = generatedAt
        self.decisionDispositions = decisionDispositions
        self.actionDispositions = actionDispositions
        self.latestExport = latestExport
        self.supportEvidenceState = supportEvidenceState
        self.cloudAccountState = cloudAccountState
        self.destructiveLifecycleState = destructiveLifecycleState
        self.redactionStatus = redactionStatus
    }
}

public struct LocalProfilePreferenceSnapshot: Codable, Equatable, Sendable {
    public var displayName: String?
    public var email: String?
    public var avatarUrl: String?
    public var telemetryEnabled: Bool?
    public var crashReportingEnabled: Bool?
    public var theme: String?

    public init(
        displayName: String? = nil,
        email: String? = nil,
        avatarUrl: String? = nil,
        telemetryEnabled: Bool? = nil,
        crashReportingEnabled: Bool? = nil,
        theme: String? = nil
    ) {
        self.displayName = displayName
        self.email = email
        self.avatarUrl = avatarUrl
        self.telemetryEnabled = telemetryEnabled
        self.crashReportingEnabled = crashReportingEnabled
        self.theme = theme
    }
}

public struct Harness: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var runtimeType: RuntimeType
    public var displayName: String
    public var mode: HarnessMode
    public var config: JSONRecord
    public var secretReferenceId: RelayId?
    public var status: String
    public var builtIn: Bool
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct HarnessHealth: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId { harnessId }
    public var harnessId: RelayId
    public var runtimeType: RuntimeType
    public var status: HarnessHealthStatus
    public var message: String
    public var version: String?
    public var capabilities: [String]
    public var checkedAt: IsoTimestamp
    public var detail: JSONRecord

    public init(
        harnessId: RelayId,
        runtimeType: RuntimeType,
        status: HarnessHealthStatus,
        message: String,
        version: String? = nil,
        capabilities: [String] = [],
        checkedAt: IsoTimestamp,
        detail: JSONRecord = [:]
    ) {
        self.harnessId = harnessId
        self.runtimeType = runtimeType
        self.status = status
        self.message = message
        self.version = version
        self.capabilities = capabilities
        self.checkedAt = checkedAt
        self.detail = detail
    }
}

public struct HarnessCommandSpec: Codable, Equatable, Sendable {
    public var command: String
    public var args: [String]
    public var cwd: String?
}

public struct HarnessModelAuthSession: Codable, Equatable, Sendable {
    public var provider: String
    public var status: String
    public var message: String
    public var userCode: String?
    public var verificationUrl: String?
    public var startedAt: IsoTimestamp
    public var expiresAt: IsoTimestamp?
}

public struct HarnessInstallRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: HarnessKey { harnessKey }
    public var harnessKey: HarnessKey
    public var runtimeType: RuntimeType
    public var displayName: String
    public var officialRepoSlug: String
    public var repoUrl: String
    public var source: HarnessInstallSource
    public var lifecycleState: HarnessLifecycleState
    public var installPath: String?
    public var selectedLocalPath: String?
    public var installedCommit: String?
    public var installedVersion: String?
    public var targetVersion: String?
    public var targetCommit: String?
    public var updateAvailable: Bool
    public var rollbackVersion: String?
    public var rollbackAvailable: Bool
    public var dependencyStatus: String
    public var modelAuthStatus: HarnessModelAuthStatus
    public var modelAuthProvider: String?
    public var modelAuthCommand: HarnessCommandSpec?
    public var modelAuthSession: HarnessModelAuthSession?
    public var modelAuthLastError: String?
    public var modelAuthCheckedAt: IsoTimestamp?
    public var runtimeCommand: HarnessCommandSpec?
    public var healthCheckCommand: HarnessCommandSpec?
    public var health: HarnessHealth?
    public var lastError: String?
    public var lastTechnicalError: String?
    public var lastCheckedAt: IsoTimestamp?
    public var setupNotes: [String]
    public var harnessId: RelayId?
    public var openClawHome: String?
    public var openClawStateDir: String?
    public var openClawConfigPath: String?
    public var openClawNodePath: String?
    public var openClawPnpmPath: String?
    public var openClawInstallLogPath: String?
}

public struct HarnessActionResult: Codable, Equatable, Sendable {
    public var record: HarnessInstallRecord
    public var harness: Harness?
    public var health: HarnessHealth?
    public var output: String?
}

public struct HarnessInstallProgressEvent: Codable, Equatable, Sendable {
    public var harnessKey: HarnessKey
    public var stage: String
    public var message: String
    public var status: String
    public var checkedAt: IsoTimestamp
    public var detail: JSONRecord
}

public struct RuntimeCapabilities: Codable, Equatable, Sendable {
    public var runtimeType: RuntimeType
    public var supportsStreaming: Bool
    public var supportsCancellation: Bool
    public var supportsSessions: Bool
    public var supportsTools: Bool
    public var requiresWorkspaceFolder: Bool
    public var requiresSecret: Bool
    public var maxConcurrentDispatches: Int
    public var eventTypes: [RuntimeEventType]

    public init(
        runtimeType: RuntimeType,
        supportsStreaming: Bool,
        supportsCancellation: Bool,
        supportsSessions: Bool,
        supportsTools: Bool,
        requiresWorkspaceFolder: Bool,
        requiresSecret: Bool,
        maxConcurrentDispatches: Int,
        eventTypes: [RuntimeEventType]
    ) {
        self.runtimeType = runtimeType
        self.supportsStreaming = supportsStreaming
        self.supportsCancellation = supportsCancellation
        self.supportsSessions = supportsSessions
        self.supportsTools = supportsTools
        self.requiresWorkspaceFolder = requiresWorkspaceFolder
        self.requiresSecret = requiresSecret
        self.maxConcurrentDispatches = maxConcurrentDispatches
        self.eventTypes = eventTypes
    }
}

public enum AgentGroupType: String, Codable, CaseIterable, Sendable {
    case personal
    case family
    case business
    case unassigned
}

public enum AgentResponsePresentation: String, Codable, CaseIterable, Sendable {
    case markdown
    case plainText = "plain_text"
}

public enum AgentProvisioningStatus: String, Codable, CaseIterable, Sendable {
    case queued
    case running
    case completed
    case failed
    case cancelled
    case authRequired = "auth_required"
    case missingHarness = "missing_harness"
    case duplicateId = "duplicate_id"
}

public enum AgentAvatarState: String, Codable, CaseIterable, Sendable {
    case fallback
    case illustrated
    case uploaded
    case noAvatar = "no_avatar"
}

public struct Agent: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var name: String
    public var description: String?
    public var status: String
    public var role: String?
    public var source: String?
    public var externalId: String?
    public var lifecycleStatus: AgentLifecycleStatus
    public var lifecycleReason: String?
    public var retiredAt: IsoTimestamp?
    public var groupType: AgentGroupType?
    public var familyLabel: String?
    public var companyId: RelayId?
    public var departmentId: RelayId?
    public var teamId: RelayId?
    public var managerAgentId: RelayId?
    public var classification: String?
    public var model: String?
    public var responsePresentation: AgentResponsePresentation?
    public var provisioningStatus: AgentProvisioningStatus?
    public var currentTaskId: RelayId?
    public var metrics: JSONRecord
    public var budget: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp

    public init(
        id: RelayId,
        workspaceId: RelayId,
        name: String,
        description: String?,
        status: String,
        role: String? = nil,
        source: String? = nil,
        externalId: String? = nil,
        lifecycleStatus: AgentLifecycleStatus = .active,
        lifecycleReason: String? = nil,
        retiredAt: IsoTimestamp? = nil,
        groupType: AgentGroupType? = nil,
        familyLabel: String? = nil,
        companyId: RelayId? = nil,
        departmentId: RelayId? = nil,
        teamId: RelayId? = nil,
        managerAgentId: RelayId? = nil,
        classification: String? = nil,
        model: String? = nil,
        responsePresentation: AgentResponsePresentation? = nil,
        provisioningStatus: AgentProvisioningStatus? = nil,
        currentTaskId: RelayId? = nil,
        metrics: JSONRecord = [:],
        budget: JSONRecord = [:],
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.name = name
        self.description = description
        self.status = status
        self.role = role
        self.source = source
        self.externalId = externalId
        self.lifecycleStatus = lifecycleStatus
        self.lifecycleReason = lifecycleReason
        self.retiredAt = retiredAt
        self.groupType = groupType
        self.familyLabel = familyLabel
        self.companyId = companyId
        self.departmentId = departmentId
        self.teamId = teamId
        self.managerAgentId = managerAgentId
        self.classification = classification
        self.model = model
        self.responsePresentation = responsePresentation
        self.provisioningStatus = provisioningStatus
        self.currentTaskId = currentTaskId
        self.metrics = metrics
        self.budget = budget
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case workspaceId
        case name
        case description
        case status
        case role
        case source
        case externalId
        case lifecycleStatus
        case lifecycleReason
        case retiredAt
        case groupType
        case familyLabel
        case companyId
        case departmentId
        case teamId
        case managerAgentId
        case classification
        case model
        case responsePresentation
        case provisioningStatus
        case currentTaskId
        case metrics
        case budget
        case createdAt
        case updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(RelayId.self, forKey: .id)
        self.workspaceId = try container.decode(RelayId.self, forKey: .workspaceId)
        self.name = try container.decode(String.self, forKey: .name)
        self.description = try container.decodeIfPresent(String.self, forKey: .description)
        self.status = try container.decode(String.self, forKey: .status)
        self.role = try container.decodeIfPresent(String.self, forKey: .role)
        self.source = try container.decodeIfPresent(String.self, forKey: .source)
        self.externalId = try container.decodeIfPresent(String.self, forKey: .externalId)
        self.lifecycleStatus = try container.decodeIfPresent(AgentLifecycleStatus.self, forKey: .lifecycleStatus) ?? .active
        self.lifecycleReason = try container.decodeIfPresent(String.self, forKey: .lifecycleReason)
        self.retiredAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .retiredAt)
        self.groupType = try container.decodeIfPresent(AgentGroupType.self, forKey: .groupType)
        self.familyLabel = try container.decodeIfPresent(String.self, forKey: .familyLabel)
        self.companyId = try container.decodeIfPresent(RelayId.self, forKey: .companyId)
        self.departmentId = try container.decodeIfPresent(RelayId.self, forKey: .departmentId)
        self.teamId = try container.decodeIfPresent(RelayId.self, forKey: .teamId)
        self.managerAgentId = try container.decodeIfPresent(RelayId.self, forKey: .managerAgentId)
        self.classification = try container.decodeIfPresent(String.self, forKey: .classification)
        self.model = try container.decodeIfPresent(String.self, forKey: .model)
        self.responsePresentation = try? container.decodeIfPresent(AgentResponsePresentation.self, forKey: .responsePresentation)
        self.provisioningStatus = try container.decodeIfPresent(AgentProvisioningStatus.self, forKey: .provisioningStatus)
        self.currentTaskId = try container.decodeIfPresent(RelayId.self, forKey: .currentTaskId)
        self.metrics = try container.decodeIfPresent(JSONRecord.self, forKey: .metrics) ?? [:]
        self.budget = try container.decodeIfPresent(JSONRecord.self, forKey: .budget) ?? [:]
        self.createdAt = try container.decode(IsoTimestamp.self, forKey: .createdAt)
        self.updatedAt = try container.decode(IsoTimestamp.self, forKey: .updatedAt)
    }
}

public struct RuntimeBinding: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var agentId: RelayId
    public var harnessId: RelayId
    public var runtimeType: RuntimeType
    public var adapterKind: String
    public var routingMode: String
    public var externalAgentId: String?
    public var runtimeHostId: RelayId? = nil
    public var canonicalAgentId: RelayId? = nil
    public var assignmentEpoch: Int = 0
    public var ownershipState: String = "local"
    public var hostStatus: String = "online"
    public var connectLinked: Bool = false
    public var connectRemoteAgentId: RelayId? = nil
    public var hermesProfileSlug: String?
    public var hermesHomePath: String?
    public var hermesIdentityFilePath: String?
    public var workspaceFolderPath: String?
    public var config: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

extension RuntimeBinding {
    private enum CodingKeys: String, CodingKey {
        case id
        case agentId
        case harnessId
        case runtimeType
        case adapterKind
        case routingMode
        case externalAgentId
        case runtimeHostId
        case canonicalAgentId
        case assignmentEpoch
        case ownershipState
        case hostStatus
        case connectLinked
        case connectRemoteAgentId
        case hermesProfileSlug
        case hermesHomePath
        case hermesIdentityFilePath
        case workspaceFolderPath
        case config
        case createdAt
        case updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(RelayId.self, forKey: .id)
        self.agentId = try container.decode(RelayId.self, forKey: .agentId)
        self.harnessId = try container.decode(RelayId.self, forKey: .harnessId)
        self.runtimeType = try container.decode(RuntimeType.self, forKey: .runtimeType)
        self.adapterKind = try container.decode(String.self, forKey: .adapterKind)
        self.routingMode = try container.decode(String.self, forKey: .routingMode)
        self.externalAgentId = try container.decodeIfPresent(String.self, forKey: .externalAgentId)
        self.runtimeHostId = try container.decodeIfPresent(RelayId.self, forKey: .runtimeHostId)
        self.canonicalAgentId = try container.decodeIfPresent(RelayId.self, forKey: .canonicalAgentId)
        self.assignmentEpoch = try container.decodeIfPresent(Int.self, forKey: .assignmentEpoch) ?? 0
        self.ownershipState = try container.decodeIfPresent(String.self, forKey: .ownershipState) ?? "local"
        self.hostStatus = try container.decodeIfPresent(String.self, forKey: .hostStatus) ?? "online"
        self.connectLinked = try container.decodeIfPresent(Bool.self, forKey: .connectLinked) ?? false
        self.connectRemoteAgentId = try container.decodeIfPresent(RelayId.self, forKey: .connectRemoteAgentId)
        self.hermesProfileSlug = try container.decodeIfPresent(String.self, forKey: .hermesProfileSlug)
        self.hermesHomePath = try container.decodeIfPresent(String.self, forKey: .hermesHomePath)
        self.hermesIdentityFilePath = try container.decodeIfPresent(String.self, forKey: .hermesIdentityFilePath)
        self.workspaceFolderPath = try container.decodeIfPresent(String.self, forKey: .workspaceFolderPath)
        self.config = try container.decodeIfPresent(JSONRecord.self, forKey: .config) ?? [:]
        self.createdAt = try container.decode(IsoTimestamp.self, forKey: .createdAt)
        self.updatedAt = try container.decode(IsoTimestamp.self, forKey: .updatedAt)
    }
}

public struct AgentWithBinding: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var name: String
    public var description: String?
    public var status: String
    public var role: String?
    public var source: String?
    public var externalId: String?
    public var lifecycleStatus: AgentLifecycleStatus
    public var lifecycleReason: String?
    public var retiredAt: IsoTimestamp?
    public var groupType: AgentGroupType?
    public var familyLabel: String?
    public var companyId: RelayId?
    public var departmentId: RelayId?
    public var teamId: RelayId?
    public var managerAgentId: RelayId?
    public var classification: String?
    public var model: String?
    public var responsePresentation: AgentResponsePresentation?
    public var provisioningStatus: AgentProvisioningStatus?
    public var currentTaskId: RelayId?
    public var metrics: JSONRecord
    public var budget: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var binding: RuntimeBinding
    public var harness: Harness

    public init(
        id: RelayId,
        workspaceId: RelayId,
        name: String,
        description: String?,
        status: String,
        role: String? = nil,
        source: String? = nil,
        externalId: String? = nil,
        lifecycleStatus: AgentLifecycleStatus = .active,
        lifecycleReason: String? = nil,
        retiredAt: IsoTimestamp? = nil,
        groupType: AgentGroupType? = nil,
        familyLabel: String? = nil,
        companyId: RelayId? = nil,
        departmentId: RelayId? = nil,
        teamId: RelayId? = nil,
        managerAgentId: RelayId? = nil,
        classification: String? = nil,
        model: String? = nil,
        responsePresentation: AgentResponsePresentation? = nil,
        provisioningStatus: AgentProvisioningStatus? = nil,
        currentTaskId: RelayId? = nil,
        metrics: JSONRecord = [:],
        budget: JSONRecord = [:],
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        binding: RuntimeBinding,
        harness: Harness
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.name = name
        self.description = description
        self.status = status
        self.role = role
        self.source = source
        self.externalId = externalId
        self.lifecycleStatus = lifecycleStatus
        self.lifecycleReason = lifecycleReason
        self.retiredAt = retiredAt
        self.groupType = groupType
        self.familyLabel = familyLabel
        self.companyId = companyId
        self.departmentId = departmentId
        self.teamId = teamId
        self.managerAgentId = managerAgentId
        self.classification = classification
        self.model = model
        self.responsePresentation = responsePresentation
        self.provisioningStatus = provisioningStatus
        self.currentTaskId = currentTaskId
        self.metrics = metrics
        self.budget = budget
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.binding = binding
        self.harness = harness
    }

    enum CodingKeys: String, CodingKey {
        case id
        case workspaceId
        case name
        case description
        case status
        case role
        case source
        case externalId
        case lifecycleStatus
        case lifecycleReason
        case retiredAt
        case groupType
        case familyLabel
        case companyId
        case departmentId
        case teamId
        case managerAgentId
        case classification
        case model
        case responsePresentation
        case provisioningStatus
        case currentTaskId
        case metrics
        case budget
        case createdAt
        case updatedAt
        case binding
        case harness
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(RelayId.self, forKey: .id)
        self.workspaceId = try container.decode(RelayId.self, forKey: .workspaceId)
        self.name = try container.decode(String.self, forKey: .name)
        self.description = try container.decodeIfPresent(String.self, forKey: .description)
        self.status = try container.decode(String.self, forKey: .status)
        self.role = try container.decodeIfPresent(String.self, forKey: .role)
        self.source = try container.decodeIfPresent(String.self, forKey: .source)
        self.externalId = try container.decodeIfPresent(String.self, forKey: .externalId)
        self.lifecycleStatus = try container.decodeIfPresent(AgentLifecycleStatus.self, forKey: .lifecycleStatus) ?? .active
        self.lifecycleReason = try container.decodeIfPresent(String.self, forKey: .lifecycleReason)
        self.retiredAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .retiredAt)
        self.groupType = try container.decodeIfPresent(AgentGroupType.self, forKey: .groupType)
        self.familyLabel = try container.decodeIfPresent(String.self, forKey: .familyLabel)
        self.companyId = try container.decodeIfPresent(RelayId.self, forKey: .companyId)
        self.departmentId = try container.decodeIfPresent(RelayId.self, forKey: .departmentId)
        self.teamId = try container.decodeIfPresent(RelayId.self, forKey: .teamId)
        self.managerAgentId = try container.decodeIfPresent(RelayId.self, forKey: .managerAgentId)
        self.classification = try container.decodeIfPresent(String.self, forKey: .classification)
        self.model = try container.decodeIfPresent(String.self, forKey: .model)
        self.responsePresentation = try? container.decodeIfPresent(AgentResponsePresentation.self, forKey: .responsePresentation)
        self.provisioningStatus = try container.decodeIfPresent(AgentProvisioningStatus.self, forKey: .provisioningStatus)
        self.currentTaskId = try container.decodeIfPresent(RelayId.self, forKey: .currentTaskId)
        self.metrics = try container.decodeIfPresent(JSONRecord.self, forKey: .metrics) ?? [:]
        self.budget = try container.decodeIfPresent(JSONRecord.self, forKey: .budget) ?? [:]
        self.createdAt = try container.decode(IsoTimestamp.self, forKey: .createdAt)
        self.updatedAt = try container.decode(IsoTimestamp.self, forKey: .updatedAt)
        self.binding = try container.decode(RuntimeBinding.self, forKey: .binding)
        self.harness = try container.decode(Harness.self, forKey: .harness)
    }

    public var productMode: RelayProductMode {
        if binding.adapterKind != "railway_cloud" { return .local }
        return binding.config["productMode"]?.string == "cloud" ? .cloud : .connect
    }

    public var executionAvailable: Bool {
        if productMode != .local {
            return binding.config["executionAvailable"]?.bool == true
        }
        return lifecycleStatus == .active &&
        binding.hostStatus == "online" &&
        binding.ownershipState != "quarantined"
    }
}

public struct AgentOrgCompany: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var name: String
    public var industry: String?
    public var status: String
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct AgentOrgDepartment: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var companyId: RelayId?
    public var name: String
    public var colorHex: String?
    public var headAgentId: RelayId?
    public var agentOpsRoomId: RelayId?
    public var status: String
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct AgentOrgTeam: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var departmentId: RelayId?
    public var name: String
    public var leadAgentId: RelayId?
    public var agentOpsRoomId: RelayId?
    public var status: String
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct AgentManagerRelationship: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var managerAgentId: RelayId
    public var reportAgentId: RelayId
    public var relationshipType: String
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public enum AgentTaskStatus: String, Codable, CaseIterable, Sendable {
    case queued
    case dispatched
    case running
    case blocked
    case completed
    case failed
    case cancelled
    case archived
}

public enum AgentTaskPriority: String, Codable, CaseIterable, Sendable {
    case low
    case normal
    case high
    case critical
}

public enum AgentTaskTargetType: String, Codable, CaseIterable, Sendable {
    case direct
    case team
}

public enum AgentTeamMemoryType: String, Codable, CaseIterable, Sendable {
    case note
    case rule
    case context
    case document
    case sop = "SOP"
}

public enum AgentOpsLiveState: String, Codable, CaseIterable, Sendable {
    case offline
    case idle
    case queued
    case working
    case thinking
    case tooling
    case waitingForApproval = "waiting_for_approval"
    case error
    case completed
    case cancelled
}

public enum AgentOpsLiveStateSource: String, Codable, CaseIterable, Sendable {
    case runtimeDispatch = "runtime_dispatch"
    case runtimeTool = "runtime_tool"
    case runtimeThinking = "runtime_thinking"
    case task
    case approval
    case health
    case message
    case agentStatus = "agent_status"
    case none
}

public enum AgentOpsLiveStateConfidence: String, Codable, CaseIterable, Sendable {
    case strong
    case medium
    case weak
}

public enum AgentOpsVisualEntityKind: String, Codable, CaseIterable, Sendable {
    case agent
    case room
    case app
    case workflow
    case output
}

public struct AgentOpsVisualRect: Codable, Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double

    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }
}

public struct AgentOpsVisualPoint: Codable, Equatable, Sendable {
    public var x: Double
    public var y: Double

    public init(x: Double, y: Double) {
        self.x = x
        self.y = y
    }
}

public struct AgentOpsVisualFloor: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var title: String
    public var subtitle: String
    public var order: Int
    public var bounds: AgentOpsVisualRect
    public var backgroundAssetId: String? = nil
    public var backgroundResourceName: String? = nil
    public var backgroundResourceSubdirectory: String? = nil

    public init(
        id: RelayId,
        title: String,
        subtitle: String,
        order: Int,
        bounds: AgentOpsVisualRect,
        backgroundAssetId: String? = nil,
        backgroundResourceName: String? = nil,
        backgroundResourceSubdirectory: String? = nil
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.order = order
        self.bounds = bounds
        self.backgroundAssetId = backgroundAssetId
        self.backgroundResourceName = backgroundResourceName
        self.backgroundResourceSubdirectory = backgroundResourceSubdirectory
    }
}

public struct AgentOpsVisualRoom: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var floorId: RelayId
    public var title: String
    public var zone: String
    public var status: AgentOpsLiveState
    public var agentCount: Int
    public var bounds: AgentOpsVisualRect
    public var deterministicFallback: Bool
    public var kind: String? = nil
    public var variantId: String? = nil
    public var departmentId: RelayId? = nil
    public var businessUnitId: RelayId? = nil
    public var entryAnchors: [AgentOpsVisualPoint]? = nil
    public var workstationAnchors: [AgentOpsVisualPoint]? = nil
    public var screenAnchors: [AgentOpsVisualPoint]? = nil
    public var idleAnchors: [AgentOpsVisualPoint]? = nil
    public var lightAnchors: [AgentOpsVisualPoint]? = nil
}

public struct AgentOpsVisualEntity: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var kind: AgentOpsVisualEntityKind
    public var title: String
    public var subtitle: String
    public var floorId: RelayId
    public var roomId: RelayId?
    public var agentId: RelayId?
    public var state: AgentOpsLiveState
    public var confidence: AgentOpsLiveStateConfidence
    public var source: AgentOpsLiveStateSource
    public var position: AgentOpsVisualPoint
    public var selected: Bool
    public var visualFallbackOnly: Bool
    public var sourceRecordIds: [RelayId]
    public var accessibilityLabel: String
    public var placementReason: String? = nil
    public var spriteAssetId: String? = nil
    public var spriteResourceName: String? = nil
    public var spriteResourceSubdirectory: String? = nil
    public var spriteFrameOrigin: AgentOpsVisualPoint? = nil
    public var spriteFrameWidth: Double? = nil
    public var spriteFrameHeight: Double? = nil
    public var spriteScale: Double? = nil
    public var spriteAnchor: AgentOpsVisualPoint? = nil
}

public struct AgentOpsVisualConnection: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var fromEntityId: RelayId
    public var toRoomId: RelayId
    public var kind: String
    public var sourceRecordIds: [RelayId]
    public var waypoints: [AgentOpsVisualPoint]? = nil
    public var pathTags: [String]? = nil
}

public struct AgentOpsVisualSceneSummary: Codable, Equatable, Sendable {
    public var activeCount: Int
    public var waitingApprovalCount: Int
    public var errorCount: Int
    public var visualFallbackCount: Int
    public var eventCount: Int
}

public enum RuntimeDashboardSnapshotState: String, Codable, CaseIterable, Sendable {
    case loading
    case empty
    case populated
    case offline
    case disabled
    case stale
    case error
    case retry
}

public enum RuntimeDashboardRowKind: String, Codable, CaseIterable, Sendable {
    case runtimeHarness = "runtime_harness"
    case connectedApp = "connected_app"
}

public enum RuntimeDashboardRowStatus: String, Codable, CaseIterable, Sendable {
    case connected
    case degraded
    case offline
    case authRequired = "auth_required"
    case missing
    case active
    case failed
    case idle
}

public enum RuntimeDashboardReachability: String, Codable, CaseIterable, Sendable {
    case reachable
    case unreachable
    case unknown
    case notApplicable = "not_applicable"
}

public enum RuntimeDashboardLocalStatusState: String, Codable, CaseIterable, Sendable {
    case disabled
    case unavailable
}

public struct AgentTask: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var assignedAgentId: RelayId?
    public var targetAgentId: RelayId?
    public var targetTeamId: RelayId?
    public var title: String
    public var message: String
    public var priority: AgentTaskPriority
    public var targetType: AgentTaskTargetType
    public var status: AgentTaskStatus
    public var requiresApproval: Bool
    public var scheduledAt: IsoTimestamp?
    public var timeZone: String?
    public var recurrence: String?
    public var lastError: String?
    public var threadId: RelayId?
    public var metadata: JSONRecord
    public var archivedAt: IsoTimestamp?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct AgentTaskRun: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var taskId: RelayId
    public var agentId: RelayId?
    public var dispatchId: RelayId?
    public var status: AgentTaskStatus
    public var tokensUsed: Int
    public var startedAt: IsoTimestamp?
    public var completedAt: IsoTimestamp?
    public var error: JSONRecord?
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct AgentTeamMemoryEntry: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var teamId: RelayId
    public var title: String
    public var memoryType: AgentTeamMemoryType
    public var content: String
    public var isSensitive: Bool
    public var metadata: JSONRecord
    public var createdByAgentId: RelayId?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct AgentTeamHandover: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var teamId: RelayId
    public var fromAgentId: RelayId?
    public var title: String
    public var content: String
    public var isSensitive: Bool
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct AgentDepartmentDashboardSnapshot: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId { departmentId }
    public var departmentId: RelayId
    public var name: String
    public var teamCount: Int
    public var agentCount: Int
    public var runningTaskCount: Int
    public var blockedTaskCount: Int
    public var pendingApprovalCount: Int
    public var openIncidentCount: Int
}

public struct AgentTeamDashboardSnapshot: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId { teamId }
    public var teamId: RelayId
    public var name: String
    public var agentCount: Int
    public var runningTaskCount: Int
    public var blockedTaskCount: Int
    public var pendingApprovalCount: Int
    public var openIncidentCount: Int
    public var memoryCount: Int
    public var handoverCount: Int
}

public struct AgentStructureDashboardSnapshot: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var departments: [AgentDepartmentDashboardSnapshot]
    public var teams: [AgentTeamDashboardSnapshot]
    public var totalRunningTasks: Int
    public var totalBlockedTasks: Int
    public var totalPendingApprovals: Int
    public var totalOpenIncidents: Int
    public var totalMemoryItems: Int
    public var totalHandovers: Int
}

public struct AgentWorkCalendarDay: Identifiable, Codable, Equatable, Sendable {
    public var id: String { "\(agentId)-\(date)" }
    public var agentId: RelayId
    public var date: String
    public var activityCount: Int
    public var scheduledTaskCount: Int
    public var completedRunCount: Int
    public var activeMinutes: Int?
}

public struct AgentWorkCalendarAgentRow: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId { agentId }
    public var agentId: RelayId
    public var agentName: String
    public var groupType: AgentGroupType
    public var days: [AgentWorkCalendarDay]
    public var totalActivityCount: Int
    public var totalScheduledTaskCount: Int
    public var totalCompletedRunCount: Int
    public var totalActiveMinutes: Int?
}

public struct AgentWorkCalendarSnapshot: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var groupType: AgentGroupType?
    public var rangeStart: String
    public var rangeEnd: String
    public var timeZone: String
    public var derivedFrom: String
    public var rows: [AgentWorkCalendarAgentRow]
    public var activeGapMinutes: Int?
}

public struct RuntimeDashboardAssignedAgentIndicator: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId { agentId }
    public var agentId: RelayId
    public var displayName: String
    public var runtimeType: RuntimeType
    public var status: String
}

public struct RuntimeDashboardRow: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var kind: RuntimeDashboardRowKind
    public var runtimeType: RuntimeType?
    public var harnessId: RelayId?
    public var connectedAppId: RelayId?
    public var displayName: String
    public var status: RuntimeDashboardRowStatus
    public var statusLabel: String
    public var detail: String
    public var reachability: RuntimeDashboardReachability
    public var assignedAgents: [RuntimeDashboardAssignedAgentIndicator]
    public var activeDispatchCount: Int
    public var failedDispatchCount: Int
    public var retryableDispatchCount: Int
    public var latestDispatchId: RelayId?
    public var lastActivityAt: IsoTimestamp?
    public var redactionStatus: String
    public var source: String
}

public struct RuntimeDashboardSnapshot: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var state: RuntimeDashboardSnapshotState
    public var refreshedAt: IsoTimestamp
    public var lastSuccessfulRefreshAt: IsoTimestamp?
    public var staleAfterSeconds: Int
    public var localStatusState: RuntimeDashboardLocalStatusState
    public var localStatusReason: String
    public var disabledReason: String?
    public var errorMessage: String?
    public var retryAvailable: Bool
    public var readOnly: Bool
    public var rows: [RuntimeDashboardRow]
    public var connectedAppCount: Int
    public var runtimeRowCount: Int
    public var activeDispatchCount: Int
    public var failedDispatchCount: Int
    public var retryableDispatchCount: Int
    public var emptyReason: String?
    public var derivedFrom: [String]
    public var redactionStatus: String
}

public enum RuntimeActionKind: String, Codable, CaseIterable, Sendable {
    case cancelDispatch = "cancel_dispatch"
    case retryDispatch = "retry_dispatch"
    case refreshRuntimeDashboard = "refresh_runtime_dashboard"
    case controlledFileWrite = "controlled_file_write"
    case controlledProviderWrite = "controlled_provider_write"
    case hostControl = "host_control"
    case localAppCommand = "local_app_command"
}

public enum RuntimeActionAvailabilityState: String, Codable, CaseIterable, Sendable {
    case available
    case unsupported
    case destructiveBlocked = "destructive_blocked"
    case missingCapability = "missing_capability"
    case dryRunOnly = "dry_run_only"
    case rejected
    case failed
    case running
    case succeeded
    case cancelled
    case stale
}

public enum RuntimeActionRunStatus: String, Codable, CaseIterable, Sendable {
    case dryRun = "dry_run"
    case rejected
    case failed
    case running
    case succeeded
    case cancelled
    case unsupported
    case stale
}

public enum RuntimeActionScopeType: String, Codable, CaseIterable, Sendable {
    case workspace
    case harness
    case dispatch
    case agent
    case dashboard
}

public struct RuntimeActionCapability: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var kind: RuntimeActionKind
    public var displayName: String
    public var availability: RuntimeActionAvailabilityState
    public var stateKind: GuardedStateKind
    public var reasonCode: GuardReasonCode
    public var message: String
    public var recovery: String?
    public var scopeType: RuntimeActionScopeType
    public var runtimeType: RuntimeType?
    public var harnessId: RelayId?
    public var dispatchId: RelayId?
    public var agentId: RelayId?
    public var destructive: Bool
    public var dryRunSupported: Bool
    public var executionSupported: Bool
    public var readOnly: Bool
    public var staleAfterSeconds: Int
    public var evaluatedAt: IsoTimestamp
    public var source: String
    public var redactionStatus: String
}

public struct RuntimeActionRun: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var capabilityId: RelayId?
    public var kind: RuntimeActionKind
    public var status: RuntimeActionRunStatus
    public var stateKind: GuardedStateKind
    public var reasonCode: GuardReasonCode
    public var idempotencyKey: String
    public var actorId: RelayId
    public var scopeType: RuntimeActionScopeType
    public var runtimeType: RuntimeType?
    public var harnessId: RelayId?
    public var dispatchId: RelayId?
    public var agentId: RelayId?
    public var destructive: Bool
    public var dryRun: Bool
    public var executionAttempted: Bool
    public var request: JSONRecord
    public var result: JSONRecord?
    public var failure: JSONRecord?
    public var retentionExpiresAt: IsoTimestamp?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var completedAt: IsoTimestamp?
    public var redactionStatus: String
}

public enum RuntimeStructuredJobStatus: String, Codable, CaseIterable, Sendable {
    case queued
    case running
    case completed
    case failed
    case cancelled
}

public enum RuntimeMissingToolStatus: String, Codable, CaseIterable, Sendable {
    case requested
    case unavailable
    case resolved
    case rejected
}

public enum RuntimeRecoveryState: String, Codable, CaseIterable, Sendable {
    case retryable
    case terminal
    case authRequired = "auth_required"
    case capabilityMissing = "capability_missing"
    case participantUnhealthy = "participant_unhealthy"
    case contextWarning = "context_warning"
    case sourceHostExcluded = "source_host_excluded"
}

public struct RuntimeContextUsageRecord: Codable, Equatable, Sendable {
    public var dispatchId: RelayId?
    public var percentUsed: Double?
    public var tokenCount: Int?
    public var maxTokens: Int?
    public var level: String
    public var isEstimate: Bool
    public var referencesCount: Int
    public var redactionStatus: String
}

public struct RuntimeParticipantHealthRecord: Codable, Equatable, Sendable {
    public var agentId: RelayId
    public var runtimeType: RuntimeType
    public var status: HarnessHealthStatus
    public var message: String
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String
}

public struct RuntimeStructuredJob: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var dispatchId: RelayId?
    public var actionRunId: RelayId?
    public var jobType: String
    public var status: RuntimeStructuredJobStatus
    public var title: String
    public var retryable: Bool
    public var contextUsage: RuntimeContextUsageRecord?
    public var participantHealth: [RuntimeParticipantHealthRecord]
    public var followUpFailure: JSONRecord?
    public var recovery: JSONRecord
    public var sourceHostExcluded: Bool
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var completedAt: IsoTimestamp?
    public var redactionStatus: String
}

public struct RuntimeMissingToolEvent: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var dispatchId: RelayId?
    public var agentId: RelayId?
    public var toolName: String
    public var status: RuntimeMissingToolStatus
    public var request: JSONRecord
    public var autoInstallAttempted: Bool
    public var fakeGrantCreated: Bool
    public var source: String
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String
}

public struct RuntimeRecoveryRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var dispatchId: RelayId?
    public var jobId: RelayId?
    public var state: RuntimeRecoveryState
    public var retryable: Bool
    public var reasonCode: GuardReasonCode
    public var message: String
    public var followUpAction: String?
    public var sourceHostExcluded: Bool
    public var recovery: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var resolvedAt: IsoTimestamp?
    public var redactionStatus: String
}

public enum WorkSafetyTaskStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case queued
    case dispatched
    case running
    case blocked
    case blockedByApproval = "blocked_by_approval"
    case completed
    case failed
    case cancelled
}

public enum WorkSafetyTaskRunStatus: String, Codable, CaseIterable, Sendable {
    case queued
    case dispatched
    case running
    case blockedByApproval = "blocked_by_approval"
    case completed
    case failed
    case cancelled
}

public enum WorkSafetyTaskTargetType: String, Codable, CaseIterable, Sendable {
    case agent
    case team
    case department
    case thread
    case runtimeBinding = "runtime_binding"
    case actionRun = "action_run"
    case agentToAgent = "agent_to_agent"
}

public enum WorkSafetyTaskEventType: String, Codable, CaseIterable, Sendable {
    case created
    case updated
    case statusChanged = "status_changed"
    case approvalRequested = "approval_requested"
    case approvalResolved = "approval_resolved"
    case dispatched
    case cancelled
    case failed
    case completed
    case relaunchRestored = "relaunch_restored"
}

public enum WorkSafetyApprovalStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case approved
    case rejected
    case expired
    case cancelled
}

public enum WorkSafetyApprovalStepStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case satisfied
    case failed
    case skipped
}

public enum WorkSafetyRiskLevel: String, Codable, CaseIterable, Sendable {
    case low
    case medium
    case high
    case destructive
}

public struct WorkSafetyLinkedReferences: Codable, Equatable, Sendable {
    public var actionRunId: RelayId?
    public var dispatchId: RelayId?
    public var structuredJobId: RelayId?
    public var sourceHostRecordId: RelayId?
    public var scheduledMessageId: RelayId?

    public init(
        actionRunId: RelayId? = nil,
        dispatchId: RelayId? = nil,
        structuredJobId: RelayId? = nil,
        sourceHostRecordId: RelayId? = nil,
        scheduledMessageId: RelayId? = nil
    ) {
        self.actionRunId = actionRunId
        self.dispatchId = dispatchId
        self.structuredJobId = structuredJobId
        self.sourceHostRecordId = sourceHostRecordId
        self.scheduledMessageId = scheduledMessageId
    }
}

public struct WorkSafetyTaskRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var title: String
    public var message: String?
    public var status: WorkSafetyTaskStatus
    public var targetType: WorkSafetyTaskTargetType
    public var targetId: RelayId?
    public var assignedAgentId: RelayId?
    public var threadId: RelayId?
    public var runtimeBindingId: RelayId?
    public var linkedReferences: WorkSafetyLinkedReferences
    public var approvalRequired: Bool
    public var approvalId: RelayId?
    public var scheduledAt: IsoTimestamp?
    public var recurrenceRule: String?
    public var priority: Int
    public var riskLevel: WorkSafetyRiskLevel
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var completedAt: IsoTimestamp?
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        title: String,
        message: String?,
        status: WorkSafetyTaskStatus,
        targetType: WorkSafetyTaskTargetType,
        targetId: RelayId?,
        assignedAgentId: RelayId?,
        threadId: RelayId?,
        runtimeBindingId: RelayId?,
        linkedReferences: WorkSafetyLinkedReferences,
        approvalRequired: Bool,
        approvalId: RelayId?,
        scheduledAt: IsoTimestamp?,
        recurrenceRule: String?,
        priority: Int,
        riskLevel: WorkSafetyRiskLevel,
        metadata: JSONRecord,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        completedAt: IsoTimestamp?,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.title = title
        self.message = message
        self.status = status
        self.targetType = targetType
        self.targetId = targetId
        self.assignedAgentId = assignedAgentId
        self.threadId = threadId
        self.runtimeBindingId = runtimeBindingId
        self.linkedReferences = linkedReferences
        self.approvalRequired = approvalRequired
        self.approvalId = approvalId
        self.scheduledAt = scheduledAt
        self.recurrenceRule = recurrenceRule
        self.priority = priority
        self.riskLevel = riskLevel
        self.metadata = metadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.completedAt = completedAt
        self.redactionStatus = redactionStatus
    }
}

public struct WorkSafetyTaskRunRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var taskId: RelayId
    public var status: WorkSafetyTaskRunStatus
    public var linkedReferences: WorkSafetyLinkedReferences
    public var attempt: Int
    public var startedAt: IsoTimestamp?
    public var completedAt: IsoTimestamp?
    public var failureMessage: String?
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        taskId: RelayId,
        status: WorkSafetyTaskRunStatus,
        linkedReferences: WorkSafetyLinkedReferences,
        attempt: Int,
        startedAt: IsoTimestamp?,
        completedAt: IsoTimestamp?,
        failureMessage: String?,
        metadata: JSONRecord,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.taskId = taskId
        self.status = status
        self.linkedReferences = linkedReferences
        self.attempt = attempt
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.failureMessage = failureMessage
        self.metadata = metadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct WorkSafetyTaskEventRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var taskId: RelayId
    public var runId: RelayId?
    public var approvalId: RelayId?
    public var eventType: WorkSafetyTaskEventType
    public var status: String
    public var detail: JSONRecord
    public var occurredAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        taskId: RelayId,
        runId: RelayId?,
        approvalId: RelayId?,
        eventType: WorkSafetyTaskEventType,
        status: String,
        detail: JSONRecord,
        occurredAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.taskId = taskId
        self.runId = runId
        self.approvalId = approvalId
        self.eventType = eventType
        self.status = status
        self.detail = detail
        self.occurredAt = occurredAt
        self.redactionStatus = redactionStatus
    }
}

public struct WorkSafetyApprovalStepRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var approvalId: RelayId
    public var label: String
    public var value: String?
    public var status: WorkSafetyApprovalStepStatus
    public var sortIndex: Int
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        approvalId: RelayId,
        label: String,
        value: String?,
        status: WorkSafetyApprovalStepStatus,
        sortIndex: Int,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.approvalId = approvalId
        self.label = label
        self.value = value
        self.status = status
        self.sortIndex = sortIndex
        self.redactionStatus = redactionStatus
    }
}

public struct WorkSafetyApprovalNoteRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var approvalId: RelayId
    public var authorAgentId: RelayId?
    public var note: String
    public var createdAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        approvalId: RelayId,
        authorAgentId: RelayId?,
        note: String,
        createdAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.approvalId = approvalId
        self.authorAgentId = authorAgentId
        self.note = note
        self.createdAt = createdAt
        self.redactionStatus = redactionStatus
    }
}

public struct WorkSafetyApprovalRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var taskId: RelayId?
    public var title: String
    public var description: String?
    public var status: WorkSafetyApprovalStatus
    public var riskLevel: WorkSafetyRiskLevel
    public var requestedByAgentId: RelayId?
    public var resolverAgentId: RelayId?
    public var expiresAt: IsoTimestamp?
    public var resolvedAt: IsoTimestamp?
    public var steps: [WorkSafetyApprovalStepRecord]
    public var notes: [WorkSafetyApprovalNoteRecord]
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        taskId: RelayId?,
        title: String,
        description: String?,
        status: WorkSafetyApprovalStatus,
        riskLevel: WorkSafetyRiskLevel,
        requestedByAgentId: RelayId?,
        resolverAgentId: RelayId?,
        expiresAt: IsoTimestamp?,
        resolvedAt: IsoTimestamp?,
        steps: [WorkSafetyApprovalStepRecord],
        notes: [WorkSafetyApprovalNoteRecord],
        metadata: JSONRecord,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.taskId = taskId
        self.title = title
        self.description = description
        self.status = status
        self.riskLevel = riskLevel
        self.requestedByAgentId = requestedByAgentId
        self.resolverAgentId = resolverAgentId
        self.expiresAt = expiresAt
        self.resolvedAt = resolvedAt
        self.steps = steps
        self.notes = notes
        self.metadata = metadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public enum PermissionPolicyEffect: String, Codable, CaseIterable, Sendable {
    case allow
    case deny
}

public enum PermissionPolicyStatus: String, Codable, CaseIterable, Sendable {
    case active
    case disabled
}

public enum PermissionPolicyDecision: String, Codable, CaseIterable, Sendable {
    case allowed
    case denied
    case noMatch = "no_match"
}

public struct PermissionPolicyRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var name: String
    public var effect: PermissionPolicyEffect
    public var status: PermissionPolicyStatus
    public var roleTargets: [String]
    public var resourceType: String
    public var resourceId: RelayId?
    public var action: String
    public var priority: Int
    public var reasonCode: GuardReasonCode
    public var message: String
    public var metadata: JSONRecord
    public var createdByActorId: RelayId
    public var updatedByActorId: RelayId
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        name: String,
        effect: PermissionPolicyEffect,
        status: PermissionPolicyStatus,
        roleTargets: [String],
        resourceType: String,
        resourceId: RelayId?,
        action: String,
        priority: Int,
        reasonCode: GuardReasonCode,
        message: String,
        metadata: JSONRecord,
        createdByActorId: RelayId,
        updatedByActorId: RelayId,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.name = name
        self.effect = effect
        self.status = status
        self.roleTargets = roleTargets
        self.resourceType = resourceType
        self.resourceId = resourceId
        self.action = action
        self.priority = priority
        self.reasonCode = reasonCode
        self.message = message
        self.metadata = metadata
        self.createdByActorId = createdByActorId
        self.updatedByActorId = updatedByActorId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct PermissionPolicyEvaluation: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var actorId: RelayId
    public var resourceType: String
    public var resourceId: RelayId?
    public var action: String
    public var decision: PermissionPolicyDecision
    public var allowed: Bool
    public var matchedPolicyId: RelayId?
    public var reasonCode: GuardReasonCode
    public var message: String
    public var evaluatedAt: IsoTimestamp

    public init(
        workspaceId: RelayId,
        actorId: RelayId,
        resourceType: String,
        resourceId: RelayId?,
        action: String,
        decision: PermissionPolicyDecision,
        allowed: Bool,
        matchedPolicyId: RelayId?,
        reasonCode: GuardReasonCode,
        message: String,
        evaluatedAt: IsoTimestamp
    ) {
        self.workspaceId = workspaceId
        self.actorId = actorId
        self.resourceType = resourceType
        self.resourceId = resourceId
        self.action = action
        self.decision = decision
        self.allowed = allowed
        self.matchedPolicyId = matchedPolicyId
        self.reasonCode = reasonCode
        self.message = message
        self.evaluatedAt = evaluatedAt
    }
}

public struct AuditLogRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var actorId: RelayId
    public var actorType: String
    public var eventType: String
    public var resourceType: String
    public var resourceId: RelayId?
    public var severity: String
    public var message: String
    public var correlationId: String?
    public var taskId: RelayId?
    public var approvalId: RelayId?
    public var actionRunId: RelayId?
    public var dispatchId: RelayId?
    public var threadId: RelayId?
    public var harnessId: RelayId?
    public var source: String
    public var context: JSONRecord
    public var writeStatus: String
    public var createdAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        actorId: RelayId,
        actorType: String,
        eventType: String,
        resourceType: String,
        resourceId: RelayId? = nil,
        severity: String,
        message: String,
        correlationId: String? = nil,
        taskId: RelayId? = nil,
        approvalId: RelayId? = nil,
        actionRunId: RelayId? = nil,
        dispatchId: RelayId? = nil,
        threadId: RelayId? = nil,
        harnessId: RelayId? = nil,
        source: String,
        context: JSONRecord,
        writeStatus: String,
        createdAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.actorId = actorId
        self.actorType = actorType
        self.eventType = eventType
        self.resourceType = resourceType
        self.resourceId = resourceId
        self.severity = severity
        self.message = message
        self.correlationId = correlationId
        self.taskId = taskId
        self.approvalId = approvalId
        self.actionRunId = actionRunId
        self.dispatchId = dispatchId
        self.threadId = threadId
        self.harnessId = harnessId
        self.source = source
        self.context = context
        self.writeStatus = writeStatus
        self.createdAt = createdAt
        self.redactionStatus = redactionStatus
    }
}

public struct AuditLogPage: Codable, Equatable, Sendable {
    public var records: [AuditLogRecord]
    public var limit: Int
    public var offset: Int
    public var nextOffset: Int?
    public var totalCount: Int
    public var redactionStatus: String

    public init(
        records: [AuditLogRecord],
        limit: Int,
        offset: Int,
        nextOffset: Int?,
        totalCount: Int,
        redactionStatus: String
    ) {
        self.records = records
        self.limit = limit
        self.offset = offset
        self.nextOffset = nextOffset
        self.totalCount = totalCount
        self.redactionStatus = redactionStatus
    }
}

public struct SecurityMetricSnapshot: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var windowStartedAt: IsoTimestamp?
    public var windowEndedAt: IsoTimestamp?
    public var generatedAt: IsoTimestamp
    public var auditEventCount: Int
    public var deniedActionCount: Int
    public var permissionDeniedCount: Int
    public var approvalDecisionCount: Int
    public var policyMutationCount: Int
    public var taskTransitionCount: Int
    public var toolRequestTransitionCount: Int
    public var commandRejectionCount: Int
    public var highRiskExecutionCount: Int
    public var filePermissionChangeCount: Int
    public var exportResetAttemptCount: Int
    public var recoveryEventCount: Int
    public var auditWriteFailureCount: Int
    public var redactionAppliedCount: Int
    public var categoryCounts: JSONRecord
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        windowStartedAt: IsoTimestamp? = nil,
        windowEndedAt: IsoTimestamp? = nil,
        generatedAt: IsoTimestamp,
        auditEventCount: Int,
        deniedActionCount: Int,
        permissionDeniedCount: Int,
        approvalDecisionCount: Int,
        policyMutationCount: Int,
        taskTransitionCount: Int,
        toolRequestTransitionCount: Int,
        commandRejectionCount: Int,
        highRiskExecutionCount: Int,
        filePermissionChangeCount: Int,
        exportResetAttemptCount: Int,
        recoveryEventCount: Int,
        auditWriteFailureCount: Int,
        redactionAppliedCount: Int,
        categoryCounts: JSONRecord,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.windowStartedAt = windowStartedAt
        self.windowEndedAt = windowEndedAt
        self.generatedAt = generatedAt
        self.auditEventCount = auditEventCount
        self.deniedActionCount = deniedActionCount
        self.permissionDeniedCount = permissionDeniedCount
        self.approvalDecisionCount = approvalDecisionCount
        self.policyMutationCount = policyMutationCount
        self.taskTransitionCount = taskTransitionCount
        self.toolRequestTransitionCount = toolRequestTransitionCount
        self.commandRejectionCount = commandRejectionCount
        self.highRiskExecutionCount = highRiskExecutionCount
        self.filePermissionChangeCount = filePermissionChangeCount
        self.exportResetAttemptCount = exportResetAttemptCount
        self.recoveryEventCount = recoveryEventCount
        self.auditWriteFailureCount = auditWriteFailureCount
        self.redactionAppliedCount = redactionAppliedCount
        self.categoryCounts = categoryCounts
        self.redactionStatus = redactionStatus
    }
}

public enum NativeFilePermissionTargetKind: String, Codable, CaseIterable, Sendable {
    case file
    case folder
}

public enum NativeFilePermissionAccessLevel: String, Codable, CaseIterable, Sendable {
    case readOnly = "read_only"
    case readWrite = "read_write"
}

public enum NativeFilePermissionStatus: String, Codable, CaseIterable, Sendable {
    case notLinked = "not_linked"
    case permissionNeeded = "permission_needed"
    case linked
    case readOnly = "read_only"
    case readWriteGranted = "read_write_granted"
    case revoked
    case unavailable
    case synced
    case stale
    case syncFailed = "sync_failed"
}

public struct NativeFilePermissionRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var targetKind: NativeFilePermissionTargetKind
    public var displayName: String
    public var displayPath: String
    public var pathHash: String?
    public var bookmarkRef: String?
    public var accessLevel: NativeFilePermissionAccessLevel
    public var status: NativeFilePermissionStatus
    public var relatedTaskId: RelayId?
    public var relatedToolRequestId: RelayId?
    public var relatedActionRunId: RelayId?
    public var lastValidatedAt: IsoTimestamp?
    public var lastSyncedAt: IsoTimestamp?
    public var failureReason: String?
    public var metadata: JSONRecord
    public var createdByActorId: RelayId
    public var updatedByActorId: RelayId
    public var revokedAt: IsoTimestamp?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        targetKind: NativeFilePermissionTargetKind,
        displayName: String,
        displayPath: String,
        pathHash: String?,
        bookmarkRef: String?,
        accessLevel: NativeFilePermissionAccessLevel,
        status: NativeFilePermissionStatus,
        relatedTaskId: RelayId? = nil,
        relatedToolRequestId: RelayId? = nil,
        relatedActionRunId: RelayId? = nil,
        lastValidatedAt: IsoTimestamp? = nil,
        lastSyncedAt: IsoTimestamp? = nil,
        failureReason: String? = nil,
        metadata: JSONRecord = [:],
        createdByActorId: RelayId,
        updatedByActorId: RelayId,
        revokedAt: IsoTimestamp? = nil,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.targetKind = targetKind
        self.displayName = displayName
        self.displayPath = displayPath
        self.pathHash = pathHash
        self.bookmarkRef = bookmarkRef
        self.accessLevel = accessLevel
        self.status = status
        self.relatedTaskId = relatedTaskId
        self.relatedToolRequestId = relatedToolRequestId
        self.relatedActionRunId = relatedActionRunId
        self.lastValidatedAt = lastValidatedAt
        self.lastSyncedAt = lastSyncedAt
        self.failureReason = failureReason
        self.metadata = metadata
        self.createdByActorId = createdByActorId
        self.updatedByActorId = updatedByActorId
        self.revokedAt = revokedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public enum ToolRequestStatus: String, Codable, CaseIterable, Sendable {
    case requested
    case connected
    case granted
    case unavailable
    case dismissed
    case ignored
    case resolved
    case rejected
}

public enum ToolRequestAvailabilityState: String, Codable, CaseIterable, Sendable {
    case unknown
    case notConnected = "not_connected"
    case connected
    case granted
    case unavailable
}

public enum NeededToolsSnapshotState: String, Codable, CaseIterable, Sendable {
    case loading
    case empty
    case ready
    case readOnly = "read_only"
    case unavailable
    case error
}

public struct ToolRequestSuggestedApp: Identifiable, Codable, Equatable, Sendable {
    public var id: String { appId ?? appSlug }
    public var appId: RelayId?
    public var appSlug: String
    public var appName: String
    public var category: String
    public var connectionState: MarketplaceConnectionState
    public var installState: MarketplaceInstallState
    public var availabilityState: ToolRequestAvailabilityState
    public var matchingCapabilities: [String]
    public var guidance: String
    public var redactionStatus: String

    public init(
        appId: RelayId?,
        appSlug: String,
        appName: String,
        category: String,
        connectionState: MarketplaceConnectionState,
        installState: MarketplaceInstallState,
        availabilityState: ToolRequestAvailabilityState,
        matchingCapabilities: [String],
        guidance: String,
        redactionStatus: String
    ) {
        self.appId = appId
        self.appSlug = appSlug
        self.appName = appName
        self.category = category
        self.connectionState = connectionState
        self.installState = installState
        self.availabilityState = availabilityState
        self.matchingCapabilities = matchingCapabilities
        self.guidance = guidance
        self.redactionStatus = redactionStatus
    }
}

public struct ToolRequestRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var requestedCapability: String
    public var normalizedCapability: String
    public var appId: RelayId?
    public var appSlug: String?
    public var agentId: RelayId?
    public var agentName: String?
    public var threadId: RelayId?
    public var dispatchId: RelayId?
    public var missingToolEventId: RelayId?
    public var relatedTaskId: RelayId?
    public var relatedRecordId: RelayId?
    public var campaign: String?
    public var reason: String
    public var requiredAction: String
    public var evidence: String?
    public var status: ToolRequestStatus
    public var policyAllowed: Bool
    public var toolAvailable: Bool
    public var toolConnected: Bool
    public var toolGranted: Bool
    public var availabilityState: ToolRequestAvailabilityState
    public var suggestedApps: [ToolRequestSuggestedApp]
    public var metadata: JSONRecord
    public var requestedAt: IsoTimestamp
    public var lastSeenAt: IsoTimestamp
    public var resolvedAt: IsoTimestamp?
    public var resolutionNote: String?
    public var createdByActorId: RelayId?
    public var updatedByActorId: RelayId?
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        requestedCapability: String,
        normalizedCapability: String,
        appId: RelayId?,
        appSlug: String?,
        agentId: RelayId?,
        agentName: String?,
        threadId: RelayId?,
        dispatchId: RelayId?,
        missingToolEventId: RelayId?,
        relatedTaskId: RelayId?,
        relatedRecordId: RelayId?,
        campaign: String?,
        reason: String,
        requiredAction: String,
        evidence: String?,
        status: ToolRequestStatus,
        policyAllowed: Bool,
        toolAvailable: Bool,
        toolConnected: Bool,
        toolGranted: Bool,
        availabilityState: ToolRequestAvailabilityState,
        suggestedApps: [ToolRequestSuggestedApp],
        metadata: JSONRecord,
        requestedAt: IsoTimestamp,
        lastSeenAt: IsoTimestamp,
        resolvedAt: IsoTimestamp?,
        resolutionNote: String?,
        createdByActorId: RelayId?,
        updatedByActorId: RelayId?,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.requestedCapability = requestedCapability
        self.normalizedCapability = normalizedCapability
        self.appId = appId
        self.appSlug = appSlug
        self.agentId = agentId
        self.agentName = agentName
        self.threadId = threadId
        self.dispatchId = dispatchId
        self.missingToolEventId = missingToolEventId
        self.relatedTaskId = relatedTaskId
        self.relatedRecordId = relatedRecordId
        self.campaign = campaign
        self.reason = reason
        self.requiredAction = requiredAction
        self.evidence = evidence
        self.status = status
        self.policyAllowed = policyAllowed
        self.toolAvailable = toolAvailable
        self.toolConnected = toolConnected
        self.toolGranted = toolGranted
        self.availabilityState = availabilityState
        self.suggestedApps = suggestedApps
        self.metadata = metadata
        self.requestedAt = requestedAt
        self.lastSeenAt = lastSeenAt
        self.resolvedAt = resolvedAt
        self.resolutionNote = resolutionNote
        self.createdByActorId = createdByActorId
        self.updatedByActorId = updatedByActorId
        self.redactionStatus = redactionStatus
    }
}

public struct NeededToolsSummary: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var appId: RelayId?
    public var appSlug: String?
    public var queryStatus: String
    public var openRequestCount: Int
    public var connectedCount: Int
    public var grantedCount: Int
    public var unavailableCount: Int
    public var dismissedCount: Int
    public var resolvedCount: Int
    public var suggestedAppCount: Int
    public var generatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        workspaceId: RelayId,
        appId: RelayId?,
        appSlug: String?,
        queryStatus: String,
        openRequestCount: Int,
        connectedCount: Int,
        grantedCount: Int,
        unavailableCount: Int,
        dismissedCount: Int,
        resolvedCount: Int,
        suggestedAppCount: Int,
        generatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.queryStatus = queryStatus
        self.openRequestCount = openRequestCount
        self.connectedCount = connectedCount
        self.grantedCount = grantedCount
        self.unavailableCount = unavailableCount
        self.dismissedCount = dismissedCount
        self.resolvedCount = resolvedCount
        self.suggestedAppCount = suggestedAppCount
        self.generatedAt = generatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct NeededToolsDiagnostics: Codable, Equatable, Sendable {
    public var openSummary: String
    public var connectionSummary: String
    public var grantSummary: String
    public var unavailableSummary: String
    public var message: String

    public init(
        openSummary: String,
        connectionSummary: String,
        grantSummary: String,
        unavailableSummary: String,
        message: String
    ) {
        self.openSummary = openSummary
        self.connectionSummary = connectionSummary
        self.grantSummary = grantSummary
        self.unavailableSummary = unavailableSummary
        self.message = message
    }
}

public struct NeededToolsSnapshot: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var appId: RelayId?
    public var appSlug: String?
    public var state: NeededToolsSnapshotState
    public var refreshedAt: IsoTimestamp
    public var queryStatus: String
    public var requests: [ToolRequestRecord]
    public var selectedRequest: ToolRequestRecord?
    public var summary: NeededToolsSummary
    public var diagnostics: NeededToolsDiagnostics
    public var readOnly: Bool
    public var redactionStatus: String

    public init(
        workspaceId: RelayId,
        appId: RelayId?,
        appSlug: String?,
        state: NeededToolsSnapshotState,
        refreshedAt: IsoTimestamp,
        queryStatus: String,
        requests: [ToolRequestRecord],
        selectedRequest: ToolRequestRecord?,
        summary: NeededToolsSummary,
        diagnostics: NeededToolsDiagnostics,
        readOnly: Bool,
        redactionStatus: String
    ) {
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.state = state
        self.refreshedAt = refreshedAt
        self.queryStatus = queryStatus
        self.requests = requests
        self.selectedRequest = selectedRequest
        self.summary = summary
        self.diagnostics = diagnostics
        self.readOnly = readOnly
        self.redactionStatus = redactionStatus
    }
}

public enum ApplicationsCatalogState: String, Codable, CaseIterable, Sendable {
    case loading
    case ready
    case empty
    case noMatch = "no_match"
    case unavailable
    case error
}

public enum ApplicationsCatalogView: String, Codable, CaseIterable, Sendable {
    case all
    case external
    case local
    case connections
    case installed
    case review
}

public enum MarketplaceAppSourceType: String, Codable, CaseIterable, Sendable {
    case externalProvider = "external_provider"
    case localAppExcluded = "local_app_excluded"
}

public enum MarketplaceRiskLevel: String, Codable, CaseIterable, Sendable {
    case low
    case medium
    case high
    case critical
}

public enum MarketplaceAppAvailabilityState: String, Codable, CaseIterable, Sendable {
    case available
    case betaUnavailable = "beta_unavailable"
    case comingSoon = "coming_soon"
    case unavailable
}

public enum MarketplaceConnectionState: String, Codable, CaseIterable, Sendable {
    case none
    case connected
    case unavailable
}

public enum MarketplaceInstallState: String, Codable, CaseIterable, Sendable {
    case notInstalled = "not_installed"
    case installed
    case unavailable
}

public enum MarketplaceInstallLifecycleStatus: String, Codable, CaseIterable, Sendable {
    case requested
    case installed
    case failed
    case removed
    case superseded
    case unavailable
}

public enum MarketplaceInstallDriftStatus: String, Codable, CaseIterable, Sendable {
    case unknown
    case current
    case refreshNeeded = "refresh_needed"
    case unconfigured
    case superseded
    case runtimeFilesNotRemoved = "runtime_files_not_removed"
}

public enum MarketplaceInstallTargetMode: String, Codable, CaseIterable, Sendable {
    case existingAgent = "existing_agent"
    case activateNewAgentUnavailable = "activate_new_agent_unavailable"
}

public enum MarketplaceAgentCompatibilityStatus: String, Codable, CaseIterable, Sendable {
    case compatible
    case inactiveAgent = "inactive_agent"
    case runtimeUnsupported = "runtime_unsupported"
    case roleUnsupported = "role_unsupported"
    case missingRuntimeBinding = "missing_runtime_binding"
    case unavailable
}

public enum MarketplaceInstallSnapshotState: String, Codable, CaseIterable, Sendable {
    case loading
    case empty
    case ready
    case readOnly = "read_only"
    case unavailable
    case error
}

public enum ProviderConnectionStatus: String, Codable, CaseIterable, Sendable {
    case disconnected
    case connected
    case expired
    case authRequired = "auth_required"
    case healthError = "health_error"
    case validating
    case senderInvalid = "sender_invalid"
    case disconnecting
    case reauthorizeRequired = "reauthorize_required"
    case unavailable
}

public enum ProviderAuthorizationState: String, Codable, CaseIterable, Sendable {
    case notStarted = "not_started"
    case pending
    case deepLinkPending = "deep_link_pending"
    case manualEvidenceRequired = "manual_evidence_required"
    case completed
    case error
    case unavailable
}

public enum ProviderSecretReferenceStatus: String, Codable, CaseIterable, Sendable {
    case missing
    case referenced
    case verified
    case unavailable
}

public enum ProviderCredentialOwnership: String, Codable, CaseIterable, Sendable {
    case userOwned = "user_owned"
    case relayOwned = "relay_owned"
    case sharedRelayExcluded = "shared_relay_excluded"
    case notRequired = "not_required"
}

public enum MarketplaceExecutionAuthority: String, Codable, CaseIterable, Sendable {
    case deviceLocal = "swift"
    case railway
    case unknown

    public static let contractVersion = "marketplace-execution-authority.v1"

    public static let railwayBrokeredAppSlugs: Set<String> = [
        "bluesky",
        "dialpad",
        "eventbrite",
        "goto-meeting",
        "line",
        "meetup",
        "nextdoor",
        "ringcentral",
        "twist",
        "webex",
        "zoho-mail"
    ]

    public static func currentSwiftAdapterAuthority(for appSlug: String) -> MarketplaceExecutionAuthority {
        railwayBrokeredAppSlugs.contains(appSlug.lowercased()) ? .railway : .deviceLocal
    }

    public static func inferredLegacyConnectionAuthority(
        appSlug: String,
        secretReferenceIds: [RelayId]
    ) -> MarketplaceExecutionAuthority {
        secretReferenceIds.isEmpty
            ? currentSwiftAdapterAuthority(for: appSlug)
            : .deviceLocal
    }

    public init(from decoder: Decoder) throws {
        let value = try decoder.singleValueContainer().decode(String.self)
        self = MarketplaceExecutionAuthority(rawValue: value) ?? .unknown
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

public enum ProviderConnectorHealthState: String, Codable, CaseIterable, Sendable {
    case unknown
    case ready
    case degraded
    case error
    case validating
    case unavailable
}

public enum ProviderSenderIdentityStatus: String, Codable, CaseIterable, Sendable {
    case notRequired = "not_required"
    case unverified
    case verified
    case invalid
    case checking
}

public enum ProviderConnectionSnapshotState: String, Codable, CaseIterable, Sendable {
    case loading
    case empty
    case ready
    case readOnly = "read_only"
    case unavailable
    case error
}

public enum ProviderActionKind: String, Codable, CaseIterable, Sendable {
    case read
    case search
    case draft
    case message
    case write
    case delete
    case admin
}

public enum ProviderActionRiskLevel: String, Codable, CaseIterable, Sendable {
    case low
    case medium
    case high
    case destructive
}

public enum ProviderAdapterKind: String, Codable, CaseIterable, Sendable {
    case officialMCP = "official_mcp"
    case communityMCP = "community_mcp"
    case nativeAPI = "native_api"
    case browserAutomation = "browser_automation"
    case localScript = "local_script"
    case manualOnly = "manual_only"
    case unsupported
}

public enum ProviderActionPermission: String, Codable, CaseIterable, Sendable {
    case allowed
    case approvalRequired = "approval_required"
    case autoExecute = "auto_execute"
    case blocked
}

public enum MarketplaceActionPolicyPreset: String, Codable, CaseIterable, Sendable {
    case readOnly = "read_only"
    case approvalRequired = "approval_required"
    case allowDirectWrites = "allow_direct_writes"
    case blocked
}

public enum ProviderActionExecutionStatus: String, Codable, CaseIterable, Sendable {
    case queued
    case pendingApproval = "pending_approval"
    case approved
    case autoExecuted = "auto_executed"
    case blocked
    case running
    case succeeded
    case failed
    case cancelled
    case expired
}

public struct ProviderCredentialRequirement: Identifiable, Codable, Equatable, Sendable {
    public var id: String { fieldKey }
    public var fieldKey: String
    public var label: String
    public var required: Bool
    public var userOwnedRequired: Bool
    public var secretReferenceId: RelayId?
    public var status: ProviderSecretReferenceStatus
    public var helpText: String?
    public var redactionStatus: String

    public init(
        fieldKey: String,
        label: String,
        required: Bool,
        userOwnedRequired: Bool,
        secretReferenceId: RelayId?,
        status: ProviderSecretReferenceStatus,
        helpText: String?,
        redactionStatus: String
    ) {
        self.fieldKey = fieldKey
        self.label = label
        self.required = required
        self.userOwnedRequired = userOwnedRequired
        self.secretReferenceId = secretReferenceId
        self.status = status
        self.helpText = helpText
        self.redactionStatus = redactionStatus
    }
}

public struct ProviderConnectorHealth: Codable, Equatable, Sendable {
    public var state: ProviderConnectorHealthState
    public var message: String
    public var lastCheckedAt: IsoTimestamp?
    public var missingScopes: [String]
    public var unavailableTools: [String]
    public var diagnostics: JSONRecord
    public var redactionStatus: String

    public init(
        state: ProviderConnectorHealthState,
        message: String,
        lastCheckedAt: IsoTimestamp?,
        missingScopes: [String],
        unavailableTools: [String],
        diagnostics: JSONRecord,
        redactionStatus: String
    ) {
        self.state = state
        self.message = message
        self.lastCheckedAt = lastCheckedAt
        self.missingScopes = missingScopes
        self.unavailableTools = unavailableTools
        self.diagnostics = diagnostics
        self.redactionStatus = redactionStatus
    }
}

public struct ProviderSenderIdentity: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var email: String
    public var validationStatus: ProviderSenderIdentityStatus
    public var agentId: RelayId?
    public var installId: RelayId?
    public var lastCheckedAt: IsoTimestamp?
    public var errorMessage: String?
    public var redactionStatus: String

    public init(
        id: RelayId,
        email: String,
        validationStatus: ProviderSenderIdentityStatus,
        agentId: RelayId?,
        installId: RelayId?,
        lastCheckedAt: IsoTimestamp?,
        errorMessage: String?,
        redactionStatus: String
    ) {
        self.id = id
        self.email = email
        self.validationStatus = validationStatus
        self.agentId = agentId
        self.installId = installId
        self.lastCheckedAt = lastCheckedAt
        self.errorMessage = errorMessage
        self.redactionStatus = redactionStatus
    }
}

public struct MarketplaceProviderConnection: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var appId: RelayId
    public var appSlug: String
    public var providerKey: String
    public var providerName: String
    public var status: ProviderConnectionStatus
    public var authorizationState: ProviderAuthorizationState
    public var credentialOwnership: ProviderCredentialOwnership
    public var executionAuthority: MarketplaceExecutionAuthority?
    public var executionAuthorityVersion: String?
    public var userOwnedCredentialsRequired: Bool
    public var credentialRequirements: [ProviderCredentialRequirement]
    public var secretReferenceIds: [RelayId]
    public var accountLabel: String?
    public var connectedHandle: String?
    public var callbackURL: String?
    public var requiredScopes: [String]
    public var grantedScopes: [String]
    public var selectedCapabilities: [String]
    public var health: ProviderConnectorHealth
    public var senderIdentities: [ProviderSenderIdentity]
    public var installPolicy: String?
    public var lastCheckedAt: IsoTimestamp?
    public var lastError: String?
    public var manualEvidenceNote: String?
    public var reauthorizeRequired: Bool
    public var disconnecting: Bool
    public var betaBlocked: Bool
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        providerKey: String,
        providerName: String,
        status: ProviderConnectionStatus,
        authorizationState: ProviderAuthorizationState,
        credentialOwnership: ProviderCredentialOwnership,
        executionAuthority: MarketplaceExecutionAuthority? = nil,
        executionAuthorityVersion: String? = nil,
        userOwnedCredentialsRequired: Bool,
        credentialRequirements: [ProviderCredentialRequirement],
        secretReferenceIds: [RelayId],
        accountLabel: String?,
        connectedHandle: String?,
        callbackURL: String?,
        requiredScopes: [String],
        grantedScopes: [String],
        selectedCapabilities: [String],
        health: ProviderConnectorHealth,
        senderIdentities: [ProviderSenderIdentity],
        installPolicy: String?,
        lastCheckedAt: IsoTimestamp?,
        lastError: String?,
        manualEvidenceNote: String?,
        reauthorizeRequired: Bool,
        disconnecting: Bool,
        betaBlocked: Bool,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.providerKey = providerKey
        self.providerName = providerName
        self.status = status
        self.authorizationState = authorizationState
        self.credentialOwnership = credentialOwnership
        self.executionAuthority = executionAuthority ?? MarketplaceExecutionAuthority.inferredLegacyConnectionAuthority(
            appSlug: appSlug,
            secretReferenceIds: secretReferenceIds
        )
        self.executionAuthorityVersion = executionAuthorityVersion ?? MarketplaceExecutionAuthority.contractVersion
        self.userOwnedCredentialsRequired = userOwnedCredentialsRequired
        self.credentialRequirements = credentialRequirements
        self.secretReferenceIds = secretReferenceIds
        self.accountLabel = accountLabel
        self.connectedHandle = connectedHandle
        self.callbackURL = callbackURL
        self.requiredScopes = requiredScopes
        self.grantedScopes = grantedScopes
        self.selectedCapabilities = selectedCapabilities
        self.health = health
        self.senderIdentities = senderIdentities
        self.installPolicy = installPolicy
        self.lastCheckedAt = lastCheckedAt
        self.lastError = lastError
        self.manualEvidenceNote = manualEvidenceNote
        self.reauthorizeRequired = reauthorizeRequired
        self.disconnecting = disconnecting
        self.betaBlocked = betaBlocked
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }

    public var resolvedExecutionAuthority: MarketplaceExecutionAuthority? {
        guard executionAuthorityVersion == MarketplaceExecutionAuthority.contractVersion,
              let executionAuthority,
              executionAuthority != .unknown else {
            return nil
        }
        return executionAuthority
    }
}

public struct ProviderAuthorizationFlow: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var appId: RelayId
    public var connectionId: RelayId?
    public var providerKey: String
    public var state: ProviderAuthorizationState
    public var callbackURL: String?
    public var authorizationURL: String?
    public var deepLinkURL: String?
    public var manualEvidenceNote: String?
    public var errorMessage: String?
    public var startedByActorId: RelayId
    public var startedAt: IsoTimestamp
    public var completedAt: IsoTimestamp?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        appId: RelayId,
        connectionId: RelayId?,
        providerKey: String,
        state: ProviderAuthorizationState,
        callbackURL: String?,
        authorizationURL: String?,
        deepLinkURL: String?,
        manualEvidenceNote: String?,
        errorMessage: String?,
        startedByActorId: RelayId,
        startedAt: IsoTimestamp,
        completedAt: IsoTimestamp?,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.appId = appId
        self.connectionId = connectionId
        self.providerKey = providerKey
        self.state = state
        self.callbackURL = callbackURL
        self.authorizationURL = authorizationURL
        self.deepLinkURL = deepLinkURL
        self.manualEvidenceNote = manualEvidenceNote
        self.errorMessage = errorMessage
        self.startedByActorId = startedByActorId
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct ProviderConnectionDiagnostics: Codable, Equatable, Sendable {
    public var connectorHealthSummary: String
    public var oauthStateSummary: String
    public var keychainReferenceSummary: String
    public var senderIdentitySummary: String
    public var userOwnedCredentialSummary: String
    public var manualEvidenceSummary: String
    public var message: String

    public init(
        connectorHealthSummary: String,
        oauthStateSummary: String,
        keychainReferenceSummary: String,
        senderIdentitySummary: String,
        userOwnedCredentialSummary: String,
        manualEvidenceSummary: String,
        message: String
    ) {
        self.connectorHealthSummary = connectorHealthSummary
        self.oauthStateSummary = oauthStateSummary
        self.keychainReferenceSummary = keychainReferenceSummary
        self.senderIdentitySummary = senderIdentitySummary
        self.userOwnedCredentialSummary = userOwnedCredentialSummary
        self.manualEvidenceSummary = manualEvidenceSummary
        self.message = message
    }
}

public struct ProviderConnectionSnapshot: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var appId: RelayId?
    public var appSlug: String?
    public var state: ProviderConnectionSnapshotState
    public var refreshedAt: IsoTimestamp
    public var connections: [MarketplaceProviderConnection]
    public var authorizationFlows: [ProviderAuthorizationFlow]
    public var selectedConnection: MarketplaceProviderConnection?
    public var diagnostics: ProviderConnectionDiagnostics
    public var readOnly: Bool
    public var redactionStatus: String

    public init(
        workspaceId: RelayId,
        appId: RelayId?,
        appSlug: String?,
        state: ProviderConnectionSnapshotState,
        refreshedAt: IsoTimestamp,
        connections: [MarketplaceProviderConnection],
        authorizationFlows: [ProviderAuthorizationFlow],
        selectedConnection: MarketplaceProviderConnection?,
        diagnostics: ProviderConnectionDiagnostics,
        readOnly: Bool,
        redactionStatus: String
    ) {
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.state = state
        self.refreshedAt = refreshedAt
        self.connections = connections
        self.authorizationFlows = authorizationFlows
        self.selectedConnection = selectedConnection
        self.diagnostics = diagnostics
        self.readOnly = readOnly
        self.redactionStatus = redactionStatus
    }
}

public struct MarketplaceProviderActionDefinition: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var appId: RelayId
    public var appSlug: String
    public var providerKey: String
    public var actionKey: String
    public var displayName: String
    public var summary: String
    public var kind: ProviderActionKind
    public var riskLevel: ProviderActionRiskLevel
    public var adapterKind: ProviderAdapterKind
    public var defaultPermission: ProviderActionPermission
    public var requiredScopes: [String]
    public var capabilityKeys: [String]
    public var payloadSchema: JSONRecord
    public var resultSchema: JSONRecord
    public var enabled: Bool
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        providerKey: String,
        actionKey: String,
        displayName: String,
        summary: String,
        kind: ProviderActionKind,
        riskLevel: ProviderActionRiskLevel,
        adapterKind: ProviderAdapterKind,
        defaultPermission: ProviderActionPermission,
        requiredScopes: [String],
        capabilityKeys: [String],
        payloadSchema: JSONRecord,
        resultSchema: JSONRecord,
        enabled: Bool,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.providerKey = providerKey
        self.actionKey = actionKey
        self.displayName = displayName
        self.summary = summary
        self.kind = kind
        self.riskLevel = riskLevel
        self.adapterKind = adapterKind
        self.defaultPermission = defaultPermission
        self.requiredScopes = requiredScopes
        self.capabilityKeys = capabilityKeys
        self.payloadSchema = payloadSchema
        self.resultSchema = resultSchema
        self.enabled = enabled
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct MarketplaceActionPermissionMap: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var appId: RelayId
    public var appSlug: String
    public var connectionId: RelayId?
    public var installId: RelayId?
    public var agentId: RelayId?
    public var policyPreset: MarketplaceActionPolicyPreset
    public var permissions: [String: ProviderActionPermission]
    public var blockedReasons: [String: String]
    public var source: String
    public var createdByActorId: RelayId
    public var updatedByActorId: RelayId?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var executionAuthority: MarketplaceExecutionAuthority?
    public var executionAuthorityVersion: String?
    public var dangerousPolicyAcknowledgementVersion: String?
    public var dangerousPolicyAcknowledgedAt: IsoTimestamp?
    public var dangerousPolicyAcknowledgedByActorId: RelayId?
    public var dangerousPolicyPreservedInvariants: [String]?
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        connectionId: RelayId?,
        installId: RelayId?,
        agentId: RelayId?,
        policyPreset: MarketplaceActionPolicyPreset,
        permissions: [String: ProviderActionPermission],
        blockedReasons: [String: String],
        source: String,
        createdByActorId: RelayId,
        updatedByActorId: RelayId?,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        executionAuthority: MarketplaceExecutionAuthority? = nil,
        executionAuthorityVersion: String? = nil,
        dangerousPolicyAcknowledgementVersion: String? = nil,
        dangerousPolicyAcknowledgedAt: IsoTimestamp? = nil,
        dangerousPolicyAcknowledgedByActorId: RelayId? = nil,
        dangerousPolicyPreservedInvariants: [String]? = nil,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.connectionId = connectionId
        self.installId = installId
        self.agentId = agentId
        self.policyPreset = policyPreset
        self.permissions = permissions
        self.blockedReasons = blockedReasons
        self.source = source
        self.createdByActorId = createdByActorId
        self.updatedByActorId = updatedByActorId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.executionAuthority = executionAuthority
        self.executionAuthorityVersion = executionAuthorityVersion
        self.dangerousPolicyAcknowledgementVersion = dangerousPolicyAcknowledgementVersion
        self.dangerousPolicyAcknowledgedAt = dangerousPolicyAcknowledgedAt
        self.dangerousPolicyAcknowledgedByActorId = dangerousPolicyAcknowledgedByActorId
        self.dangerousPolicyPreservedInvariants = dangerousPolicyPreservedInvariants
        self.redactionStatus = redactionStatus
    }

    public var resolvedExecutionAuthority: MarketplaceExecutionAuthority? {
        guard executionAuthorityVersion == MarketplaceExecutionAuthority.contractVersion,
              let executionAuthority,
              executionAuthority != .unknown else { return nil }
        return executionAuthority
    }
}

public struct ProviderActionApprovalReference: Codable, Equatable, Sendable {
    public var approvalId: RelayId
    public var status: WorkSafetyApprovalStatus
    public var proposedPayloadHash: String
    public var expiresAt: IsoTimestamp?
    public var idempotencyKey: String
    public var executionId: RelayId?
    public var redactionStatus: String

    public init(
        approvalId: RelayId,
        status: WorkSafetyApprovalStatus,
        proposedPayloadHash: String,
        expiresAt: IsoTimestamp?,
        idempotencyKey: String,
        executionId: RelayId?,
        redactionStatus: String
    ) {
        self.approvalId = approvalId
        self.status = status
        self.proposedPayloadHash = proposedPayloadHash
        self.expiresAt = expiresAt
        self.idempotencyKey = idempotencyKey
        self.executionId = executionId
        self.redactionStatus = redactionStatus
    }
}

public struct MarketplaceProviderActionApprovalRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var appId: RelayId
    public var appSlug: String
    public var connectionId: RelayId?
    public var installId: RelayId?
    public var agentId: RelayId?
    public var providerActionId: RelayId
    public var actionKey: String
    public var proposedPayload: JSONRecord
    public var proposedPayloadHash: String
    public var status: WorkSafetyApprovalStatus
    public var requestedByActorId: RelayId
    public var requestedByAgentId: RelayId?
    public var resolvedByActorId: RelayId?
    public var expiresAt: IsoTimestamp?
    public var resolvedAt: IsoTimestamp?
    public var idempotencyKey: String
    public var executionId: RelayId?
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        connectionId: RelayId?,
        installId: RelayId?,
        agentId: RelayId?,
        providerActionId: RelayId,
        actionKey: String,
        proposedPayload: JSONRecord,
        proposedPayloadHash: String,
        status: WorkSafetyApprovalStatus,
        requestedByActorId: RelayId,
        requestedByAgentId: RelayId?,
        resolvedByActorId: RelayId?,
        expiresAt: IsoTimestamp?,
        resolvedAt: IsoTimestamp?,
        idempotencyKey: String,
        executionId: RelayId?,
        metadata: JSONRecord,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.connectionId = connectionId
        self.installId = installId
        self.agentId = agentId
        self.providerActionId = providerActionId
        self.actionKey = actionKey
        self.proposedPayload = proposedPayload
        self.proposedPayloadHash = proposedPayloadHash
        self.status = status
        self.requestedByActorId = requestedByActorId
        self.requestedByAgentId = requestedByAgentId
        self.resolvedByActorId = resolvedByActorId
        self.expiresAt = expiresAt
        self.resolvedAt = resolvedAt
        self.idempotencyKey = idempotencyKey
        self.executionId = executionId
        self.metadata = metadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct ProviderExecutionAuditIdentity: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var actorId: RelayId
    public var actorRole: String?
    public var agentId: RelayId?
    public var appId: RelayId
    public var appSlug: String
    public var connectionId: RelayId?
    public var installId: RelayId?
    public var approvalId: RelayId?
    public var dispatchId: RelayId?
    public var threadId: RelayId?
    public var source: String
    public var executionAuthority: MarketplaceExecutionAuthority?
    public var executionAuthorityVersion: String?
    public var redactionStatus: String

    public init(
        workspaceId: RelayId,
        actorId: RelayId,
        actorRole: String?,
        agentId: RelayId?,
        appId: RelayId,
        appSlug: String,
        connectionId: RelayId?,
        installId: RelayId?,
        approvalId: RelayId?,
        dispatchId: RelayId?,
        threadId: RelayId?,
        source: String,
        executionAuthority: MarketplaceExecutionAuthority? = nil,
        executionAuthorityVersion: String? = nil,
        redactionStatus: String
    ) {
        self.workspaceId = workspaceId
        self.actorId = actorId
        self.actorRole = actorRole
        self.agentId = agentId
        self.appId = appId
        self.appSlug = appSlug
        self.connectionId = connectionId
        self.installId = installId
        self.approvalId = approvalId
        self.dispatchId = dispatchId
        self.threadId = threadId
        self.source = source
        self.executionAuthority = executionAuthority
        self.executionAuthorityVersion = executionAuthorityVersion
        self.redactionStatus = redactionStatus
    }

    public var resolvedExecutionAuthority: MarketplaceExecutionAuthority? {
        guard executionAuthorityVersion == MarketplaceExecutionAuthority.contractVersion,
              let executionAuthority,
              executionAuthority != .unknown else { return nil }
        return executionAuthority
    }
}

public struct MarketplaceProviderActionExecutionRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var appId: RelayId
    public var appSlug: String
    public var connectionId: RelayId?
    public var installId: RelayId?
    public var agentId: RelayId?
    public var providerActionId: RelayId
    public var actionKey: String
    public var permission: ProviderActionPermission
    public var status: ProviderActionExecutionStatus
    public var idempotencyKey: String
    public var requestedPayload: JSONRecord
    public var approvedPayloadHash: String?
    public var approvalReference: ProviderActionApprovalReference?
    public var adapterKind: ProviderAdapterKind
    public var auditIdentity: ProviderExecutionAuditIdentity
    public var providerResult: JSONRecord?
    public var providerError: JSONRecord?
    public var startedAt: IsoTimestamp?
    public var completedAt: IsoTimestamp?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var executionAuthority: MarketplaceExecutionAuthority?
    public var executionAuthorityVersion: String?
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        connectionId: RelayId?,
        installId: RelayId?,
        agentId: RelayId?,
        providerActionId: RelayId,
        actionKey: String,
        permission: ProviderActionPermission,
        status: ProviderActionExecutionStatus,
        idempotencyKey: String,
        requestedPayload: JSONRecord,
        approvedPayloadHash: String?,
        approvalReference: ProviderActionApprovalReference?,
        adapterKind: ProviderAdapterKind,
        auditIdentity: ProviderExecutionAuditIdentity,
        providerResult: JSONRecord?,
        providerError: JSONRecord?,
        startedAt: IsoTimestamp?,
        completedAt: IsoTimestamp?,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        executionAuthority: MarketplaceExecutionAuthority? = nil,
        executionAuthorityVersion: String? = nil,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.connectionId = connectionId
        self.installId = installId
        self.agentId = agentId
        self.providerActionId = providerActionId
        self.actionKey = actionKey
        self.permission = permission
        self.status = status
        self.idempotencyKey = idempotencyKey
        self.requestedPayload = requestedPayload
        self.approvedPayloadHash = approvedPayloadHash
        self.approvalReference = approvalReference
        self.adapterKind = adapterKind
        self.auditIdentity = auditIdentity
        self.providerResult = providerResult
        self.providerError = providerError
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.executionAuthority = executionAuthority
        self.executionAuthorityVersion = executionAuthorityVersion
        self.redactionStatus = redactionStatus
    }

    public var resolvedExecutionAuthority: MarketplaceExecutionAuthority? {
        guard executionAuthorityVersion == MarketplaceExecutionAuthority.contractVersion,
              let executionAuthority,
              executionAuthority != .unknown else { return nil }
        return executionAuthority
    }
}

public struct MarketplaceInstallRoleDefinition: Identifiable, Codable, Equatable, Sendable {
    public var id: String { roleId }
    public var roleId: String
    public var label: String
    public var purpose: String
    public var canWrite: Bool
    public var readOnly: Bool
    public var approvalRequiredActions: [String]
    public var blockedActions: [String]
    public var required: Bool
    public var installAfterSetup: Bool
    public var installable: Bool
    public var notInstallableReason: String?
    public var recommendedAgentRole: String?
    public var source: String
    public var redactionStatus: String

    public init(
        roleId: String,
        label: String,
        purpose: String,
        canWrite: Bool,
        readOnly: Bool,
        approvalRequiredActions: [String],
        blockedActions: [String],
        required: Bool,
        installAfterSetup: Bool,
        installable: Bool,
        notInstallableReason: String?,
        recommendedAgentRole: String?,
        source: String,
        redactionStatus: String
    ) {
        self.roleId = roleId
        self.label = label
        self.purpose = purpose
        self.canWrite = canWrite
        self.readOnly = readOnly
        self.approvalRequiredActions = approvalRequiredActions
        self.blockedActions = blockedActions
        self.required = required
        self.installAfterSetup = installAfterSetup
        self.installable = installable
        self.notInstallableReason = notInstallableReason
        self.recommendedAgentRole = recommendedAgentRole
        self.source = source
        self.redactionStatus = redactionStatus
    }
}

public struct MarketplaceCompatibleAgentTarget: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId { agentId }
    public var agentId: RelayId
    public var agentName: String
    public var agentRole: String?
    public var runtimeBindingId: RelayId
    public var harnessId: RelayId
    public var runtimeType: RuntimeType
    public var status: MarketplaceAgentCompatibilityStatus
    public var supportedRoles: [String]
    public var unavailableReason: String?
    public var existingInstallId: RelayId?
    public var redactionStatus: String

    public init(
        agentId: RelayId,
        agentName: String,
        agentRole: String?,
        runtimeBindingId: RelayId,
        harnessId: RelayId,
        runtimeType: RuntimeType,
        status: MarketplaceAgentCompatibilityStatus,
        supportedRoles: [String],
        unavailableReason: String?,
        existingInstallId: RelayId?,
        redactionStatus: String
    ) {
        self.agentId = agentId
        self.agentName = agentName
        self.agentRole = agentRole
        self.runtimeBindingId = runtimeBindingId
        self.harnessId = harnessId
        self.runtimeType = runtimeType
        self.status = status
        self.supportedRoles = supportedRoles
        self.unavailableReason = unavailableReason
        self.existingInstallId = existingInstallId
        self.redactionStatus = redactionStatus
    }
}

public struct MarketplaceInstallRequest: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var appId: RelayId
    public var appSlug: String
    public var connectionId: RelayId?
    public var targetAgentId: RelayId
    public var roleId: String
    public var selectedCapabilities: [String]
    public var approvalProfileId: RelayId?
    public var runtimeFormat: RuntimeType
    public var targetMode: MarketplaceInstallTargetMode
    public var riskAcknowledged: Bool
    public var acknowledgeDangerouslySkipPermissions: Bool?
    public var metadata: JSONRecord
    public var requestedByActorId: RelayId
    public var requestedAt: IsoTimestamp
    public var executionAuthority: MarketplaceExecutionAuthority?
    public var executionAuthorityVersion: String?
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        connectionId: RelayId?,
        targetAgentId: RelayId,
        roleId: String,
        selectedCapabilities: [String],
        approvalProfileId: RelayId?,
        runtimeFormat: RuntimeType,
        targetMode: MarketplaceInstallTargetMode,
        riskAcknowledged: Bool,
        acknowledgeDangerouslySkipPermissions: Bool = false,
        metadata: JSONRecord,
        requestedByActorId: RelayId,
        requestedAt: IsoTimestamp,
        executionAuthority: MarketplaceExecutionAuthority? = nil,
        executionAuthorityVersion: String? = nil,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.connectionId = connectionId
        self.targetAgentId = targetAgentId
        self.roleId = roleId
        self.selectedCapabilities = selectedCapabilities
        self.approvalProfileId = approvalProfileId
        self.runtimeFormat = runtimeFormat
        self.targetMode = targetMode
        self.riskAcknowledged = riskAcknowledged
        self.acknowledgeDangerouslySkipPermissions = acknowledgeDangerouslySkipPermissions
        self.metadata = metadata
        self.requestedByActorId = requestedByActorId
        self.requestedAt = requestedAt
        self.executionAuthority = executionAuthority
        self.executionAuthorityVersion = executionAuthorityVersion
        self.redactionStatus = redactionStatus
    }

    public var resolvedExecutionAuthority: MarketplaceExecutionAuthority? {
        guard executionAuthorityVersion == MarketplaceExecutionAuthority.contractVersion,
              let executionAuthority,
              executionAuthority != .unknown else { return nil }
        return executionAuthority
    }
}

public struct MarketplaceInstallRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var appId: RelayId
    public var appSlug: String
    public var connectionId: RelayId?
    public var agentId: RelayId
    public var agentName: String
    public var runtimeBindingId: RelayId
    public var harnessId: RelayId
    public var runtimeType: RuntimeType
    public var roleId: String
    public var roleLabel: String
    public var selectedCapabilities: [String]
    public var approvalProfileId: RelayId?
    public var runtimeFormat: RuntimeType
    public var targetMode: MarketplaceInstallTargetMode
    public var riskAcknowledged: Bool
    public var installStatus: MarketplaceInstallLifecycleStatus
    public var driftStatus: MarketplaceInstallDriftStatus
    public var lastInstalledAt: IsoTimestamp?
    public var removedAt: IsoTimestamp?
    public var failureMessage: String?
    public var metadata: JSONRecord
    public var createdByActorId: RelayId
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var executionAuthority: MarketplaceExecutionAuthority?
    public var executionAuthorityVersion: String?
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        connectionId: RelayId?,
        agentId: RelayId,
        agentName: String,
        runtimeBindingId: RelayId,
        harnessId: RelayId,
        runtimeType: RuntimeType,
        roleId: String,
        roleLabel: String,
        selectedCapabilities: [String],
        approvalProfileId: RelayId?,
        runtimeFormat: RuntimeType,
        targetMode: MarketplaceInstallTargetMode,
        riskAcknowledged: Bool,
        installStatus: MarketplaceInstallLifecycleStatus,
        driftStatus: MarketplaceInstallDriftStatus,
        lastInstalledAt: IsoTimestamp?,
        removedAt: IsoTimestamp?,
        failureMessage: String?,
        metadata: JSONRecord,
        createdByActorId: RelayId,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        executionAuthority: MarketplaceExecutionAuthority? = nil,
        executionAuthorityVersion: String? = nil,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.connectionId = connectionId
        self.agentId = agentId
        self.agentName = agentName
        self.runtimeBindingId = runtimeBindingId
        self.harnessId = harnessId
        self.runtimeType = runtimeType
        self.roleId = roleId
        self.roleLabel = roleLabel
        self.selectedCapabilities = selectedCapabilities
        self.approvalProfileId = approvalProfileId
        self.runtimeFormat = runtimeFormat
        self.targetMode = targetMode
        self.riskAcknowledged = riskAcknowledged
        self.installStatus = installStatus
        self.driftStatus = driftStatus
        self.lastInstalledAt = lastInstalledAt
        self.removedAt = removedAt
        self.failureMessage = failureMessage
        self.metadata = metadata
        self.createdByActorId = createdByActorId
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.executionAuthority = executionAuthority
        self.executionAuthorityVersion = executionAuthorityVersion
        self.redactionStatus = redactionStatus
    }

    public var resolvedExecutionAuthority: MarketplaceExecutionAuthority? {
        guard executionAuthorityVersion == MarketplaceExecutionAuthority.contractVersion,
              let executionAuthority,
              executionAuthority != .unknown else { return nil }
        return executionAuthority
    }
}

public struct MarketplaceInstallDiagnostics: Codable, Equatable, Sendable {
    public var compatibleAgentSummary: String
    public var installSummary: String
    public var driftSummary: String
    public var runtimeWriteSummary: String
    public var removalSummary: String
    public var message: String

    public init(
        compatibleAgentSummary: String,
        installSummary: String,
        driftSummary: String,
        runtimeWriteSummary: String,
        removalSummary: String,
        message: String
    ) {
        self.compatibleAgentSummary = compatibleAgentSummary
        self.installSummary = installSummary
        self.driftSummary = driftSummary
        self.runtimeWriteSummary = runtimeWriteSummary
        self.removalSummary = removalSummary
        self.message = message
    }
}

public struct MarketplaceInstallSnapshot: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var appId: RelayId?
    public var appSlug: String?
    public var state: MarketplaceInstallSnapshotState
    public var refreshedAt: IsoTimestamp
    public var installs: [MarketplaceInstallRecord]
    public var compatibleAgents: [MarketplaceCompatibleAgentTarget]
    public var selectedInstall: MarketplaceInstallRecord?
    public var diagnostics: MarketplaceInstallDiagnostics
    public var readOnly: Bool
    public var redactionStatus: String

    public init(
        workspaceId: RelayId,
        appId: RelayId?,
        appSlug: String?,
        state: MarketplaceInstallSnapshotState,
        refreshedAt: IsoTimestamp,
        installs: [MarketplaceInstallRecord],
        compatibleAgents: [MarketplaceCompatibleAgentTarget],
        selectedInstall: MarketplaceInstallRecord?,
        diagnostics: MarketplaceInstallDiagnostics,
        readOnly: Bool,
        redactionStatus: String
    ) {
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.state = state
        self.refreshedAt = refreshedAt
        self.installs = installs
        self.compatibleAgents = compatibleAgents
        self.selectedInstall = selectedInstall
        self.diagnostics = diagnostics
        self.readOnly = readOnly
        self.redactionStatus = redactionStatus
    }
}

public struct MarketplaceRoleManifest: Codable, Equatable, Sendable {
    public var primaryRole: String
    public var supportedRoles: [String]
    public var compatibleRuntimeTypes: [RuntimeType]
    public var approvalRequired: Bool
    public var roleDefinitions: [MarketplaceInstallRoleDefinition]?
    public var redactionStatus: String

    public init(
        primaryRole: String,
        supportedRoles: [String],
        compatibleRuntimeTypes: [RuntimeType],
        approvalRequired: Bool,
        roleDefinitions: [MarketplaceInstallRoleDefinition]? = nil,
        redactionStatus: String
    ) {
        self.primaryRole = primaryRole
        self.supportedRoles = supportedRoles
        self.compatibleRuntimeTypes = compatibleRuntimeTypes
        self.approvalRequired = approvalRequired
        self.roleDefinitions = roleDefinitions
        self.redactionStatus = redactionStatus
    }
}

public struct MarketplaceIconFallback: Codable, Equatable, Sendable {
    public var initials: String
    public var colorName: String
    public var source: String

    public init(initials: String, colorName: String, source: String) {
        self.initials = initials
        self.colorName = colorName
        self.source = source
    }
}

public struct MarketplaceCatalogCredentialOption: Codable, Equatable, Sendable {
    public var value: String
    public var label: String

    public init(value: String, label: String) {
        self.value = value
        self.label = label
    }
}

public struct MarketplaceCatalogCredentialRequirement: Identifiable, Codable, Equatable, Sendable {
    public var name: String
    public var label: String
    public var required: Bool
    public var secret: Bool
    public var helpText: String
    public var requiredForAuthTypes: [String]?
    public var inputType: String?
    public var options: [MarketplaceCatalogCredentialOption]?
    public var defaultValue: String?

    public var id: String { name }

    public init(
        name: String,
        label: String,
        required: Bool,
        secret: Bool,
        helpText: String,
        requiredForAuthTypes: [String]? = nil,
        inputType: String? = nil,
        options: [MarketplaceCatalogCredentialOption]? = nil,
        defaultValue: String? = nil
    ) {
        self.name = name
        self.label = label
        self.required = required
        self.secret = secret
        self.helpText = helpText
        self.requiredForAuthTypes = requiredForAuthTypes
        self.inputType = inputType
        self.options = options
        self.defaultValue = defaultValue
    }
}

public struct MarketplaceOAuthAccessOption: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var label: String
    public var description: String
    public var scopes: [String]
    public var capabilityIds: [String]
    public var defaultSelected: Bool

    public init(
        id: String,
        label: String,
        description: String,
        scopes: [String],
        capabilityIds: [String],
        defaultSelected: Bool
    ) {
        self.id = id
        self.label = label
        self.description = description
        self.scopes = scopes
        self.capabilityIds = capabilityIds
        self.defaultSelected = defaultSelected
    }
}

public struct MarketplaceCatalogApp: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var slug: String
    public var name: String
    public var summary: String
    public var description: String
    public var category: String
    public var sourceType: MarketplaceAppSourceType
    public var riskLevel: MarketplaceRiskLevel
    public var authType: String
    public var connectionType: String
    public var connectionTypes: [String]?
    public var credentialRequirements: [MarketplaceCatalogCredentialRequirement]?
    public var oauthAccessOptions: [MarketplaceOAuthAccessOption]?
    public var capabilities: [String]
    public var capabilityIds: [String]?
    public var runtimeSupport: [RuntimeType]
    public var roleManifest: MarketplaceRoleManifest
    public var availability: MarketplaceAppAvailabilityState
    public var availabilityReason: String?
    public var connectionState: MarketplaceConnectionState
    public var installState: MarketplaceInstallState
    public var installedAgentCount: Int
    public var installedAgentIds: [RelayId]
    public var docsURL: String?
    public var websiteURL: String?
    public var accountCreationURL: String?
    public var betaNotice: String?
    public var iconFallback: MarketplaceIconFallback
    public var readOnly: Bool
    public var localAppExcluded: Bool
    public var reviewExcluded: Bool
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        slug: String,
        name: String,
        summary: String,
        description: String,
        category: String,
        sourceType: MarketplaceAppSourceType,
        riskLevel: MarketplaceRiskLevel,
        authType: String,
        connectionType: String,
        connectionTypes: [String] = [],
        credentialRequirements: [MarketplaceCatalogCredentialRequirement] = [],
        oauthAccessOptions: [MarketplaceOAuthAccessOption] = [],
        capabilities: [String],
        capabilityIds: [String] = [],
        runtimeSupport: [RuntimeType],
        roleManifest: MarketplaceRoleManifest,
        availability: MarketplaceAppAvailabilityState,
        availabilityReason: String?,
        connectionState: MarketplaceConnectionState,
        installState: MarketplaceInstallState,
        installedAgentCount: Int,
        installedAgentIds: [RelayId],
        docsURL: String?,
        websiteURL: String?,
        accountCreationURL: String? = nil,
        betaNotice: String?,
        iconFallback: MarketplaceIconFallback,
        readOnly: Bool,
        localAppExcluded: Bool,
        reviewExcluded: Bool,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.slug = slug
        self.name = name
        self.summary = summary
        self.description = description
        self.category = category
        self.sourceType = sourceType
        self.riskLevel = riskLevel
        self.authType = authType
        self.connectionType = connectionType
        self.connectionTypes = connectionTypes
        self.credentialRequirements = credentialRequirements
        self.oauthAccessOptions = oauthAccessOptions
        self.capabilities = capabilities
        self.capabilityIds = capabilityIds
        self.runtimeSupport = runtimeSupport
        self.roleManifest = roleManifest
        self.availability = availability
        self.availabilityReason = availabilityReason
        self.connectionState = connectionState
        self.installState = installState
        self.installedAgentCount = installedAgentCount
        self.installedAgentIds = installedAgentIds
        self.docsURL = docsURL
        self.websiteURL = websiteURL
        self.accountCreationURL = accountCreationURL
        self.betaNotice = betaNotice
        self.iconFallback = iconFallback
        self.readOnly = readOnly
        self.localAppExcluded = localAppExcluded
        self.reviewExcluded = reviewExcluded
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct ApplicationsCatalogTab: Identifiable, Codable, Equatable, Sendable {
    public var id: String { view.rawValue }
    public var view: ApplicationsCatalogView
    public var label: String
    public var count: Int
    public var enabled: Bool
    public var stateKind: GuardedStateKind?
    public var reasonCode: GuardReasonCode?
    public var message: String?
    public var visibleToRoles: [ServiceRole]

    public init(
        view: ApplicationsCatalogView,
        label: String,
        count: Int,
        enabled: Bool,
        stateKind: GuardedStateKind?,
        reasonCode: GuardReasonCode?,
        message: String?,
        visibleToRoles: [ServiceRole]
    ) {
        self.view = view
        self.label = label
        self.count = count
        self.enabled = enabled
        self.stateKind = stateKind
        self.reasonCode = reasonCode
        self.message = message
        self.visibleToRoles = visibleToRoles
    }
}

public struct ApplicationsCatalogFilter: Codable, Equatable, Sendable {
    public var view: ApplicationsCatalogView
    public var searchQuery: String
    public var category: String?
    public var riskLevel: MarketplaceRiskLevel?

    public init(
        view: ApplicationsCatalogView,
        searchQuery: String,
        category: String?,
        riskLevel: MarketplaceRiskLevel?
    ) {
        self.view = view
        self.searchQuery = searchQuery
        self.category = category
        self.riskLevel = riskLevel
    }
}

public struct ApplicationsCatalogDiagnostics: Codable, Equatable, Sendable {
    public var endpointLabel: String
    public var responseCount: Int
    public var selectedCategory: String
    public var riskFilter: String
    public var searchQuery: String
    public var demoFallbackUsed: Bool
    public var message: String

    public init(
        endpointLabel: String,
        responseCount: Int,
        selectedCategory: String,
        riskFilter: String,
        searchQuery: String,
        demoFallbackUsed: Bool,
        message: String
    ) {
        self.endpointLabel = endpointLabel
        self.responseCount = responseCount
        self.selectedCategory = selectedCategory
        self.riskFilter = riskFilter
        self.searchQuery = searchQuery
        self.demoFallbackUsed = demoFallbackUsed
        self.message = message
    }
}

public struct ApplicationsCatalogSnapshot: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var state: ApplicationsCatalogState
    public var refreshedAt: IsoTimestamp
    public var filter: ApplicationsCatalogFilter
    public var tabs: [ApplicationsCatalogTab]
    public var categories: [String]
    public var riskLevels: [MarketplaceRiskLevel]
    public var apps: [MarketplaceCatalogApp]
    public var selectedApp: MarketplaceCatalogApp?
    public var diagnostics: ApplicationsCatalogDiagnostics
    public var betaNotice: String
    public var readOnly: Bool
    public var redactionStatus: String
    public var nextCursor: String?
    public var totalCount: Int?

    public init(
        workspaceId: RelayId,
        state: ApplicationsCatalogState,
        refreshedAt: IsoTimestamp,
        filter: ApplicationsCatalogFilter,
        tabs: [ApplicationsCatalogTab],
        categories: [String],
        riskLevels: [MarketplaceRiskLevel],
        apps: [MarketplaceCatalogApp],
        selectedApp: MarketplaceCatalogApp?,
        diagnostics: ApplicationsCatalogDiagnostics,
        betaNotice: String,
        readOnly: Bool,
        redactionStatus: String,
        nextCursor: String? = nil,
        totalCount: Int? = nil
    ) {
        self.workspaceId = workspaceId
        self.state = state
        self.refreshedAt = refreshedAt
        self.filter = filter
        self.tabs = tabs
        self.categories = categories
        self.riskLevels = riskLevels
        self.apps = apps
        self.selectedApp = selectedApp
        self.diagnostics = diagnostics
        self.betaNotice = betaNotice
        self.readOnly = readOnly
        self.redactionStatus = redactionStatus
        self.nextCursor = nextCursor
        self.totalCount = totalCount
    }
}

public struct AgentOpsRuntimeOverviewSummary: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId { agentId }
    public var agentId: RelayId
    public var runtimeType: RuntimeType
    public var harnessDisplayName: String
    public var harnessLifecycleState: HarnessLifecycleState?
    public var harnessHealthStatus: HarnessHealthStatus?
    public var activeDispatchCount: Int
    public var queuedTaskCount: Int
    public var waitingApprovalCount: Int
    public var latestDispatchId: RelayId?
    public var latestTaskId: RelayId?
    public var latestThreadId: RelayId?
    public var latestMessageId: RelayId?
    public var redactedContext: String
    public var updatedAt: IsoTimestamp
}

public struct AgentOpsLiveAgentState: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId { agentId }
    public var agentId: RelayId
    public var agentName: String
    public var groupType: AgentGroupType?
    public var departmentId: RelayId?
    public var departmentName: String?
    public var teamId: RelayId?
    public var teamName: String?
    public var roomId: String?
    public var realState: AgentOpsLiveState
    public var visibleState: AgentOpsLiveState
    public var source: AgentOpsLiveStateSource
    public var confidence: AgentOpsLiveStateConfidence
    public var dispatchId: RelayId?
    public var taskId: RelayId?
    public var threadId: RelayId?
    public var messageId: RelayId?
    public var reason: String
    public var expiresAt: IsoTimestamp?
    public var updatedAt: IsoTimestamp
    public var visualFallbackOnly: Bool
    public var runtimeOverview: AgentOpsRuntimeOverviewSummary
}

public struct AgentOpsEventFeedItem: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var kind: String
    public var title: String
    public var summary: String
    public var severity: String
    public var agentId: RelayId?
    public var dispatchId: RelayId?
    public var taskId: RelayId?
    public var threadId: RelayId?
    public var messageId: RelayId?
    public var createdAt: IsoTimestamp
    public var redactionStatus: String
}

public struct AgentOpsRuntimeOverviewSnapshot: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var refreshedAt: IsoTimestamp
    public var adminGuard: String
    public var activeDispatchCount: Int
    public var queuedTaskCount: Int
    public var waitingApprovalCount: Int
    public var errorCount: Int
    public var summaries: [AgentOpsRuntimeOverviewSummary]
}

public struct AgentOpsLiveStateSnapshot: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var refreshedAt: IsoTimestamp
    public var derivedFrom: [AgentOpsLiveStateSource]
    public var selectedAgentIds: [RelayId]
    public var agents: [AgentOpsLiveAgentState]
    public var events: [AgentOpsEventFeedItem]
    public var runtimeOverview: AgentOpsRuntimeOverviewSnapshot
    public var activeCount: Int
    public var waitingApprovalCount: Int
    public var errorCount: Int
    public var visualFallbackCount: Int
}

public struct AgentOpsVisualSceneSnapshot: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var refreshedAt: IsoTimestamp
    public var sourceSnapshotRefreshedAt: IsoTimestamp
    public var activeFloorId: RelayId
    public var selectedEntityId: RelayId?
    public var floors: [AgentOpsVisualFloor]
    public var rooms: [AgentOpsVisualRoom]
    public var entities: [AgentOpsVisualEntity]
    public var connections: [AgentOpsVisualConnection]
    public var summary: AgentOpsVisualSceneSummary
    public var assetStrategy: String
    public var layoutPersistenceStatus: String
    public var redactionStatus: String
    public var unavailableReasons: [String]
}

public struct AgentProvisioningJob: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var requestedByProfileId: RelayId?
    public var harnessId: RelayId?
    public var runtimeType: RuntimeType
    public var status: AgentProvisioningStatus
    public var stage: String?
    public var message: String?
    public var error: JSONRecord?
    public var createdAgentId: RelayId?
    public var runtimeBindingId: RelayId?
    public var externalAgentId: String?
    public var payload: JSONRecord
    public var filesMetadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var completedAt: IsoTimestamp?
}

public struct AgentPreferences: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var agentId: RelayId
    public var cosmeticDisplayName: String?
    public var avatarReference: String?
    public var avatarState: AgentAvatarState
    public var responsePresentation: AgentResponsePresentation
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct ThreadSummary: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var title: String
    public var threadType: ThreadType
    public var selectedAgentId: RelayId?
    public var activeSessionId: RelayId?
    public var status: String
    public var readState: ThreadReadStateValue
    public var unreadCount: Int
    public var isArchived: Bool
    public var archivedAt: IsoTimestamp?
    public var lastReadAt: IsoTimestamp?
    public var latestWrapUpReportId: RelayId?
    public var lastMessageSnippet: String?
    public var lastMessageAt: IsoTimestamp?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp

    public init(
        id: RelayId,
        workspaceId: RelayId,
        title: String,
        threadType: ThreadType = .direct,
        selectedAgentId: RelayId? = nil,
        activeSessionId: RelayId? = nil,
        status: String,
        readState: ThreadReadStateValue = .read,
        unreadCount: Int = 0,
        isArchived: Bool = false,
        archivedAt: IsoTimestamp? = nil,
        lastReadAt: IsoTimestamp? = nil,
        latestWrapUpReportId: RelayId? = nil,
        lastMessageSnippet: String? = nil,
        lastMessageAt: IsoTimestamp? = nil,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.title = title
        self.threadType = threadType
        self.selectedAgentId = selectedAgentId
        self.activeSessionId = activeSessionId
        self.status = status
        self.readState = readState
        self.unreadCount = unreadCount
        self.isArchived = isArchived
        self.archivedAt = archivedAt
        self.lastReadAt = lastReadAt
        self.latestWrapUpReportId = latestWrapUpReportId
        self.lastMessageSnippet = lastMessageSnippet
        self.lastMessageAt = lastMessageAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case workspaceId
        case title
        case threadType
        case selectedAgentId
        case activeSessionId
        case status
        case readState
        case unreadCount
        case isArchived
        case archivedAt
        case lastReadAt
        case latestWrapUpReportId
        case lastMessageSnippet
        case lastMessageAt
        case createdAt
        case updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(RelayId.self, forKey: .id)
        self.workspaceId = try container.decode(RelayId.self, forKey: .workspaceId)
        self.title = try container.decode(String.self, forKey: .title)
        self.threadType = try container.decodeIfPresent(ThreadType.self, forKey: .threadType) ?? .direct
        self.selectedAgentId = try container.decodeIfPresent(RelayId.self, forKey: .selectedAgentId)
        self.activeSessionId = try container.decodeIfPresent(RelayId.self, forKey: .activeSessionId)
        let decodedStatus = try container.decode(String.self, forKey: .status)
        self.status = decodedStatus
        self.readState = try container.decodeIfPresent(ThreadReadStateValue.self, forKey: .readState) ?? .read
        self.unreadCount = try container.decodeIfPresent(Int.self, forKey: .unreadCount) ?? 0
        self.isArchived = (try container.decodeIfPresent(Bool.self, forKey: .isArchived)) ?? (decodedStatus == "archived")
        self.archivedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .archivedAt)
        self.lastReadAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .lastReadAt)
        self.latestWrapUpReportId = try container.decodeIfPresent(RelayId.self, forKey: .latestWrapUpReportId)
        self.lastMessageSnippet = try container.decodeIfPresent(String.self, forKey: .lastMessageSnippet)
        self.lastMessageAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .lastMessageAt)
        self.createdAt = try container.decode(IsoTimestamp.self, forKey: .createdAt)
        self.updatedAt = try container.decode(IsoTimestamp.self, forKey: .updatedAt)
    }
}

public struct ThreadDetail: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var title: String
    public var threadType: ThreadType
    public var selectedAgentId: RelayId?
    public var activeSessionId: RelayId?
    public var status: String
    public var readState: ThreadReadStateValue
    public var unreadCount: Int
    public var isArchived: Bool
    public var archivedAt: IsoTimestamp?
    public var lastReadAt: IsoTimestamp?
    public var latestWrapUpReportId: RelayId?
    public var lastMessageSnippet: String?
    public var lastMessageAt: IsoTimestamp?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var participants: [ThreadParticipant]
    public var sessions: [ChatSession]
    public var readStates: [ThreadReadState]
    public var wrapUpReports: [ThreadWrapUpReport]
    public var messages: [Message]

    public init(
        id: RelayId,
        workspaceId: RelayId,
        title: String,
        threadType: ThreadType = .direct,
        selectedAgentId: RelayId? = nil,
        activeSessionId: RelayId? = nil,
        status: String,
        readState: ThreadReadStateValue = .read,
        unreadCount: Int = 0,
        isArchived: Bool = false,
        archivedAt: IsoTimestamp? = nil,
        lastReadAt: IsoTimestamp? = nil,
        latestWrapUpReportId: RelayId? = nil,
        lastMessageSnippet: String? = nil,
        lastMessageAt: IsoTimestamp? = nil,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        participants: [ThreadParticipant] = [],
        sessions: [ChatSession] = [],
        readStates: [ThreadReadState] = [],
        wrapUpReports: [ThreadWrapUpReport] = [],
        messages: [Message]
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.title = title
        self.threadType = threadType
        self.selectedAgentId = selectedAgentId
        self.activeSessionId = activeSessionId
        self.status = status
        self.readState = readState
        self.unreadCount = unreadCount
        self.isArchived = isArchived
        self.archivedAt = archivedAt
        self.lastReadAt = lastReadAt
        self.latestWrapUpReportId = latestWrapUpReportId
        self.lastMessageSnippet = lastMessageSnippet
        self.lastMessageAt = lastMessageAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.participants = participants
        self.sessions = sessions
        self.readStates = readStates
        self.wrapUpReports = wrapUpReports
        self.messages = messages
    }

    enum CodingKeys: String, CodingKey {
        case id
        case workspaceId
        case title
        case threadType
        case selectedAgentId
        case activeSessionId
        case status
        case readState
        case unreadCount
        case isArchived
        case archivedAt
        case lastReadAt
        case latestWrapUpReportId
        case lastMessageSnippet
        case lastMessageAt
        case createdAt
        case updatedAt
        case participants
        case sessions
        case readStates
        case wrapUpReports
        case messages
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(RelayId.self, forKey: .id)
        self.workspaceId = try container.decode(RelayId.self, forKey: .workspaceId)
        self.title = try container.decode(String.self, forKey: .title)
        self.threadType = try container.decodeIfPresent(ThreadType.self, forKey: .threadType) ?? .direct
        self.selectedAgentId = try container.decodeIfPresent(RelayId.self, forKey: .selectedAgentId)
        self.activeSessionId = try container.decodeIfPresent(RelayId.self, forKey: .activeSessionId)
        let decodedStatus = try container.decode(String.self, forKey: .status)
        self.status = decodedStatus
        self.readState = try container.decodeIfPresent(ThreadReadStateValue.self, forKey: .readState) ?? .read
        self.unreadCount = try container.decodeIfPresent(Int.self, forKey: .unreadCount) ?? 0
        self.isArchived = (try container.decodeIfPresent(Bool.self, forKey: .isArchived)) ?? (decodedStatus == "archived")
        self.archivedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .archivedAt)
        self.lastReadAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .lastReadAt)
        self.latestWrapUpReportId = try container.decodeIfPresent(RelayId.self, forKey: .latestWrapUpReportId)
        self.lastMessageSnippet = try container.decodeIfPresent(String.self, forKey: .lastMessageSnippet)
        self.lastMessageAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .lastMessageAt)
        self.createdAt = try container.decode(IsoTimestamp.self, forKey: .createdAt)
        self.updatedAt = try container.decode(IsoTimestamp.self, forKey: .updatedAt)
        self.participants = try container.decodeIfPresent([ThreadParticipant].self, forKey: .participants) ?? []
        self.sessions = try container.decodeIfPresent([ChatSession].self, forKey: .sessions) ?? []
        self.readStates = try container.decodeIfPresent([ThreadReadState].self, forKey: .readStates) ?? []
        self.wrapUpReports = try container.decodeIfPresent([ThreadWrapUpReport].self, forKey: .wrapUpReports) ?? []
        self.messages = try container.decode([Message].self, forKey: .messages)
    }
}

public struct Message: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var threadId: RelayId
    public var threadSessionId: RelayId?
    public var senderType: SenderType
    public var senderId: RelayId?
    public var senderName: String
    public var content: String
    public var contentFormat: MessageFormat
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp

    public init(
        id: RelayId,
        threadId: RelayId,
        threadSessionId: RelayId? = nil,
        senderType: SenderType,
        senderId: RelayId? = nil,
        senderName: String,
        content: String,
        contentFormat: MessageFormat,
        metadata: JSONRecord,
        createdAt: IsoTimestamp
    ) {
        self.id = id
        self.threadId = threadId
        self.threadSessionId = threadSessionId
        self.senderType = senderType
        self.senderId = senderId
        self.senderName = senderName
        self.content = content
        self.contentFormat = contentFormat
        self.metadata = metadata
        self.createdAt = createdAt
    }

    enum CodingKeys: String, CodingKey {
        case id
        case threadId
        case threadSessionId
        case senderType
        case senderId
        case senderName
        case content
        case contentFormat
        case metadata
        case createdAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(RelayId.self, forKey: .id)
        self.threadId = try container.decode(RelayId.self, forKey: .threadId)
        self.threadSessionId = try container.decodeIfPresent(RelayId.self, forKey: .threadSessionId)
        self.senderType = try container.decode(SenderType.self, forKey: .senderType)
        self.senderId = try container.decodeIfPresent(RelayId.self, forKey: .senderId)
        self.senderName = try container.decode(String.self, forKey: .senderName)
        self.content = try container.decode(String.self, forKey: .content)
        self.contentFormat = try container.decodeIfPresent(MessageFormat.self, forKey: .contentFormat) ?? .plain
        self.metadata = try container.decodeIfPresent(JSONRecord.self, forKey: .metadata) ?? [:]
        self.createdAt = try container.decode(IsoTimestamp.self, forKey: .createdAt)
    }
}

public struct MessageCursor: Equatable, Sendable {
    public var createdAt: IsoTimestamp
    public var id: RelayId

    public init(createdAt: IsoTimestamp, id: RelayId) {
        self.createdAt = createdAt
        self.id = id
    }

    public init(message: Message) {
        self.init(createdAt: message.createdAt, id: message.id)
    }
}

public struct MessagePage: Equatable, Sendable {
    public var messages: [Message]
    public var hasOlder: Bool
    public var hasNewer: Bool

    public init(messages: [Message], hasOlder: Bool, hasNewer: Bool) {
        self.messages = messages
        self.hasOlder = hasOlder
        self.hasNewer = hasNewer
    }
}

public struct ChatComposerDraft: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var threadId: RelayId
    public var profileId: RelayId?
    public var content: String
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp

    public init(
        id: RelayId,
        threadId: RelayId,
        profileId: RelayId? = nil,
        content: String,
        metadata: JSONRecord = [:],
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp
    ) {
        self.id = id
        self.threadId = threadId
        self.profileId = profileId
        self.content = content
        self.metadata = metadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

public struct ChatMentionAvailability: Codable, Equatable, Sendable {
    public var isAvailable: Bool
    public var reasonCode: GuardReasonCode?
    public var message: String
    public var help: String?

    public init(
        isAvailable: Bool,
        reasonCode: GuardReasonCode? = nil,
        message: String,
        help: String? = nil
    ) {
        self.isAvailable = isAvailable
        self.reasonCode = reasonCode
        self.message = message
        self.help = help
    }
}

public struct ChatAttachment: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var threadId: RelayId
    public var messageId: RelayId?
    public var profileId: RelayId?
    public var fileName: String
    public var mimeType: String
    public var byteSize: Int
    public var sha256: String
    public var kind: ChatAttachmentKind
    public var status: ChatAttachmentStatus
    public var progress: Int
    public var provenance: JSONRecord
    public var error: JSONRecord?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp

    public init(
        id: RelayId,
        threadId: RelayId,
        messageId: RelayId? = nil,
        profileId: RelayId? = nil,
        fileName: String,
        mimeType: String,
        byteSize: Int,
        sha256: String,
        kind: ChatAttachmentKind,
        status: ChatAttachmentStatus,
        progress: Int = 0,
        provenance: JSONRecord = [:],
        error: JSONRecord? = nil,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp
    ) {
        self.id = id
        self.threadId = threadId
        self.messageId = messageId
        self.profileId = profileId
        self.fileName = fileName
        self.mimeType = mimeType
        self.byteSize = byteSize
        self.sha256 = sha256
        self.kind = kind
        self.status = status
        self.progress = progress
        self.provenance = provenance
        self.error = error
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    public var metadataSummary: JSONRecord {
        [
            "id": .string(id),
            "fileName": .string(fileName),
            "mimeType": .string(mimeType),
            "byteSize": .number(Double(byteSize)),
            "sha256": .string(sha256),
            "kind": .string(kind.rawValue),
            "status": .string(status.rawValue),
            "progress": .number(Double(progress)),
            "provenance": .object(provenance)
        ]
    }
}

public struct ChatDocumentReference: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var messageId: RelayId
    public var title: String
    public var referenceKind: ChatDocumentReferenceKind
    public var displayPath: String?
    public var tokenCount: Int?
    public var isSensitive: Bool
    public var isRedacted: Bool
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp

    public init(
        id: RelayId,
        messageId: RelayId,
        title: String,
        referenceKind: ChatDocumentReferenceKind,
        displayPath: String? = nil,
        tokenCount: Int? = nil,
        isSensitive: Bool = false,
        isRedacted: Bool = false,
        metadata: JSONRecord = [:],
        createdAt: IsoTimestamp
    ) {
        self.id = id
        self.messageId = messageId
        self.title = title
        self.referenceKind = referenceKind
        self.displayPath = displayPath
        self.tokenCount = tokenCount
        self.isSensitive = isSensitive
        self.isRedacted = isRedacted
        self.metadata = metadata
        self.createdAt = createdAt
    }

    public var metadataSummary: JSONRecord {
        [
            "id": .string(id),
            "title": .string(isRedacted ? "[REDACTED]" : title),
            "referenceKind": .string(referenceKind.rawValue),
            "displayPath": displayPath.map { .string(isRedacted ? "[REDACTED]" : $0) } ?? .null,
            "tokenCount": tokenCount.map { .number(Double($0)) } ?? .null,
            "isSensitive": .bool(isSensitive),
            "isRedacted": .bool(isRedacted)
        ]
    }
}

public struct ChatSession: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var threadId: RelayId
    public var sequenceNumber: Int
    public var status: ThreadSessionStatus
    public var isReadOnly: Bool
    public var relayRunState: TeamRelayRunState
    public var relayPauseReason: TeamRelayPauseReason?
    public var relayReplyLimit: Int
    public var startedAt: IsoTimestamp
    public var endedAt: IsoTimestamp?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp

    public init(
        id: RelayId,
        threadId: RelayId,
        sequenceNumber: Int,
        status: ThreadSessionStatus,
        isReadOnly: Bool,
        relayRunState: TeamRelayRunState = .running,
        relayPauseReason: TeamRelayPauseReason? = nil,
        relayReplyLimit: Int = TeamRelayReplyLimits.defaultLimit,
        startedAt: IsoTimestamp,
        endedAt: IsoTimestamp?,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp
    ) {
        self.id = id
        self.threadId = threadId
        self.sequenceNumber = sequenceNumber
        self.status = status
        self.isReadOnly = isReadOnly
        self.relayRunState = relayRunState
        self.relayPauseReason = relayPauseReason
        self.relayReplyLimit = TeamRelayReplyLimits.normalized(relayReplyLimit)
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case threadId
        case sequenceNumber
        case status
        case isReadOnly
        case relayRunState
        case relayPauseReason
        case relayReplyLimit
        case startedAt
        case endedAt
        case createdAt
        case updatedAt
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.init(
            id: try container.decode(RelayId.self, forKey: .id),
            threadId: try container.decode(RelayId.self, forKey: .threadId),
            sequenceNumber: try container.decode(Int.self, forKey: .sequenceNumber),
            status: try container.decode(ThreadSessionStatus.self, forKey: .status),
            isReadOnly: try container.decode(Bool.self, forKey: .isReadOnly),
            relayRunState: try container.decodeIfPresent(TeamRelayRunState.self, forKey: .relayRunState) ?? .running,
            relayPauseReason: try container.decodeIfPresent(TeamRelayPauseReason.self, forKey: .relayPauseReason),
            relayReplyLimit: try container.decodeIfPresent(Int.self, forKey: .relayReplyLimit) ?? TeamRelayReplyLimits.defaultLimit,
            startedAt: try container.decode(IsoTimestamp.self, forKey: .startedAt),
            endedAt: try container.decodeIfPresent(IsoTimestamp.self, forKey: .endedAt),
            createdAt: try container.decode(IsoTimestamp.self, forKey: .createdAt),
            updatedAt: try container.decode(IsoTimestamp.self, forKey: .updatedAt)
        )
    }
}

public struct ThreadParticipant: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var threadId: RelayId
    public var participantType: ThreadParticipantType
    public var participantId: RelayId?
    public var displayName: String
    public var role: ThreadParticipantRole
    public var isManager: Bool
    public var joinedAt: IsoTimestamp
    public var leftAt: IsoTimestamp?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct ThreadReadState: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var threadId: RelayId
    public var profileId: RelayId?
    public var lastReadMessageId: RelayId?
    public var lastReadAt: IsoTimestamp?
    public var unreadCount: Int
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct ThreadWrapUpReport: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var threadId: RelayId
    public var sessionId: RelayId?
    public var workspaceId: RelayId
    public var status: ThreadWrapUpStatus
    public var title: String?
    public var markdown: String?
    public var summary: String?
    public var metadata: JSONRecord
    public var messageCount: Int
    public var provider: String?
    public var model: String?
    public var error: JSONRecord?
    public var completedAt: IsoTimestamp?
    public var archivedAt: IsoTimestamp?
    public var retryCount: Int
    public var lastRetryAt: IsoTimestamp?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        threadId: RelayId,
        sessionId: RelayId? = nil,
        workspaceId: RelayId,
        status: ThreadWrapUpStatus,
        title: String? = nil,
        markdown: String? = nil,
        summary: String? = nil,
        metadata: JSONRecord = [:],
        messageCount: Int,
        provider: String? = nil,
        model: String? = nil,
        error: JSONRecord? = nil,
        completedAt: IsoTimestamp? = nil,
        archivedAt: IsoTimestamp? = nil,
        retryCount: Int = 0,
        lastRetryAt: IsoTimestamp? = nil,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String = "private-state-excluded"
    ) {
        self.id = id
        self.threadId = threadId
        self.sessionId = sessionId
        self.workspaceId = workspaceId
        self.status = status
        self.title = title
        self.markdown = markdown
        self.summary = summary
        self.metadata = metadata
        self.messageCount = messageCount
        self.provider = provider
        self.model = model
        self.error = error
        self.completedAt = completedAt
        self.archivedAt = archivedAt
        self.retryCount = retryCount
        self.lastRetryAt = lastRetryAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }

    enum CodingKeys: String, CodingKey {
        case id
        case threadId
        case sessionId
        case workspaceId
        case status
        case title
        case markdown
        case summary
        case metadata
        case messageCount
        case provider
        case model
        case error
        case completedAt
        case archivedAt
        case retryCount
        case lastRetryAt
        case createdAt
        case updatedAt
        case redactionStatus
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.id = try container.decode(RelayId.self, forKey: .id)
        self.threadId = try container.decode(RelayId.self, forKey: .threadId)
        self.sessionId = try container.decodeIfPresent(RelayId.self, forKey: .sessionId)
        self.workspaceId = try container.decode(RelayId.self, forKey: .workspaceId)
        self.status = try container.decode(ThreadWrapUpStatus.self, forKey: .status)
        self.title = try container.decodeIfPresent(String.self, forKey: .title)
        self.markdown = try container.decodeIfPresent(String.self, forKey: .markdown)
        self.summary = try container.decodeIfPresent(String.self, forKey: .summary)
        self.metadata = try container.decodeIfPresent(JSONRecord.self, forKey: .metadata) ?? [:]
        self.messageCount = try container.decodeIfPresent(Int.self, forKey: .messageCount) ?? 0
        self.provider = try container.decodeIfPresent(String.self, forKey: .provider)
        self.model = try container.decodeIfPresent(String.self, forKey: .model)
        self.error = try container.decodeIfPresent(JSONRecord.self, forKey: .error)
        self.completedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .completedAt)
        self.archivedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .archivedAt)
        self.retryCount = try container.decodeIfPresent(Int.self, forKey: .retryCount) ?? 0
        self.lastRetryAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .lastRetryAt)
        self.createdAt = try container.decode(IsoTimestamp.self, forKey: .createdAt)
        self.updatedAt = try container.decode(IsoTimestamp.self, forKey: .updatedAt)
        self.redactionStatus = try container.decodeIfPresent(String.self, forKey: .redactionStatus) ?? "private-state-excluded"
    }
}

public enum InsightsReportSourceFilter: String, Codable, CaseIterable, Sendable {
    case all
    case snapshots
    case chatReports = "chat_reports"
}

public enum InsightsReportSort: String, Codable, CaseIterable, Sendable {
    case newest
    case oldest
    case title
}

public enum InsightsReportSourceType: String, Codable, CaseIterable, Sendable {
    case snapshot
    case chatReport = "chat_report"
}

public enum InsightsReportListState: String, Codable, CaseIterable, Sendable {
    case loading
    case empty
    case ready
    case noMatch = "no_match"
    case error
}

public struct InsightsReportSnapshot: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var title: String
    public var summary: String
    public var snapshotType: String
    public var periodLabel: String?
    public var rangeStart: IsoTimestamp?
    public var rangeEnd: IsoTimestamp?
    public var payload: JSONRecord
    public var archivedAt: IsoTimestamp?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        title: String,
        summary: String,
        snapshotType: String,
        periodLabel: String? = nil,
        rangeStart: IsoTimestamp? = nil,
        rangeEnd: IsoTimestamp? = nil,
        payload: JSONRecord = [:],
        archivedAt: IsoTimestamp? = nil,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        redactionStatus: String = "private-state-excluded"
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.title = title
        self.summary = summary
        self.snapshotType = snapshotType
        self.periodLabel = periodLabel
        self.rangeStart = rangeStart
        self.rangeEnd = rangeEnd
        self.payload = payload
        self.archivedAt = archivedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct InsightsReportRow: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var sourceType: InsightsReportSourceType
    public var sourceRecordId: RelayId
    public var groupId: RelayId?
    public var groupTitle: String?
    public var groupSubtitle: String?
    public var cycleLabel: String?
    public var threadId: RelayId?
    public var sessionId: RelayId?
    public var title: String
    public var subtitle: String
    public var status: String
    public var statusLabel: String
    public var badge: String
    public var fileName: String?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
    public var archivedAt: IsoTimestamp?
    public var messageCount: Int
    public var provider: String?
    public var model: String?
    public var hasMarkdown: Bool
    public var hasStructuredData: Bool
    public var redactionStatus: String

    public init(
        id: RelayId,
        sourceType: InsightsReportSourceType,
        sourceRecordId: RelayId,
        groupId: RelayId? = nil,
        groupTitle: String? = nil,
        groupSubtitle: String? = nil,
        cycleLabel: String? = nil,
        threadId: RelayId? = nil,
        sessionId: RelayId? = nil,
        title: String,
        subtitle: String,
        status: String,
        statusLabel: String,
        badge: String,
        fileName: String? = nil,
        createdAt: IsoTimestamp,
        updatedAt: IsoTimestamp,
        archivedAt: IsoTimestamp? = nil,
        messageCount: Int = 0,
        provider: String? = nil,
        model: String? = nil,
        hasMarkdown: Bool = false,
        hasStructuredData: Bool = false,
        redactionStatus: String = "private-state-excluded"
    ) {
        self.id = id
        self.sourceType = sourceType
        self.sourceRecordId = sourceRecordId
        self.groupId = groupId
        self.groupTitle = groupTitle
        self.groupSubtitle = groupSubtitle
        self.cycleLabel = cycleLabel
        self.threadId = threadId
        self.sessionId = sessionId
        self.title = title
        self.subtitle = subtitle
        self.status = status
        self.statusLabel = statusLabel
        self.badge = badge
        self.fileName = fileName
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.archivedAt = archivedAt
        self.messageCount = messageCount
        self.provider = provider
        self.model = model
        self.hasMarkdown = hasMarkdown
        self.hasStructuredData = hasStructuredData
        self.redactionStatus = redactionStatus
    }
}

public struct InsightsReportGroup: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var title: String
    public var subtitle: String
    public var badge: String
    public var updatedAt: IsoTimestamp
    public var archivedAt: IsoTimestamp?
    public var isCollapsible: Bool
    public var rows: [InsightsReportRow]

    public init(
        id: RelayId,
        title: String,
        subtitle: String,
        badge: String,
        updatedAt: IsoTimestamp,
        archivedAt: IsoTimestamp? = nil,
        isCollapsible: Bool = false,
        rows: [InsightsReportRow]
    ) {
        self.id = id
        self.title = title
        self.subtitle = subtitle
        self.badge = badge
        self.updatedAt = updatedAt
        self.archivedAt = archivedAt
        self.isCollapsible = isCollapsible
        self.rows = rows
    }
}

public struct InsightsReportListSnapshot: Codable, Equatable, Sendable {
    public var state: InsightsReportListState
    public var rows: [InsightsReportRow]
    public var groups: [InsightsReportGroup]?
    public var selectedReportId: RelayId?
    public var searchQuery: String
    public var sourceFilter: InsightsReportSourceFilter
    public var sort: InsightsReportSort
    public var includeArchived: Bool
    public var totalCount: Int
    public var filteredCount: Int
    public var archivedCount: Int
    public var emptyReason: String?
    public var generatedAt: IsoTimestamp
    public var redactionStatus: String

    public init(
        state: InsightsReportListState,
        rows: [InsightsReportRow],
        groups: [InsightsReportGroup]? = nil,
        selectedReportId: RelayId? = nil,
        searchQuery: String = "",
        sourceFilter: InsightsReportSourceFilter = .all,
        sort: InsightsReportSort = .newest,
        includeArchived: Bool = false,
        totalCount: Int,
        filteredCount: Int,
        archivedCount: Int,
        emptyReason: String? = nil,
        generatedAt: IsoTimestamp,
        redactionStatus: String = "private-state-excluded"
    ) {
        self.state = state
        self.rows = rows
        self.groups = groups
        self.selectedReportId = selectedReportId
        self.searchQuery = searchQuery
        self.sourceFilter = sourceFilter
        self.sort = sort
        self.includeArchived = includeArchived
        self.totalCount = totalCount
        self.filteredCount = filteredCount
        self.archivedCount = archivedCount
        self.emptyReason = emptyReason
        self.generatedAt = generatedAt
        self.redactionStatus = redactionStatus
    }
}

public struct InsightsViewState: Codable, Equatable, Sendable {
    public var searchQuery: String
    public var sourceFilter: InsightsReportSourceFilter
    public var sort: InsightsReportSort
    public var includeArchived: Bool
    public var selectedReportId: RelayId?
    public var showingAnalytics: Bool
    public var activityGapMinutes: Int
    public var updatedAt: IsoTimestamp?

    public init(
        searchQuery: String = "",
        sourceFilter: InsightsReportSourceFilter = .all,
        sort: InsightsReportSort = .newest,
        includeArchived: Bool = false,
        selectedReportId: RelayId? = nil,
        showingAnalytics: Bool = false,
        activityGapMinutes: Int = 30,
        updatedAt: IsoTimestamp? = nil
    ) {
        self.searchQuery = searchQuery
        self.sourceFilter = sourceFilter
        self.sort = sort
        self.includeArchived = includeArchived
        self.selectedReportId = selectedReportId
        self.showingAnalytics = showingAnalytics
        self.activityGapMinutes = min(max(activityGapMinutes, 1), 1440)
        self.updatedAt = updatedAt
    }
}

public struct InsightsReportDetail: Codable, Equatable, Sendable {
    public var row: InsightsReportRow
    public var markdown: String?
    public var structuredData: JSONRecord
    public var snapshotData: JSONRecord
    public var error: JSONRecord?
    public var metadata: JSONRecord
    public var retryAvailable: Bool
    public var retryUnavailableReason: String?
    public var archiveAvailable: Bool
    public var redactionStatus: String

    public init(
        row: InsightsReportRow,
        markdown: String? = nil,
        structuredData: JSONRecord = [:],
        snapshotData: JSONRecord = [:],
        error: JSONRecord? = nil,
        metadata: JSONRecord = [:],
        retryAvailable: Bool = false,
        retryUnavailableReason: String? = nil,
        archiveAvailable: Bool = true,
        redactionStatus: String = "private-state-excluded"
    ) {
        self.row = row
        self.markdown = markdown
        self.structuredData = structuredData
        self.snapshotData = snapshotData
        self.error = error
        self.metadata = metadata
        self.retryAvailable = retryAvailable
        self.retryUnavailableReason = retryUnavailableReason
        self.archiveAvailable = archiveAvailable
        self.redactionStatus = redactionStatus
    }
}

public struct ThreadAnalyticsSender: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var senderName: String
    public var senderType: SenderType
    public var messageCount: Int
}

public struct ThreadAnalyticsActivePeriod: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var title: String
    public var startedAt: IsoTimestamp
    public var endedAt: IsoTimestamp
    public var messageCount: Int
}

public struct ThreadAnalyticsSession: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var sequenceNumber: Int
    public var messageCount: Int
    public var userMessageCount: Int
    public var agentMessageCount: Int
    public var status: ThreadSessionStatus
    public var repeatAnalysisStatus: String
    public var repeatedAgentMessageCount: Int?
    public var repeatedCrossAgentMessageCount: Int?
    public var agentRepeatGroupCount: Int?
    public var repeatAnalysisError: String?
}

public struct ThreadAnalyticsSnapshot: Codable, Equatable, Sendable {
    public var threadId: RelayId?
    public var activityGapMinutes: Int
    public var messageCount: Int
    public var senderCount: Int
    public var sessionCount: Int
    public var threadLength: String
    public var yourMessageCount: Int?
    public var userMessageCount: Int
    public var agentMessageCount: Int
    public var activeWindowCount: Int
    public var firstMessageAt: IsoTimestamp?
    public var lastMessageAt: IsoTimestamp?
    public var senders: [ThreadAnalyticsSender]
    public var activePeriods: [ThreadAnalyticsActivePeriod]
    public var sessions: [ThreadAnalyticsSession]
    public var exportAvailable: Bool
    public var emptyReason: String?
    public var redactionStatus: String

    public init(
        threadId: RelayId? = nil,
        activityGapMinutes: Int,
        messageCount: Int,
        senderCount: Int,
        sessionCount: Int,
        threadLength: String,
        yourMessageCount: Int? = nil,
        userMessageCount: Int,
        agentMessageCount: Int,
        activeWindowCount: Int,
        firstMessageAt: IsoTimestamp? = nil,
        lastMessageAt: IsoTimestamp? = nil,
        senders: [ThreadAnalyticsSender],
        activePeriods: [ThreadAnalyticsActivePeriod],
        sessions: [ThreadAnalyticsSession],
        exportAvailable: Bool,
        emptyReason: String? = nil,
        redactionStatus: String = "private-state-excluded"
    ) {
        self.threadId = threadId
        self.activityGapMinutes = activityGapMinutes
        self.messageCount = messageCount
        self.senderCount = senderCount
        self.sessionCount = sessionCount
        self.threadLength = threadLength
        self.yourMessageCount = yourMessageCount
        self.userMessageCount = userMessageCount
        self.agentMessageCount = agentMessageCount
        self.activeWindowCount = activeWindowCount
        self.firstMessageAt = firstMessageAt
        self.lastMessageAt = lastMessageAt
        self.senders = senders
        self.activePeriods = activePeriods
        self.sessions = sessions
        self.exportAvailable = exportAvailable
        self.emptyReason = emptyReason
        self.redactionStatus = redactionStatus
    }
}

public struct RuntimeSession: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var threadId: RelayId
    public var agentId: RelayId
    public var runtimeBindingId: RelayId
    public var externalSessionId: String?
    public var status: String
    public var metadata: JSONRecord
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct RuntimeDispatch: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var threadId: RelayId
    public var messageId: RelayId
    public var agentId: RelayId
    public var harnessId: RelayId
    public var sessionId: RelayId
    public var status: DispatchStatus
    public var correlationId: String
    public var inputSnapshot: JSONRecord
    public var resultSnapshot: JSONRecord?
    public var errorSnapshot: JSONRecord?
    public var startedAt: IsoTimestamp?
    public var completedAt: IsoTimestamp?
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct LogEvent: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var timestamp: IsoTimestamp
    public var severity: String
    public var category: String
    public var message: String
    public var correlationId: String?
    public var dispatchId: RelayId?
    public var harnessId: RelayId?
    public var threadId: RelayId?
    public var detail: JSONRecord
}

public struct SecretReference: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var scope: String
    public var scopeId: RelayId?
    public var label: String
    public var provider: String
    public var keychainService: String
    public var keychainAccount: String
    public var createdAt: IsoTimestamp
    public var updatedAt: IsoTimestamp
}

public struct AppState: Codable, Equatable, Sendable {
    public var appName: String
    public var appVersion: String
    public var hasProfile: Bool
    public var activeProfile: LocalProfile?
    public var activeWorkspace: Workspace?
    public var firstRunRequired: Bool
}

public struct RuntimeEvent: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var dispatchId: RelayId
    public var threadId: RelayId
    public var agentId: RelayId
    public var runtimeType: RuntimeType
    public var type: RuntimeEventType
    public var text: String?
    public var status: String?
    public var detail: JSONRecord
    public var timestamp: IsoTimestamp
}
