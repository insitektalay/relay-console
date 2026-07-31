import Foundation

public enum RuntimeExperienceSettings {
    public static let detailedActivityEnabledKey = "runtime.activity.detail.enabled"
    public static let approvalModeKey = "runtime.approval_mode"
    public static let runConfirmationEnabledKey = "runtime.run_confirmation.enabled"
    public static let defaultDetailedActivityEnabled = true
    public static let defaultApprovalMode = RuntimeApprovalMode.askForApproval
    public static let defaultRunConfirmationEnabled = false
}

public enum RuntimeApprovalMode: String, Codable, CaseIterable, Sendable {
    case askForApproval = "ask_for_approval"
    case approveForMe = "approve_for_me"
    case fullAccess = "full_access"

    public var requiresRunConfirmation: Bool {
        false
    }

    public static func fromLegacyRunConfirmation(_ enabled: Bool) -> RuntimeApprovalMode {
        enabled ? .askForApproval : .approveForMe
    }
}

public enum RuntimeActivityKind: String, Codable, CaseIterable, Sendable {
    case message
    case thinking
    case status
    case tool
    case toolGroup = "tool_group"
    case taskList = "task_list"
    case context
    case terminal
    case unknown

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = RuntimeActivityKind(rawValue: rawValue) ?? .unknown
    }
}

public enum RuntimeActivityPhase: String, Codable, CaseIterable, Sendable {
    case pending
    case running
    case completed
    case failed
    case cancelled
    case unknown

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = RuntimeActivityPhase(rawValue: rawValue) ?? .unknown
    }
}

public enum RuntimeActivityTaskStatus: String, Codable, CaseIterable, Sendable {
    case pending
    case inProgress = "in_progress"
    case completed
    case cancelled
    case unknown

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        self = RuntimeActivityTaskStatus(rawValue: rawValue) ?? .unknown
    }
}

public struct RuntimeActivityItem: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var dispatchId: RelayId?
    public var kind: RuntimeActivityKind
    public var kindRawValue: String
    public var phase: RuntimeActivityPhase
    public var phaseRawValue: String
    public var title: String
    public var summary: String?
    public var toolName: String?
    public var toolCallId: String?
    public var groupId: RelayId?
    public var eventIds: [RelayId]
    public var startedAt: IsoTimestamp?
    public var updatedAt: IsoTimestamp?
    public var completedAt: IsoTimestamp?
    public var durationMs: Int?
    public var detail: JSONRecord
    public var result: JSONRecord?
    public var error: JSONRecord?
    public var compatibilityMetadata: JSONRecord

    public init(
        id: RelayId,
        dispatchId: RelayId? = nil,
        kind: RuntimeActivityKind,
        kindRawValue: String? = nil,
        phase: RuntimeActivityPhase,
        phaseRawValue: String? = nil,
        title: String,
        summary: String? = nil,
        toolName: String? = nil,
        toolCallId: String? = nil,
        groupId: RelayId? = nil,
        eventIds: [RelayId] = [],
        startedAt: IsoTimestamp? = nil,
        updatedAt: IsoTimestamp? = nil,
        completedAt: IsoTimestamp? = nil,
        durationMs: Int? = nil,
        detail: JSONRecord = [:],
        result: JSONRecord? = nil,
        error: JSONRecord? = nil,
        compatibilityMetadata: JSONRecord = [:]
    ) {
        self.id = id
        self.dispatchId = dispatchId
        self.kind = kind
        self.kindRawValue = kindRawValue ?? kind.rawValue
        self.phase = phase
        self.phaseRawValue = phaseRawValue ?? phase.rawValue
        self.title = title
        self.summary = summary
        self.toolName = toolName
        self.toolCallId = toolCallId
        self.groupId = groupId
        self.eventIds = eventIds
        self.startedAt = startedAt
        self.updatedAt = updatedAt
        self.completedAt = completedAt
        self.durationMs = durationMs
        self.detail = detail
        self.result = result
        self.error = error
        self.compatibilityMetadata = compatibilityMetadata
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case dispatchId
        case kind
        case phase
        case title
        case summary
        case toolName
        case toolCallId
        case groupId
        case eventIds
        case startedAt
        case updatedAt
        case completedAt
        case durationMs
        case detail
        case result
        case error
        case compatibilityMetadata
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let rawKind = try container.decodeIfPresent(String.self, forKey: .kind) ?? RuntimeActivityKind.unknown.rawValue
        let rawPhase = try container.decodeIfPresent(String.self, forKey: .phase) ?? RuntimeActivityPhase.pending.rawValue

        self.id = try container.decode(RelayId.self, forKey: .id)
        self.dispatchId = try container.decodeIfPresent(RelayId.self, forKey: .dispatchId)
        self.kind = RuntimeActivityKind(rawValue: rawKind) ?? .unknown
        self.kindRawValue = rawKind
        self.phase = RuntimeActivityPhase(rawValue: rawPhase) ?? .unknown
        self.phaseRawValue = rawPhase
        self.title = try container.decode(String.self, forKey: .title)
        self.summary = try container.decodeIfPresent(String.self, forKey: .summary)
        self.toolName = try container.decodeIfPresent(String.self, forKey: .toolName)
        self.toolCallId = try container.decodeIfPresent(String.self, forKey: .toolCallId)
        self.groupId = try container.decodeIfPresent(RelayId.self, forKey: .groupId)
        self.eventIds = try container.decodeIfPresent([RelayId].self, forKey: .eventIds) ?? []
        self.startedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .startedAt)
        self.updatedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .updatedAt)
        self.completedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .completedAt)
        self.durationMs = try container.decodeIfPresent(Int.self, forKey: .durationMs)
        self.detail = try container.decodeIfPresent(JSONRecord.self, forKey: .detail) ?? [:]
        self.result = try container.decodeIfPresent(JSONRecord.self, forKey: .result)
        self.error = try container.decodeIfPresent(JSONRecord.self, forKey: .error)
        self.compatibilityMetadata = try container.decodeIfPresent(JSONRecord.self, forKey: .compatibilityMetadata) ?? [:]
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(dispatchId, forKey: .dispatchId)
        try container.encode(kindRawValue, forKey: .kind)
        try container.encode(phaseRawValue, forKey: .phase)
        try container.encode(title, forKey: .title)
        try container.encodeIfPresent(summary, forKey: .summary)
        try container.encodeIfPresent(toolName, forKey: .toolName)
        try container.encodeIfPresent(toolCallId, forKey: .toolCallId)
        try container.encodeIfPresent(groupId, forKey: .groupId)
        try container.encode(eventIds, forKey: .eventIds)
        try container.encodeIfPresent(startedAt, forKey: .startedAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
        try container.encodeIfPresent(completedAt, forKey: .completedAt)
        try container.encodeIfPresent(durationMs, forKey: .durationMs)
        try container.encode(detail, forKey: .detail)
        try container.encodeIfPresent(result, forKey: .result)
        try container.encodeIfPresent(error, forKey: .error)
        try container.encode(compatibilityMetadata, forKey: .compatibilityMetadata)
    }
}

public struct RuntimeActivityToolGroup: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var title: String
    public var phase: RuntimeActivityPhase
    public var phaseRawValue: String
    public var itemIds: [RelayId]
    public var summary: String?
    public var runningCount: Int
    public var completedCount: Int
    public var failedCount: Int
    public var startedAt: IsoTimestamp?
    public var updatedAt: IsoTimestamp?
    public var completedAt: IsoTimestamp?
    public var durationMs: Int?
    public var detail: JSONRecord
    public var compatibilityMetadata: JSONRecord

    public init(
        id: RelayId,
        title: String,
        phase: RuntimeActivityPhase,
        phaseRawValue: String? = nil,
        itemIds: [RelayId] = [],
        summary: String? = nil,
        runningCount: Int = 0,
        completedCount: Int = 0,
        failedCount: Int = 0,
        startedAt: IsoTimestamp? = nil,
        updatedAt: IsoTimestamp? = nil,
        completedAt: IsoTimestamp? = nil,
        durationMs: Int? = nil,
        detail: JSONRecord = [:],
        compatibilityMetadata: JSONRecord = [:]
    ) {
        self.id = id
        self.title = title
        self.phase = phase
        self.phaseRawValue = phaseRawValue ?? phase.rawValue
        self.itemIds = itemIds
        self.summary = summary
        self.runningCount = runningCount
        self.completedCount = completedCount
        self.failedCount = failedCount
        self.startedAt = startedAt
        self.updatedAt = updatedAt
        self.completedAt = completedAt
        self.durationMs = durationMs
        self.detail = detail
        self.compatibilityMetadata = compatibilityMetadata
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case title
        case phase
        case itemIds
        case summary
        case runningCount
        case completedCount
        case failedCount
        case startedAt
        case updatedAt
        case completedAt
        case durationMs
        case detail
        case compatibilityMetadata
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let rawPhase = try container.decodeIfPresent(String.self, forKey: .phase) ?? RuntimeActivityPhase.pending.rawValue

        self.id = try container.decode(RelayId.self, forKey: .id)
        self.title = try container.decode(String.self, forKey: .title)
        self.phase = RuntimeActivityPhase(rawValue: rawPhase) ?? .unknown
        self.phaseRawValue = rawPhase
        self.itemIds = try container.decodeIfPresent([RelayId].self, forKey: .itemIds) ?? []
        self.summary = try container.decodeIfPresent(String.self, forKey: .summary)
        self.runningCount = try container.decodeIfPresent(Int.self, forKey: .runningCount) ?? 0
        self.completedCount = try container.decodeIfPresent(Int.self, forKey: .completedCount) ?? 0
        self.failedCount = try container.decodeIfPresent(Int.self, forKey: .failedCount) ?? 0
        self.startedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .startedAt)
        self.updatedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .updatedAt)
        self.completedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .completedAt)
        self.durationMs = try container.decodeIfPresent(Int.self, forKey: .durationMs)
        self.detail = try container.decodeIfPresent(JSONRecord.self, forKey: .detail) ?? [:]
        self.compatibilityMetadata = try container.decodeIfPresent(JSONRecord.self, forKey: .compatibilityMetadata) ?? [:]
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(title, forKey: .title)
        try container.encode(phaseRawValue, forKey: .phase)
        try container.encode(itemIds, forKey: .itemIds)
        try container.encodeIfPresent(summary, forKey: .summary)
        try container.encode(runningCount, forKey: .runningCount)
        try container.encode(completedCount, forKey: .completedCount)
        try container.encode(failedCount, forKey: .failedCount)
        try container.encodeIfPresent(startedAt, forKey: .startedAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
        try container.encodeIfPresent(completedAt, forKey: .completedAt)
        try container.encodeIfPresent(durationMs, forKey: .durationMs)
        try container.encode(detail, forKey: .detail)
        try container.encode(compatibilityMetadata, forKey: .compatibilityMetadata)
    }
}

public struct RuntimeActivityTask: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var content: String
    public var status: RuntimeActivityTaskStatus
    public var statusRawValue: String
    public var priority: Int?
    public var sourceToolCallId: String?
    public var startedAt: IsoTimestamp?
    public var updatedAt: IsoTimestamp?
    public var completedAt: IsoTimestamp?
    public var detail: JSONRecord
    public var compatibilityMetadata: JSONRecord

    public init(
        id: RelayId,
        content: String,
        status: RuntimeActivityTaskStatus,
        statusRawValue: String? = nil,
        priority: Int? = nil,
        sourceToolCallId: String? = nil,
        startedAt: IsoTimestamp? = nil,
        updatedAt: IsoTimestamp? = nil,
        completedAt: IsoTimestamp? = nil,
        detail: JSONRecord = [:],
        compatibilityMetadata: JSONRecord = [:]
    ) {
        self.id = id
        self.content = content
        self.status = status
        self.statusRawValue = statusRawValue ?? status.rawValue
        self.priority = priority
        self.sourceToolCallId = sourceToolCallId
        self.startedAt = startedAt
        self.updatedAt = updatedAt
        self.completedAt = completedAt
        self.detail = detail
        self.compatibilityMetadata = compatibilityMetadata
    }

    private enum CodingKeys: String, CodingKey {
        case id
        case content
        case status
        case priority
        case sourceToolCallId
        case startedAt
        case updatedAt
        case completedAt
        case detail
        case compatibilityMetadata
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let rawStatus = try container.decodeIfPresent(String.self, forKey: .status) ?? RuntimeActivityTaskStatus.pending.rawValue

        self.id = try container.decode(RelayId.self, forKey: .id)
        self.content = try container.decode(String.self, forKey: .content)
        self.status = RuntimeActivityTaskStatus(rawValue: rawStatus) ?? .unknown
        self.statusRawValue = rawStatus
        self.priority = try container.decodeIfPresent(Int.self, forKey: .priority)
        self.sourceToolCallId = try container.decodeIfPresent(String.self, forKey: .sourceToolCallId)
        self.startedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .startedAt)
        self.updatedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .updatedAt)
        self.completedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .completedAt)
        self.detail = try container.decodeIfPresent(JSONRecord.self, forKey: .detail) ?? [:]
        self.compatibilityMetadata = try container.decodeIfPresent(JSONRecord.self, forKey: .compatibilityMetadata) ?? [:]
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(content, forKey: .content)
        try container.encode(statusRawValue, forKey: .status)
        try container.encodeIfPresent(priority, forKey: .priority)
        try container.encodeIfPresent(sourceToolCallId, forKey: .sourceToolCallId)
        try container.encodeIfPresent(startedAt, forKey: .startedAt)
        try container.encodeIfPresent(updatedAt, forKey: .updatedAt)
        try container.encodeIfPresent(completedAt, forKey: .completedAt)
        try container.encode(detail, forKey: .detail)
        try container.encode(compatibilityMetadata, forKey: .compatibilityMetadata)
    }
}

public struct RuntimeActivityProjection: Codable, Equatable, Sendable {
    public static let currentSchemaVersion = 1
    public static let snapshotKey = "runtimeActivityProjection"

    public var schemaVersion: Int
    public var dispatchId: RelayId?
    public var items: [RuntimeActivityItem]
    public var toolGroups: [RuntimeActivityToolGroup]
    public var tasks: [RuntimeActivityTask]
    public var draftText: String?
    public var lastEventId: RelayId?
    public var lastEventType: String?
    public var updatedAt: IsoTimestamp?
    public var compatibilityMetadata: JSONRecord

    public var isEmpty: Bool {
        items.isEmpty
            && toolGroups.isEmpty
            && tasks.isEmpty
            && draftText == nil
            && lastEventId == nil
            && lastEventType == nil
    }

    public init(
        schemaVersion: Int = RuntimeActivityProjection.currentSchemaVersion,
        dispatchId: RelayId? = nil,
        items: [RuntimeActivityItem] = [],
        toolGroups: [RuntimeActivityToolGroup] = [],
        tasks: [RuntimeActivityTask] = [],
        draftText: String? = nil,
        lastEventId: RelayId? = nil,
        lastEventType: String? = nil,
        updatedAt: IsoTimestamp? = nil,
        compatibilityMetadata: JSONRecord = [:]
    ) {
        self.schemaVersion = schemaVersion
        self.dispatchId = dispatchId
        self.items = items
        self.toolGroups = toolGroups
        self.tasks = tasks
        self.draftText = draftText
        self.lastEventId = lastEventId
        self.lastEventType = lastEventType
        self.updatedAt = updatedAt
        self.compatibilityMetadata = compatibilityMetadata
    }

    private enum CodingKeys: String, CodingKey {
        case schemaVersion
        case dispatchId
        case items
        case toolGroups
        case tasks
        case draftText
        case lastEventId
        case lastEventType
        case updatedAt
        case compatibilityMetadata
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.schemaVersion = try container.decodeIfPresent(Int.self, forKey: .schemaVersion) ?? RuntimeActivityProjection.currentSchemaVersion
        self.dispatchId = try container.decodeIfPresent(RelayId.self, forKey: .dispatchId)
        self.items = try container.decodeIfPresent([RuntimeActivityItem].self, forKey: .items) ?? []
        self.toolGroups = try container.decodeIfPresent([RuntimeActivityToolGroup].self, forKey: .toolGroups) ?? []
        self.tasks = try container.decodeIfPresent([RuntimeActivityTask].self, forKey: .tasks) ?? []
        self.draftText = try container.decodeIfPresent(String.self, forKey: .draftText)
        self.lastEventId = try container.decodeIfPresent(RelayId.self, forKey: .lastEventId)
        self.lastEventType = try container.decodeIfPresent(String.self, forKey: .lastEventType)
        self.updatedAt = try container.decodeIfPresent(IsoTimestamp.self, forKey: .updatedAt)
        self.compatibilityMetadata = try container.decodeIfPresent(JSONRecord.self, forKey: .compatibilityMetadata) ?? [:]
    }
}
