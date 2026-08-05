// CoreModels.swift
// ClawChat – All domain model types
// Swift 6, Sendable throughout

import Foundation

// MARK: - User & Auth

struct User: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var email: String
    var name: String
    var avatarUrl: String?
    var createdAt: Date
    var updatedAt: Date

    var effectiveAvatarUrl: String? {
        if let avatarUrl = avatarUrl?.trimmingCharacters(in: .whitespacesAndNewlines), !avatarUrl.isEmpty {
            return avatarUrl
        }

        let normalizedName = name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let normalizedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if normalizedName == "alex kerss" || normalizedEmail.hasPrefix("alex") {
            return "/avatars/alex-kerss.png"
        }

        return nil
    }
}

struct AuthTokens: Codable, Sendable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
}

struct WsTicket: Codable, Sendable {
    let ticket: String
    let expiresAt: Date?
}

// MARK: - Workspace

struct Workspace: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var type: WorkspaceType
    var avatarUrl: String?
    var description: String?
    var createdAt: Date
    var updatedAt: Date
    var unreadCount: Int
    var agentCount: Int
    var teamCount: Int?

    init(
        id: String,
        name: String,
        type: WorkspaceType,
        avatarUrl: String? = nil,
        description: String? = nil,
        createdAt: Date,
        updatedAt: Date,
        unreadCount: Int = 0,
        agentCount: Int = 0,
        teamCount: Int? = nil
    ) {
        self.id = id
        self.name = name
        self.type = type
        self.avatarUrl = avatarUrl
        self.description = description
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.unreadCount = unreadCount
        self.agentCount = agentCount
        self.teamCount = teamCount
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        type = try container.decode(WorkspaceType.self, forKey: .type)
        avatarUrl = try container.decodeIfPresent(String.self, forKey: .avatarUrl)
        description = try container.decodeIfPresent(String.self, forKey: .description)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        unreadCount = try container.decodeIfPresent(Int.self, forKey: .unreadCount) ?? 0
        agentCount = try container.decodeIfPresent(Int.self, forKey: .agentCount) ?? 0
        teamCount = try container.decodeIfPresent(Int.self, forKey: .teamCount)
    }
}

enum WorkspaceType: String, Codable, Hashable, Sendable {
    case personal
    case business
}

// MARK: - Company / Org Hierarchy

struct Company: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var workspaceId: String
    var avatarUrl: String?
    var description: String?
    var industry: String?
    var createdAt: Date
}

struct Department: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var companyId: String
    var headAgentId: String?
    var description: String?
    var color: String
    var agentCount: Int
    var createdAt: Date

    init(id: String, name: String, companyId: String, headAgentId: String? = nil,
         description: String? = nil, color: String = "#0A84FF", agentCount: Int = 0, createdAt: Date) {
        self.id = id; self.name = name; self.companyId = companyId
        self.headAgentId = headAgentId; self.description = description
        self.color = color; self.agentCount = agentCount; self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id          = try c.decode(String.self, forKey: .id)
        name        = try c.decode(String.self, forKey: .name)
        companyId   = try c.decode(String.self, forKey: .companyId)
        headAgentId = try c.decodeIfPresent(String.self, forKey: .headAgentId)
        description = try c.decodeIfPresent(String.self, forKey: .description)
        color       = (try c.decodeIfPresent(String.self, forKey: .color)) ?? "#0A84FF"
        agentCount  = (try c.decodeIfPresent(Int.self, forKey: .agentCount)) ?? 0
        createdAt   = try c.decode(Date.self, forKey: .createdAt)
    }
}

struct Team: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var departmentId: String
    var leadAgentId: String?
    var description: String?
    var color: String
    var agentCount: Int
    var createdAt: Date

    init(id: String, name: String, departmentId: String, leadAgentId: String? = nil,
         description: String? = nil, color: String = "#30D158", agentCount: Int = 0, createdAt: Date) {
        self.id = id; self.name = name; self.departmentId = departmentId
        self.leadAgentId = leadAgentId; self.description = description
        self.color = color; self.agentCount = agentCount; self.createdAt = createdAt
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id           = try c.decode(String.self, forKey: .id)
        name         = try c.decode(String.self, forKey: .name)
        departmentId = try c.decode(String.self, forKey: .departmentId)
        leadAgentId  = try c.decodeIfPresent(String.self, forKey: .leadAgentId)
        description  = try c.decodeIfPresent(String.self, forKey: .description)
        color        = (try c.decodeIfPresent(String.self, forKey: .color)) ?? "#30D158"
        agentCount   = (try c.decodeIfPresent(Int.self, forKey: .agentCount)) ?? 0
        createdAt    = try c.decode(Date.self, forKey: .createdAt)
    }
}

// MARK: - Agent

struct Agent: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var externalId: String? = nil
    var name: String
    var role: String
    var avatarUrl: String?
    var status: AgentStatus
    var teamId: String?
    var departmentId: String?
    var companyId: String?
    var groupType: String? = nil
    var groupLabel: String? = nil
    var workspaceId: String
    var managerId: String?
    var description: String?
    var capabilities: [String]
    var workingHoursMode: WorkingHoursMode
    var timezone: String
    var createdAt: Date
    var updatedAt: Date
    var runtimeType: AgentRuntimeType?
    var runtimeAvailability: RuntimeAvailability? = nil
    var executionAvailable: Bool? = nil
    var executionUnavailableReason: String? = nil
    var runtimeDeviceId: String? = nil
    var runtimeLastSeenAt: Date? = nil
    var executionOwnerKind: String? = nil
    var lifecycleStatus: AgentLifecycleStatus? = nil
    var lifecycleReason: String? = nil
    var retiredAt: Date? = nil
    var runtimeHostId: String? = nil
    var assignmentEpoch: String? = nil
    var ownershipState: String? = nil
    var modelPrimary: String? = nil
    var currentTaskId: String?
    var tasksCompletedToday: Int
    var successRate: Double
    var avgCompletionMinutes: Int
    var totalMinutesWorked: Int
    var budgetUsed: Double
    var budgetLimit: Double?
}

enum AgentLifecycleStatus: String, Codable, Hashable, Sendable {
    case active, retired, quarantined, deleted
}

enum RuntimeAvailability: String, Codable, Hashable, Sendable {
    case online, offline, queued, unavailable, revoked
}

extension Agent {
    var isActiveSurfaceEligible: Bool {
        lifecycleStatus == nil || lifecycleStatus == .active
    }

    var isExecutionAvailable: Bool {
        isActiveSurfaceEligible && executionAvailable == true
    }

    var relayProductModeLabel: String {
        switch executionOwnerKind {
        case "relay_managed": return "Relay service"
        case "client_installation", "bridge_device", "customer_host": return "Customer-operated host"
        default: return "Customer-operated host"
        }
    }

    var openClawIdentifier: String {
        guard let slug = externalId?.trimmingCharacters(in: .whitespacesAndNewlines), !slug.isEmpty else {
            return id
        }
        return slug
    }
}

enum AgentStatus: String, Codable, Hashable, Sendable {
    case onDuty = "on_duty"
    case offDuty = "off_duty"
    case busy
    case paused
    case idle
    case error

    init(from decoder: Decoder) throws {
        let rawValue = try decoder.singleValueContainer().decode(String.self)
        switch rawValue.lowercased() {
        case "active", "online", "available", "on_duty":
            self = .onDuty
        case "offline", "off_duty":
            self = .offDuty
        case "busy":
            self = .busy
        case "paused":
            self = .paused
        case "error":
            self = .error
        default:
            self = .idle
        }
    }
}

enum WorkingHoursMode: String, Codable, Hashable, Sendable {
    case twentyFourSeven = "24_7"
    case scheduled
    case manual

    init(from decoder: Decoder) throws {
        let rawValue = try decoder.singleValueContainer().decode(String.self)
        self = WorkingHoursMode(rawValue: rawValue) ?? .scheduled
    }
}

struct AgentRole: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var description: String
    var permissions: [String]
    var workspaceId: String
}

struct ManagerRelationship: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let managerId: String
    let reportId: String
    let createdAt: Date
}

// MARK: - Thread & Messages

struct Thread: Identifiable, Hashable, Sendable {
    let id: String
    var title: String
    var type: ThreadType
    var workspaceId: String
    var avatarUrl: String?
    var lastMessage: MessagePreview?
    var unreadCount: Int
    var isPinned: Bool
    var isMuted: Bool
    var participantIds: [String]
    var createdAt: Date
    var updatedAt: Date
    var teamId: String?
    var departmentId: String?
    var agentIds: [String]
    var status: ThreadStatus
    var maxAgentTurns: Int?

    init(
        id: String,
        title: String,
        type: ThreadType,
        workspaceId: String,
        avatarUrl: String?,
        lastMessage: MessagePreview?,
        unreadCount: Int,
        isPinned: Bool,
        isMuted: Bool,
        participantIds: [String],
        createdAt: Date,
        updatedAt: Date,
        teamId: String?,
        departmentId: String?,
        agentIds: [String],
        status: ThreadStatus,
        maxAgentTurns: Int? = nil
    ) {
        self.id = id
        self.title = title
        self.type = type
        self.workspaceId = workspaceId
        self.avatarUrl = avatarUrl
        self.lastMessage = lastMessage
        self.unreadCount = unreadCount
        self.isPinned = isPinned
        self.isMuted = isMuted
        self.participantIds = participantIds
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.teamId = teamId
        self.departmentId = departmentId
        self.agentIds = agentIds
        self.status = status
        self.maxAgentTurns = maxAgentTurns
    }
}

extension Thread: Codable {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id             = try c.decode(String.self, forKey: .id)
        title          = try c.decode(String.self, forKey: .title)
        type           = (try? c.decode(ThreadType.self, forKey: .type)) ?? .direct
        workspaceId    = try c.decode(String.self, forKey: .workspaceId)
        avatarUrl      = try c.decodeIfPresent(String.self, forKey: .avatarUrl)
        lastMessage    = try c.decodeIfPresent(MessagePreview.self, forKey: .lastMessage)
        unreadCount    = (try? c.decode(Int.self, forKey: .unreadCount)) ?? 0
        isPinned       = (try? c.decode(Bool.self, forKey: .isPinned)) ?? false
        isMuted        = (try? c.decode(Bool.self, forKey: .isMuted)) ?? false
        participantIds = (try? c.decode([String].self, forKey: .participantIds)) ?? []
        createdAt      = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
        updatedAt      = (try? c.decode(Date.self, forKey: .updatedAt)) ?? Date()
        teamId         = try c.decodeIfPresent(String.self, forKey: .teamId)
        departmentId   = try c.decodeIfPresent(String.self, forKey: .departmentId)
        agentIds       = (try? c.decode([String].self, forKey: .agentIds)) ?? []
        status         = (try? c.decode(ThreadStatus.self, forKey: .status)) ?? .active
        maxAgentTurns  = try? c.decodeIfPresent(Int.self, forKey: .maxAgentTurns)
    }
}

enum ThreadType: String, Codable, Hashable, Sendable {
    case direct
    case team
    case department
    case agentToAgent = "agent_to_agent"
    case groupAgent = "group_agent"
    case system
    case approval
    case incident
    case report
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ThreadType(rawValue: raw) ?? .unknown
    }
}

enum ThreadStatus: String, Codable, Hashable, Sendable {
    case active
    case archived
    case resolved
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = ThreadStatus(rawValue: raw) ?? .unknown
    }
}

enum TeamRelayRunState: String, Codable, Hashable, Sendable {
    case running
    case paused
}

enum TeamRelayPauseReason: String, Codable, Hashable, Sendable {
    case manual
    case replyLimit = "reply_limit"
}

struct TeamRelayState: Codable, Hashable, Sendable {
    let threadId: String
    let threadSessionId: String
    let runState: TeamRelayRunState
    let pauseReason: TeamRelayPauseReason?
    let replyLimit: Int
    let replyCount: Int
}

struct MessagePreview: Hashable, Sendable {
    let content: String
    let senderId: String?
    let senderName: String?
    let timestamp: Date
}

struct MessageSenderPreview: Hashable, Sendable {
    let id: String
    let name: String
    let avatarUrl: String?
}

extension MessagePreview: Codable {
    enum CodingKeys: String, CodingKey {
        case content, senderId, senderName, timestamp, createdAt
    }
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let decodedContent = (try? c.decode(String.self, forKey: .content)) ?? ""
        content    = decodedContent.clawPreviewTruncated(maxCharacters: 320)
        senderId   = try? c.decode(String.self, forKey: .senderId)
        senderName = try? c.decode(String.self, forKey: .senderName)
        // Backend sends "createdAt", model expects "timestamp" — accept both
        timestamp  = (try? c.decode(Date.self, forKey: .timestamp))
                  ?? (try? c.decode(Date.self, forKey: .createdAt))
                  ?? Date()
    }
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(content, forKey: .content)
        try c.encodeIfPresent(senderId, forKey: .senderId)
        try c.encodeIfPresent(senderName, forKey: .senderName)
        try c.encode(timestamp, forKey: .timestamp)
    }
}

private extension String {
    func clawPreviewTruncated(maxCharacters: Int) -> String {
        guard count > maxCharacters else { return self }
        return String(prefix(maxCharacters)).trimmingCharacters(in: .whitespacesAndNewlines) + "..."
    }
}

struct Message: Identifiable, Hashable, Sendable {
    let id: String
    var threadId: String
    var senderId: String
    var senderName: String
    var senderAvatarUrl: String?
    var content: String
    var type: MessageType
    var provenance: MessageProvenance
    var embeddedCard: EmbeddedCard?
    var attachments: [MessageAttachment]
    var metadata: MessageMetadata?
    var isFromUser: Bool
    var createdAt: Date
    var updatedAt: Date
    var isEdited: Bool
    var replyToId: String?

    init(
        id: String,
        threadId: String,
        senderId: String,
        senderName: String,
        senderAvatarUrl: String?,
        content: String,
        type: MessageType,
        provenance: MessageProvenance = .user,
        embeddedCard: EmbeddedCard?,
        attachments: [MessageAttachment],
        metadata: MessageMetadata? = nil,
        isFromUser: Bool,
        createdAt: Date,
        updatedAt: Date,
        isEdited: Bool,
        replyToId: String?
    ) {
        self.id = id
        self.threadId = threadId
        self.senderId = senderId
        self.senderName = senderName
        self.senderAvatarUrl = senderAvatarUrl
        self.content = content
        self.type = type
        self.provenance = provenance
        self.embeddedCard = embeddedCard
        self.attachments = attachments
        self.metadata = metadata
        self.isFromUser = isFromUser
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.isEdited = isEdited
        self.replyToId = replyToId
    }
}

extension Message: Codable {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id             = try c.decode(String.self, forKey: .id)
        threadId       = try c.decode(String.self, forKey: .threadId)
        senderId       = (try? c.decode(String.self, forKey: .senderId)) ?? ""
        senderName     = (try? c.decode(String.self, forKey: .senderName)) ?? ""
        senderAvatarUrl = try c.decodeIfPresent(String.self, forKey: .senderAvatarUrl)
        content        = (try? c.decode(String.self, forKey: .content)) ?? ""
        type           = (try? c.decode(MessageType.self, forKey: .type)) ?? .text
        provenance     = (try? c.decode(MessageProvenance.self, forKey: .provenance))
                      ?? ((try? c.decode(Bool.self, forKey: .isFromUser)) == true ? .user : .agent)
        embeddedCard   = try c.decodeIfPresent(EmbeddedCard.self, forKey: .embeddedCard)
        attachments    = (try? c.decode([MessageAttachment].self, forKey: .attachments)) ?? []
        metadata       = try c.decodeIfPresent(MessageMetadata.self, forKey: .metadata)
        isFromUser     = (try? c.decode(Bool.self, forKey: .isFromUser)) ?? false
        createdAt      = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
        updatedAt      = (try? c.decode(Date.self, forKey: .updatedAt)) ?? createdAt
        isEdited       = (try? c.decode(Bool.self, forKey: .isEdited)) ?? false
        replyToId      = try c.decodeIfPresent(String.self, forKey: .replyToId)
    }
}

enum MessageType: String, Codable, Hashable, Sendable {
    case text
    case system
    case embeddedCard = "embedded_card"
    case attachment
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = MessageType(rawValue: raw) ?? .unknown
    }
}

enum MessageProvenance: String, Codable, Hashable, Sendable {
    case user
    case agent
    case meetingBrief = "meeting_brief"
    case scheduledInjection = "scheduled_injection"
    case meetingSystem = "meeting_system"
}

struct MessageMetadata: Codable, Hashable, Sendable {
    var meetingId: String?
    var briefVersion: Int?
    var scheduledMessageId: String?
    var traceType: String?
    var documentReferences: [DocumentReference]?
    var referenceSummary: MessageDocumentReferenceSummary?
    var syncState: ClientSyncState?
    var runtimeAvailability: RuntimeAvailability?
    var dispatchStatus: String?
    var relaySync: RelaySyncProvenance?
}

enum ClientSyncState: String, Codable, Hashable, Sendable {
    case offline, queued, syncing, synchronized, conflicted, unavailable, revoked
}

struct RelaySyncProvenance: Codable, Hashable, Sendable {
    var sourceInstallationId: String?
    var sourceObjectId: String?
    var historical: Bool?
}

struct MessageDocumentReferenceSummary: Codable, Hashable, Sendable {
    var count: Int?
    var hasSensitive: Bool?
    var redactedCount: Int?
}

struct DocumentReference: Codable, Identifiable, Hashable, Sendable {
    var id: String?
    var kind: DocumentReferenceKind
    var title: String?
    var displayPath: String?
    var uri: String?
    var mimeType: String?
    var role: DocumentReferenceRole?
    var action: DocumentReferenceAction?
    var source: DocumentReferenceSource?
    var confidence: DocumentReferenceConfidence?
    var sensitive: Bool
    var redacted: Bool

    init(
        id: String? = nil,
        kind: DocumentReferenceKind = .unknown,
        title: String? = nil,
        displayPath: String? = nil,
        uri: String? = nil,
        mimeType: String? = nil,
        role: DocumentReferenceRole? = nil,
        action: DocumentReferenceAction? = nil,
        source: DocumentReferenceSource? = nil,
        confidence: DocumentReferenceConfidence? = nil,
        sensitive: Bool = false,
        redacted: Bool = false
    ) {
        self.id = id
        self.kind = kind
        self.title = title
        self.displayPath = displayPath
        self.uri = uri
        self.mimeType = mimeType
        self.role = role
        self.action = action
        self.source = source
        self.confidence = confidence
        self.sensitive = sensitive
        self.redacted = redacted
    }

    enum CodingKeys: String, CodingKey {
        case id, kind, title, displayPath, uri, mimeType, role, action, source, confidence, sensitive, redacted
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = Self.clean(try c.decodeIfPresent(String.self, forKey: .id), maxLength: 80)
        kind = (try? c.decode(DocumentReferenceKind.self, forKey: .kind)) ?? .unknown
        title = Self.clean(try c.decodeIfPresent(String.self, forKey: .title), maxLength: 120)
        displayPath = Self.clean(try c.decodeIfPresent(String.self, forKey: .displayPath), maxLength: 240)
        uri = Self.clean(try c.decodeIfPresent(String.self, forKey: .uri), maxLength: 500)
        mimeType = Self.clean(try c.decodeIfPresent(String.self, forKey: .mimeType), maxLength: 120)
        role = try? c.decodeIfPresent(DocumentReferenceRole.self, forKey: .role)
        action = try? c.decodeIfPresent(DocumentReferenceAction.self, forKey: .action)
        source = try? c.decodeIfPresent(DocumentReferenceSource.self, forKey: .source)
        confidence = try? c.decodeIfPresent(DocumentReferenceConfidence.self, forKey: .confidence)
        sensitive = (try? c.decode(Bool.self, forKey: .sensitive)) ?? false
        redacted = (try? c.decode(Bool.self, forKey: .redacted)) ?? false
    }

    private static func clean(_ value: String?, maxLength: Int) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return nil
        }
        return String(trimmed.prefix(maxLength))
    }
}

enum DocumentReferenceKind: String, Codable, Hashable, Sendable {
    case workspaceFile = "workspace_file"
    case memoryFile = "memory_file"
    case skill
    case workflow
    case libraryDoc = "library_doc"
    case systemDoc = "system_doc"
    case web
    case artifact
    case unknown

    init(from decoder: Decoder) throws {
        let raw = try decoder.singleValueContainer().decode(String.self)
        self = DocumentReferenceKind(rawValue: raw) ?? .unknown
    }
}

enum DocumentReferenceRole: String, Codable, Hashable, Sendable {
    case knowledge, routing, rule, memory, evidence, artifact
}

enum DocumentReferenceAction: String, Codable, Hashable, Sendable {
    case consulted, read
    case routedTo = "routed_to"
    case used, generated, modified
}

enum DocumentReferenceSource: String, Codable, Hashable, Sendable {
    case toolCall = "tool_call"
    case toolResult = "tool_result"
    case promptContext = "prompt_context"
    case skillRouter = "skill_router"
    case workflowRouter = "workflow_router"
    case agentDeclared = "agent_declared"
    case parsedMarkdown = "parsed_markdown"
}

enum DocumentReferenceConfidence: String, Codable, Hashable, Sendable {
    case observed, injected, inferred
    case agentDeclared = "agent_declared"
}

struct MessageAttachment: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var filename: String
    var url: String
    var mimeType: String
    var size: Int
}

struct EmbeddedCard: Hashable, Sendable {
    var type: EmbeddedCardType
    var title: String
    var subtitle: String?
    var status: String?
    var metadata: [String: String]
    var actionUrl: String?
    var referenceId: String?
    var color: String?
}

extension EmbeddedCard: Codable {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        type        = (try? c.decode(EmbeddedCardType.self, forKey: .type)) ?? .task
        title       = (try? c.decode(String.self, forKey: .title)) ?? ""
        subtitle    = try c.decodeIfPresent(String.self, forKey: .subtitle)
        status      = try c.decodeIfPresent(String.self, forKey: .status)
        metadata    = (try? c.decode([String: String].self, forKey: .metadata)) ?? [:]
        actionUrl   = try c.decodeIfPresent(String.self, forKey: .actionUrl)
        referenceId = try c.decodeIfPresent(String.self, forKey: .referenceId)
        color       = try c.decodeIfPresent(String.self, forKey: .color)
    }
}

enum EmbeddedCardType: String, Codable, Hashable, Sendable {
    case task
    case approval
    case incident
    case report
    case audit
    case handoff
    case workLog = "work_log"
    case performance
    case alert
    case runResult = "run_result"
    case paperclip
}

// MARK: - Task & Runs

struct Task: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var title: String
    var description: String
    var status: TaskStatus
    var priority: TaskPriority
    var assignedAgentId: String?
    var teamId: String?
    var workspaceId: String
    var createdByUserId: String?
    var createdByAgentId: String?
    var dueAt: Date?
    var completedAt: Date?
    var createdAt: Date
    var updatedAt: Date
    var tags: [String]
    var budgetUsed: Double
    var estimatedMinutes: Int?
    var actualMinutes: Int?
    var runCount: Int
    var lastRunAt: Date?
    var requiresApproval: Bool
    var approvalId: String?
    var messageBody: String?
    var targetType: String?
    var targetAgentId: String?
    var targetAgentTwoId: String?
    var targetDepartmentId: String?
    var scheduledFor: Date?
    var nextRunAt: Date?
    var timezone: String?
    var recurrenceRule: String?
    var lastDispatchedAt: Date?
    var lastError: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case status
        case priority
        case assignedAgentId
        case teamId
        case workspaceId
        case createdByUserId
        case createdByAgentId
        case dueAt
        case completedAt
        case createdAt
        case updatedAt
        case tags
        case budgetUsed
        case estimatedMinutes
        case actualMinutes
        case runCount
        case lastRunAt
        case requiresApproval
        case approvalId
        case messageBody
        case targetType
        case targetAgentId
        case targetAgentTwoId
        case targetDepartmentId
        case scheduledFor
        case nextRunAt
        case timezone
        case recurrenceRule
        case lastDispatchedAt
        case lastError
    }

    init(
        id: String,
        title: String,
        description: String,
        status: TaskStatus,
        priority: TaskPriority,
        assignedAgentId: String? = nil,
        teamId: String? = nil,
        workspaceId: String,
        createdByUserId: String? = nil,
        createdByAgentId: String? = nil,
        dueAt: Date? = nil,
        completedAt: Date? = nil,
        createdAt: Date,
        updatedAt: Date,
        tags: [String] = [],
        budgetUsed: Double = 0,
        estimatedMinutes: Int? = nil,
        actualMinutes: Int? = nil,
        runCount: Int = 0,
        lastRunAt: Date? = nil,
        requiresApproval: Bool = false,
        approvalId: String? = nil,
        messageBody: String? = nil,
        targetType: String? = nil,
        targetAgentId: String? = nil,
        targetAgentTwoId: String? = nil,
        targetDepartmentId: String? = nil,
        scheduledFor: Date? = nil,
        nextRunAt: Date? = nil,
        timezone: String? = nil,
        recurrenceRule: String? = nil,
        lastDispatchedAt: Date? = nil,
        lastError: String? = nil
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.status = status
        self.priority = priority
        self.assignedAgentId = assignedAgentId
        self.teamId = teamId
        self.workspaceId = workspaceId
        self.createdByUserId = createdByUserId
        self.createdByAgentId = createdByAgentId
        self.dueAt = dueAt
        self.completedAt = completedAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.tags = tags
        self.budgetUsed = budgetUsed
        self.estimatedMinutes = estimatedMinutes
        self.actualMinutes = actualMinutes
        self.runCount = runCount
        self.lastRunAt = lastRunAt
        self.requiresApproval = requiresApproval
        self.approvalId = approvalId
        self.messageBody = messageBody
        self.targetType = targetType
        self.targetAgentId = targetAgentId
        self.targetAgentTwoId = targetAgentTwoId
        self.targetDepartmentId = targetDepartmentId
        self.scheduledFor = scheduledFor
        self.nextRunAt = nextRunAt
        self.timezone = timezone
        self.recurrenceRule = recurrenceRule
        self.lastDispatchedAt = lastDispatchedAt
        self.lastError = lastError
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let decodedMessageBody = try? container.decodeIfPresent(String.self, forKey: .messageBody)
        let decodedCreatedAt = (try? container.decode(Date.self, forKey: .createdAt)) ?? Date()

        id = (try? container.decode(String.self, forKey: .id)) ?? UUID().uuidString
        messageBody = decodedMessageBody
        title = (try? container.decode(String.self, forKey: .title)) ?? decodedMessageBody ?? "Untitled task"
        description = (try? container.decode(String.self, forKey: .description)) ?? decodedMessageBody ?? ""
        status = (try? container.decode(TaskStatus.self, forKey: .status)) ?? .queued
        priority = (try? container.decode(TaskPriority.self, forKey: .priority)) ?? .normal
        assignedAgentId = try? container.decodeIfPresent(String.self, forKey: .assignedAgentId)
        teamId = try? container.decodeIfPresent(String.self, forKey: .teamId)
        workspaceId = (try? container.decode(String.self, forKey: .workspaceId)) ?? ""
        createdByUserId = try? container.decodeIfPresent(String.self, forKey: .createdByUserId)
        createdByAgentId = try? container.decodeIfPresent(String.self, forKey: .createdByAgentId)
        dueAt = try? container.decodeIfPresent(Date.self, forKey: .dueAt)
        completedAt = try? container.decodeIfPresent(Date.self, forKey: .completedAt)
        createdAt = decodedCreatedAt
        updatedAt = (try? container.decode(Date.self, forKey: .updatedAt)) ?? decodedCreatedAt
        tags = (try? container.decode([String].self, forKey: .tags)) ?? []
        budgetUsed = (try? container.decode(Double.self, forKey: .budgetUsed)) ?? 0
        estimatedMinutes = try? container.decodeIfPresent(Int.self, forKey: .estimatedMinutes)
        actualMinutes = try? container.decodeIfPresent(Int.self, forKey: .actualMinutes)
        runCount = (try? container.decode(Int.self, forKey: .runCount)) ?? 0
        lastRunAt = try? container.decodeIfPresent(Date.self, forKey: .lastRunAt)
        requiresApproval = (try? container.decode(Bool.self, forKey: .requiresApproval)) ?? false
        approvalId = try? container.decodeIfPresent(String.self, forKey: .approvalId)
        targetType = try? container.decodeIfPresent(String.self, forKey: .targetType)
        targetAgentId = try? container.decodeIfPresent(String.self, forKey: .targetAgentId)
        targetAgentTwoId = try? container.decodeIfPresent(String.self, forKey: .targetAgentTwoId)
        targetDepartmentId = try? container.decodeIfPresent(String.self, forKey: .targetDepartmentId)
        scheduledFor = try? container.decodeIfPresent(Date.self, forKey: .scheduledFor)
        nextRunAt = try? container.decodeIfPresent(Date.self, forKey: .nextRunAt)
        timezone = try? container.decodeIfPresent(String.self, forKey: .timezone)
        recurrenceRule = try? container.decodeIfPresent(String.self, forKey: .recurrenceRule)
        lastDispatchedAt = try? container.decodeIfPresent(Date.self, forKey: .lastDispatchedAt)
        lastError = try? container.decodeIfPresent(String.self, forKey: .lastError)
    }
}

enum TaskStatus: String, Codable, Hashable, Sendable {
    case queued
    case dispatched
    case running
    case blocked
    case awaitingApproval = "awaiting_approval"
    case failed
    case completed
    case cancelled

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = (try? container.decode(String.self)) ?? Self.queued.rawValue
        self = Self(rawValue: rawValue) ?? .queued
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

enum TaskPriority: String, Codable, Hashable, Sendable {
    case low
    case normal
    case high
    case urgent
    case critical

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = (try? container.decode(String.self)) ?? Self.normal.rawValue
        self = Self(rawValue: rawValue) ?? .normal
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

struct TaskAssignment: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let taskId: String
    let agentId: String
    let assignedAt: Date
    var completedAt: Date?
    var role: String
}

struct Run: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var taskId: String
    var agentId: String
    var status: RunStatus
    var startedAt: Date
    var completedAt: Date?
    var errorMessage: String?
    var eventsCount: Int
    var tokensUsed: Int
    var cost: Double
}

enum RunStatus: String, Codable, Hashable, Sendable {
    case running
    case completed
    case failed
    case cancelled
    case timedOut = "timed_out"
}

struct RunEvent: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var runId: String
    var type: String
    var content: String
    var timestamp: Date
    var metadata: [String: String]
}

// MARK: - Approvals

struct Approval: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var title: String
    var description: String
    var status: ApprovalStatus
    var requestedByAgentId: String
    var taskId: String?
    var workspaceId: String
    var risk: RiskLevel
    var steps: [ApprovalStep]
    var metadata: [String: JSONValue]
    var createdAt: Date
    var updatedAt: Date
    var resolvedAt: Date?
    var resolvedByUserId: String?
    var expiresAt: Date?
    var notes: String?

    init(
        id: String,
        title: String,
        description: String,
        status: ApprovalStatus,
        requestedByAgentId: String,
        taskId: String?,
        workspaceId: String,
        risk: RiskLevel,
        steps: [ApprovalStep],
        createdAt: Date,
        resolvedAt: Date?,
        expiresAt: Date?,
        notes: String?,
        metadata: [String: JSONValue] = [:],
        updatedAt: Date? = nil,
        resolvedByUserId: String? = nil
    ) {
        self.id = id
        self.title = title
        self.description = description
        self.status = status
        self.requestedByAgentId = requestedByAgentId
        self.taskId = taskId
        self.workspaceId = workspaceId
        self.risk = risk
        self.steps = steps
        self.metadata = metadata
        self.createdAt = createdAt
        self.updatedAt = updatedAt ?? createdAt
        self.resolvedAt = resolvedAt
        self.resolvedByUserId = resolvedByUserId
        self.expiresAt = expiresAt
        self.notes = notes
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = (try? c.decode(String.self, forKey: .title)) ?? "Approval"
        description = (try? c.decode(String.self, forKey: .description)) ?? ""
        status = (try? c.decode(ApprovalStatus.self, forKey: .status)) ?? .pending
        requestedByAgentId = (try? c.decode(String.self, forKey: .requestedByAgentId)) ?? "Unknown agent"
        taskId = try? c.decodeIfPresent(String.self, forKey: .taskId)
        workspaceId = (try? c.decode(String.self, forKey: .workspaceId)) ?? ""
        risk = (try? c.decode(RiskLevel.self, forKey: .risk)) ?? .medium
        steps = (try? c.decode([ApprovalStep].self, forKey: .steps)) ?? []
        metadata = (try? c.decode([String: JSONValue].self, forKey: .metadata)) ?? [:]
        createdAt = (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
        updatedAt = (try? c.decode(Date.self, forKey: .updatedAt)) ?? createdAt
        resolvedAt = try? c.decodeIfPresent(Date.self, forKey: .resolvedAt)
        resolvedByUserId = try? c.decodeIfPresent(String.self, forKey: .resolvedByUserId)
        expiresAt = try? c.decodeIfPresent(Date.self, forKey: .expiresAt)
        notes = try? c.decodeIfPresent(String.self, forKey: .notes)
    }
}

enum ApprovalStatus: String, Codable, Hashable, Sendable {
    case pending
    case approved
    case rejected
    case expired
    case cancelled
}

enum RiskLevel: String, Codable, Hashable, Sendable {
    case low
    case medium
    case high
    case critical
}

struct ApprovalStep: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var approvalId: String
    var order: Int
    var approverId: String?
    var status: ApprovalStatus
    var notes: String?
    var resolvedAt: Date?
}

// MARK: - Incidents

struct Incident: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var title: String
    var description: String
    var status: IncidentStatus
    var severity: IncidentSeverity
    var agentId: String?
    var teamId: String?
    var workspaceId: String
    var taskId: String?
    var runId: String?
    var createdAt: Date
    var resolvedAt: Date?
    var resolutionNotes: String?
    var tags: [String]
    var affectedSystems: [String]
}

enum IncidentStatus: String, Codable, Hashable, Sendable {
    case open
    case investigating
    case mitigated
    case resolved
    case closed
}

enum IncidentSeverity: String, Codable, Hashable, Sendable {
    case low
    case medium
    case high
    case critical
}

// MARK: - Work Logs & Schedule

struct WorkLog: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var agentId: String
    var taskId: String?
    var runId: String?
    var action: String
    var details: String
    var timestamp: Date
    var durationMinutes: Int?
    var metadata: [String: String]
}

struct Schedule: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var agentId: String?
    var teamId: String?
    var departmentId: String?
    var mode: WorkingHoursMode
    var timezone: String
    var shifts: [ShiftRule]
    var isActive: Bool
    var createdAt: Date
    var updatedAt: Date
}

struct ShiftRule: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var scheduleId: String
    var dayOfWeek: Int  // 0=Sun, 6=Sat
    var startTime: String  // "HH:mm"
    var endTime: String    // "HH:mm"
    var isActive: Bool
}

struct AvailabilityState: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var agentId: String
    var status: AgentStatus
    var reason: String?
    var since: Date
    var until: Date?
    var setByUserId: String?
}

struct HandoverNote: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var fromAgentId: String
    var toAgentId: String?
    var toTeamId: String?
    var content: String
    var taskIds: [String]
    var createdAt: Date
    var acknowledgedAt: Date?
}

// MARK: - Performance & Review

struct PerformanceMetric: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var agentId: String
    var period: MetricPeriod
    var periodStart: Date
    var periodEnd: Date
    var tasksCompleted: Int
    var tasksFailed: Int
    var tasksRetried: Int
    var successRate: Double
    var avgCompletionMinutes: Double
    var totalMinutesWorked: Int
    var tokensUsed: Int
    var cost: Double
    var qualityScore: Double?
    var incidentCount: Int
    var approvalCount: Int
}

enum MetricPeriod: String, Codable, Hashable, Sendable {
    case daily
    case weekly
    case monthly
    case custom
}

struct Review: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var agentId: String
    var reviewerId: String
    var period: MetricPeriod
    var periodStart: Date
    var periodEnd: Date
    var overallRating: Int  // 1-5
    var summary: String
    var strengths: [String]
    var improvements: [String]
    var createdAt: Date
}

struct CoachingNote: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var agentId: String
    var authorId: String
    var content: String
    var type: CoachingType
    var relatedTaskId: String?
    var createdAt: Date
}

enum CoachingType: String, Codable, Hashable, Sendable {
    case correction
    case improvement
    case praise
    case instruction
    case warning
}

// MARK: - Permissions

struct PermissionPolicy: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var name: String
    var workspaceId: String
    var scope: PermissionScope
    var scopeId: String
    var permissions: [String]
    var createdAt: Date
}

enum PermissionScope: String, Codable, Hashable, Sendable {
    case workspace
    case company
    case department
    case team
    case agent
}

// MARK: - Team Memory

struct TeamMemoryItem: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var teamId: String
    var title: String
    var content: String
    var type: MemoryItemType
    var tags: [String]
    var createdAt: Date
    var updatedAt: Date
    var createdById: String
}

enum MemoryItemType: String, Codable, Hashable, Sendable {
    case rule
    case context
    case document
    case sop = "SOP"
    case note
}

// MARK: - Alerts

struct Alert: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var title: String
    var message: String
    var type: AlertType
    var severity: IncidentSeverity
    var workspaceId: String
    var agentId: String?
    var taskId: String?
    var isRead: Bool
    var createdAt: Date
    var expiresAt: Date?
}

enum AlertType: String, Codable, Hashable, Sendable {
    case missedTask = "missed_task"
    case stuckJob = "stuck_job"
    case repeatedFailure = "repeated_failure"
    case policyViolation = "policy_violation"
    case budgetWarning = "budget_warning"
    case agentDown = "agent_down"
    case approvalExpired = "approval_expired"
    case incidentOpened = "incident_opened"
}

// MARK: - Budget & Reports

struct BudgetUsageRecord: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var agentId: String?
    var teamId: String?
    var departmentId: String?
    var workspaceId: String
    var tokensUsed: Int
    var cost: Double
    var period: String
    var periodStart: Date
    var periodEnd: Date
    var createdAt: Date
}

struct ReportSnapshot: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var title: String
    var type: ReportType
    var workspaceId: String
    var period: MetricPeriod
    var periodStart: Date
    var periodEnd: Date
    var data: ReportData
    var createdAt: Date
}

struct ThreadWrapUpReport: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var threadId: String
    var workspaceId: String
    var teamId: String?
    var title: String
    var fileName: String
    var provider: String
    var model: String
    var markdown: String
    var messageCount: Int
    var status: String?
    var errorMessage: String?
    var threadSessionSequenceNumber: Int?
    var createdAt: Date
    var updatedAt: Date
}

enum ReportType: String, Codable, Hashable, Sendable {
    case performance
    case reliability
    case workload
    case budget
    case incident
    case custom
    case wrapUp = "wrap_up"
}

struct ReportData: Codable, Hashable, Sendable {
    var totalTasks: Int
    var completedTasks: Int
    var failedTasks: Int
    var successRate: Double
    var totalAgents: Int
    var activeAgents: Int
    var totalMinutesWorked: Int
    var totalCost: Double
    var incidentCount: Int
    var topAgents: [AgentSummary]
    var teamSummaries: [TeamSummary]
}

struct AgentSummary: Codable, Hashable, Sendable {
    var agentId: String
    var name: String
    var tasksCompleted: Int
    var successRate: Double
}

struct TeamSummary: Codable, Hashable, Sendable {
    var teamId: String
    var name: String
    var agentCount: Int
    var tasksCompleted: Int
    var successRate: Double
}

struct BridgeDeviceCompatibility: Codable, Hashable, Sendable {
    let compatible: Bool
    let code: String?
    let release: String?
    let releaseStatus: String?
    let level: String?
    let operatingMode: String?
    let verifiedRuntime: Bool?
    let enabledCapabilities: [String]?
    let disabledCapabilities: [String]?
    let warnings: [String]?
}

struct BridgeDeviceSummary: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let workspaceId: String
    let label: String
    let devicePublicId: String
    let status: String
    let capabilities: [String]
    let openCoreVersion: String?
    let pluginVersion: String?
    let runtimeType: String?
    let hostType: String?
    let health: String
    let compatibility: BridgeDeviceCompatibility
    let credentialVersion: Int
    let credentialRotatedAt: Date?
    let lastSeenAt: Date?
    let revokedAt: Date?
    let createdAt: Date
    let updatedAt: Date
}

struct RuntimeHostSummary: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let workspaceId: String
    let displayName: String
    let hostKind: String
    let platform: String?
    let status: String
    let supportedRuntimes: [String]
    let lastSeenAt: Date?
}

struct NativeAgentObservation: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let runtimeHostId: String
    let runtimeType: String
    let externalAgentId: String
    let connectionState: String
    let origin: String
    let status: String
    let displayMetadata: [String: JSONValue]
    let observedState: [String: JSONValue]?
    let compatibilityStatus: String
    let compatibilityReason: String?
    let agentId: String?
    let lastSeenAt: Date?
    let lastScannedAt: Date?
    let isDismissed: Bool?

    var displayName: String {
        guard case .string(let value)? = displayMetadata["name"] else {
            return externalAgentId
        }
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? externalAgentId : normalized
    }

    var lastConnectionError: String? {
        guard case .string(let value)? = observedState?["lastConnectionError"] else {
            return nil
        }
        return value.isEmpty ? nil : value
    }
}

struct RuntimeProvisioningTargetSummary: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let workspaceId: String
    let runtimeType: String
    let runtimeHostId: String?
    let status: String
    let selectionSource: String
    let statusReason: String?
}

struct RuntimeAuthoritySummary: Codable, Hashable, Sendable {
    let hosts: [RuntimeHostSummary]
}

struct ConnectNativeAgentsResult: Codable, Hashable, Sendable {
    struct Row: Codable, Hashable, Sendable {
        let observationId: String
        let status: String
        let error: String?
    }
    let results: [Row]
}

struct DisconnectNativeAgentResult: Codable, Hashable, Sendable {
    let observationId: String
    let agentId: String?
    let connectionState: String
    let nativeAgentPreserved: Bool
    let disconnectedAt: Date
}

struct DismissNativeAgentResult: Codable, Hashable, Sendable {
    let observationId: String
    let dismissed: Bool
    let dismissedAt: Date
    let identitySuppressed: Bool
    let nativeAgentPreserved: Bool
}

struct OpenClawBridgeEvent: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var connectionId: String
    var type: String
    var payload: [String: String]
    var status: BridgeEventStatus
    var createdAt: Date
    var processedAt: Date?
    var error: String?
}

enum BridgeEventStatus: String, Codable, Hashable, Sendable {
    case pending
    case processed
    case failed
    case retrying
}

// MARK: - Pagination

struct PaginatedResponse<T: Codable & Sendable>: Codable, Sendable {
    var data: [T]
    var total: Int
    var page: Int
    var pageSize: Int
    var hasMore: Bool

    init(data: [T], total: Int, page: Int, pageSize: Int, hasMore: Bool) {
        self.data = data
        self.total = total
        self.page = page
        self.pageSize = pageSize
        self.hasMore = hasMore
    }

    // Resilient decoder: only `data` is truly required; all pagination fields fall back to defaults.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        do {
            data = try c.decode([T].self, forKey: .data)
        } catch {
            _Concurrency.Task { @MainActor in
                Telemetry.shared.capture(
                    error: error,
                    attributes: ["operation": "paginated_response.decode", "itemType": String(describing: T.self)]
                )
            }
            data = []
        }
        total    = (try? c.decode(Int.self, forKey: .total))    ?? data.count
        page     = (try? c.decode(Int.self, forKey: .page))     ?? 1
        pageSize = (try? c.decode(Int.self, forKey: .pageSize)) ?? data.count
        hasMore  = (try? c.decode(Bool.self, forKey: .hasMore)) ?? false
    }
}

struct PageMeta: Codable, Sendable {
    var total: Int
    var page: Int
    var pageSize: Int
    var hasMore: Bool
}

// MARK: - Flexible JSON

enum JSONValue: Codable, Hashable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let value = try? c.decode(Bool.self) { self = .bool(value) }
        else if let value = try? c.decode(Double.self) { self = .number(value) }
        else if let value = try? c.decode(String.self) { self = .string(value) }
        else if let value = try? c.decode([JSONValue].self) { self = .array(value) }
        else if let value = try? c.decode([String: JSONValue].self) { self = .object(value) }
        else { self = .null }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .string(let value): try c.encode(value)
        case .number(let value): try c.encode(value)
        case .bool(let value): try c.encode(value)
        case .object(let value): try c.encode(value)
        case .array(let value): try c.encode(value)
        case .null: try c.encodeNil()
        }
    }

    var displayString: String {
        switch self {
        case .string(let value): return value
        case .number(let value): return String(value)
        case .bool(let value): return value ? "true" : "false"
        case .object(let value): return "\(value.count) fields"
        case .array(let value): return "\(value.count) items"
        case .null: return "null"
        }
    }
}

// MARK: - Applications Marketplace

struct MarketplaceCatalog: Codable, Hashable, Sendable {
    var releaseManifest: MarketplaceReleaseManifestSummary?
    var categories: [MarketplaceCategory]
    var apps: [MarketplaceApp]
}

struct MarketplaceCatalogPage: Codable, Hashable, Sendable {
    var releaseManifest: MarketplaceReleaseManifestSummary?
    var categories: [MarketplaceCategory]
    var apps: [MarketplaceApp]
    var pageInfo: MarketplaceCatalogPageInfo
}

struct MarketplaceCatalogPageInfo: Codable, Hashable, Sendable {
    var totalCount: Int
    var limit: Int
    var hasNextPage: Bool
    var nextCursor: String?
}

struct MarketplaceReleaseManifestSummary: Codable, Hashable, Sendable {
    var schemaVersion: String
    var manifestVersion: String
    var releaseChannel: String
    var freezeStatus: String
    var frozenAt: String?
    var sourceRevision: String?
}

struct MarketplaceAppRelease: Codable, Hashable, Sendable {
    var manifestVersion: String
    var releaseChannel: String
    var freezeStatus: String
    var state: String
    var label: String
    var connectEligible: Bool
    var liveVerified: Bool
    var reason: String
}

struct MarketplaceCategory: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var label: String
}

struct MarketplaceActionPolicy: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var label: String
    var description: String
}

struct MarketplaceCapability: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var label: String
    var description: String
    var defaultEnabled: Bool
}

struct MarketplaceCredentialRequirement: Codable, Identifiable, Hashable, Sendable {
    var name: String
    var label: String
    var required: Bool
    var secret: Bool
    var helpText: String
    var requiredForAuthTypes: [String]?
    var inputType: String?
    var options: [MarketplaceCredentialOption]?
    var defaultValue: String?

    var id: String { name }
}

struct MarketplaceCredentialOption: Codable, Hashable, Sendable {
    var value: String
    var label: String
}

struct MarketplaceApprovalProfile: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var label: String
    var description: String
    var defaultSelected: Bool
    var allowedActions: [MarketplaceActionPolicy]?
    var approvalRequiredActions: [MarketplaceActionPolicy]?
    var blockedActions: [MarketplaceActionPolicy]?
}

struct MarketplaceRuntimeSupport: Codable, Hashable, Sendable {
    var format: String
    var installSupport: String
    var label: String
    var description: String
}

struct MarketplaceRoleManifestEntry: Codable, Identifiable, Hashable, Sendable {
    var role: String
    var label: String
    var purpose: String
    var docsSourcePath: String?
    var runtimeOutputPath: String?
    var canWrite: JSONValue
    var readOnly: Bool
    var approvalRequiredFor: [String]
    var blockedActions: [String]
    var required: Bool
    var installAfterSetup: Bool
    var recommendedAgentName: String?
    var recommendedAgentType: String?
    var installable: Bool
    var notInstallableReason: String?
    var source: String

    var id: String { role }
}

struct MarketplaceRoleManifest: Codable, Hashable, Sendable {
    var roles: [MarketplaceRoleManifestEntry]
    var roleCount: Int
}

struct MarketplaceApp: Codable, Identifiable, Hashable, Sendable {
    var slug: String
    var name: String
    var sourceType: String
    var category: String
    var description: String
    var agentUseSummary: String
    var connectionTypes: [String]
    var credentialRequirements: [MarketplaceCredentialRequirement]
    var webhookRequirements: [String]
    var approvalProfile: String
    var approvalProfiles: [MarketplaceApprovalProfile]
    var riskLevel: String
    var capabilities: [MarketplaceCapability]
    var allowedActions: [MarketplaceActionPolicy]
    var approvalRequiredActions: [MarketplaceActionPolicy]
    var blockedActions: [MarketplaceActionPolicy]
    var providerDocsUrl: String
    var providerWebsiteUrl: String
    var accountCreationUrl: String? = nil
    var oauthAccessOptions: [MarketplaceOAuthAccessOption]? = nil
    var runtimeSupport: [MarketplaceRuntimeSupport]
    var roleManifest: MarketplaceRoleManifest?
    var availability: String
    var release: MarketplaceAppRelease?

    var id: String { slug }
    var connectEligible: Bool {
        if let release { return release.connectEligible }
        return sourceType == "local_repo" || availability.lowercased() == "available"
    }
    var availabilityLabel: String {
        release?.label ?? availability.replacingOccurrences(of: "_", with: " ").capitalized
    }
    var unavailableReason: String? {
        connectEligible ? nil : release?.reason
    }
}

struct MarketplaceOAuthAccessOption: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var label: String
    var description: String
    var scopes: [String]
    var capabilityIds: [String]
    var defaultSelected: Bool
}

struct MarketplaceConnection: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var workspaceId: String
    var appSlug: String
    var displayName: String
    var environment: String
    var authType: String
    var executionAuthority: String?
    var credentialNames: [String]
    var selectedCapabilities: [String]
    var status: String
    var lastValidatedAt: Date?
    var lastErrorCode: String?
    var lastErrorMessage: String?
    var metadata: [String: JSONValue]
    var createdAt: Date
    var updatedAt: Date

    var requiresDeviceRuntime: Bool { executionAuthority == "swift" }

    var availabilityLabel: String {
        requiresDeviceRuntime
            ? "Available when your Mac and bridge are online"
            : "Available through Relay"
    }
}

struct MarketplaceConnectorHealth: Codable, Hashable, Sendable {
    var status: String
    var connectionId: String
    var appSlug: String
    var tokenValid: Bool
    var refreshAvailable: Bool
    var grantedScopes: [String]
    var missingScopes: [String]
    var accountLabel: String?
    var lastCheckedAt: Date
    var errorCode: String?
    var message: String?
}

struct MarketplaceOAuthStart: Codable, Hashable, Sendable {
    var authorizationUrl: String?
    var callbackUrl: String
    var requiredScopes: [String]
    var optionalScopes: [String]
    var expiresAt: Date
    var completed: Bool?
    var connection: MarketplaceConnection?
    var returnTo: String?
}

struct MarketplaceInstall: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var workspaceId: String
    var appSlug: String
    var connectionId: String?
    var agentId: String
    var packId: String
    var agentDocumentationInstallId: String?
    var role: String
    var selectedCapabilities: [String]
    var installStatus: String
    var driftStatus: String
    var lastInstalledAt: Date?
    var metadata: [String: JSONValue]
    var createdAt: Date
    var updatedAt: Date
}

struct MarketplaceInstallResult: Codable, Hashable, Sendable {
    var installs: [MarketplaceInstall]?
    var warnings: [String]?
    var status: String?
    var message: String?
}

struct MarketplaceToolRequest: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var workspaceId: String
    var appSlug: String?
    var teamId: String?
    var threadId: String?
    var requestingAgentId: String?
    var requestingAgentName: String?
    var role: String?
    var requestedCapability: String
    var requiredForAction: String
    var reason: String
    var policyAllowed: Bool
    var toolAvailable: Bool
    var toolConnected: Bool
    var toolGranted: Bool
    var suggestedMarketplaceAppSlugs: [String]
    var suggestedToolCategories: [String]
    var status: String
    var resolutionNotes: String?
    var metadata: [String: JSONValue]
    var lastSeenAt: Date?
    var createdAt: Date
    var updatedAt: Date
}

// MARK: - Agent Runtime

enum AgentRuntimeType: String, Codable, Hashable, Sendable {
    case claudeCode = "claude_code"
    case hermes
    case openClaw = "open_claw"
    case unknown

    init(from decoder: Decoder) throws {
        let rawValue = try decoder.singleValueContainer().decode(String.self)
        switch rawValue.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "claude", "claude-code", "claude_code":
            self = .claudeCode
        case "hermes":
            self = .hermes
        case "openclaw", "open-claw", "open_claw":
            self = .openClaw
        default:
            // The Relay control plane can retain legacy/manual source labels for agents that
            // do not yet have a runtime binding. One such item must never make
            // the entire paginated agent roster undecodable.
            self = .unknown
        }
    }
}

struct HarnessModelCatalog: Codable, Hashable, Sendable {
    let source: String
    let observedAt: String?
    let stale: Bool?
    let harnesses: [String: HarnessModelOptions]
}

struct HarnessModelOptions: Codable, Hashable, Sendable {
    let defaultModel: String
    let models: [String]
    let source: String?
    let observedAt: String?
    let stale: Bool?
}

// MARK: - Agent Library

struct AgentLibraryFile: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var agentId: String
    var filename: String
    var content: String
    var sizeBytes: Int
    var createdAt: Date
    var updatedAt: Date
}

// MARK: - OpenClaw Workspace Files

struct LibraryFolderEntry: Codable, Identifiable, Hashable, Sendable {
    var name: String
    var path: String
    var id: String { path }
}

struct LibraryFileEntry: Codable, Identifiable, Hashable, Sendable {
    var filename: String
    var path: String
    var size: Int
    var updatedAt: Date?
    var documentId: String? = nil
    var documentKind: String? = nil
    var desiredVersion: String? = nil
    var appliedVersion: String? = nil
    var syncState: String? = nil
    var runtimeHostId: String? = nil
    var lastObservedAt: Date? = nil
    var tombstoned: Bool? = nil
    var id: String { path }
}

struct LibraryListResult: Codable, Hashable, Sendable {
    var folder: String
    var folders: [LibraryFolderEntry]
    var files: [LibraryFileEntry]
}

struct LibraryReadResult: Codable, Hashable, Sendable {
    var folder: String
    var filename: String
    var content: String
    var size: Int
    var updatedAt: Date?
}

struct LibraryWriteResult: Codable, Hashable, Sendable {
    var folder: String
    var written: [String]
    var createdFolder: Bool?
}

struct LibraryDeleteResult: Codable, Hashable, Sendable {
    var folder: String
    var filename: String?
    var deleted: Bool?
}

enum ArtifactPresentationState: String, Codable, Hashable, Sendable {
    case available
    case unavailable
    case moved
    case expired
    case deleted
    case permissionDenied = "permission_denied"

    var label: String {
        switch self {
        case .available: "Available"
        case .unavailable: "Unavailable"
        case .moved: "Moved"
        case .expired: "Expired"
        case .deleted: "Deleted"
        case .permissionDenied: "Permission denied"
        }
    }

    var title: String {
        switch self {
        case .available: "Available on source"
        case .unavailable: "Artifact unavailable"
        case .moved: "Artifact moved"
        case .expired: "Artifact expired"
        case .deleted: "Artifact deleted"
        case .permissionDenied: "Permission denied"
        }
    }

    var defaultReason: String {
        switch self {
        case .available: "The source reports that this artifact is available."
        case .unavailable: "The source device is offline or has stopped reporting."
        case .moved: "The source reports this artifact at a new path."
        case .expired: "The source link or retained artifact has expired."
        case .deleted: "The source no longer reports this artifact."
        case .permissionDenied: "Relay no longer has permission to reach this artifact."
        }
    }

    var allowsExternalOpen: Bool {
        self == .available || self == .moved
    }
}

struct WorkspaceArtifactRecord: Codable, Identifiable, Hashable, Sendable {
    var id: String
    var sourceArtifactId: String?
    var title: String
    var kind: String
    var sourceKind: String
    var relativePath: String
    var filename: String
    var fileExtension: String?
    var byteCount: Int?
    var updatedAt: Date?
    var agentId: String?
    var agentName: String?
    var agentAvatarUrl: String?
    var cronJobId: String?
    var cronJobName: String?
    var isReadableText: Bool
    var harnessId: String?
    var harnessType: String?
    var harnessLabel: String?
    var contentHash: String?
    var externalUrl: String?
    var externalProvider: String?
    var sourceIdentityKind: String?
    var sourceIdentityId: String?
    var sourceMachineId: String?
    var sourceMachineLabel: String?
    var sourcePlatform: String?
    var sourceHealth: String?
    var sourceLastSeenAt: Date?
    var presentationState: ArtifactPresentationState?
    var presentationReason: String?
    var cloudContentAvailable: Bool?
    var storageLocation: String?
    var syncedAt: Date
}

struct WorkspaceArtifactListResult: Codable, Hashable, Sendable {
    var artifacts: [WorkspaceArtifactRecord]
    var refreshedAt: Date
}

struct AgentProvisioningJob: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var workspaceId: String?
    var name: String
    var slug: String
    var role: String?
    var connectionId: String?
    var createdAgentId: String?
    var externalAgentId: String?
    var status: String
    var stage: String
    var message: String?
    var error: String?
}

struct AgentDeleteResult: Codable, Hashable, Sendable {
    var success: Bool
    var id: String
}

// MARK: - Agent Documentation

struct LinkedApplication: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var workspaceId: String
    var name: String
    var slug: String
    var repoPath: String
    var repoKey: String?
    var agentOperableStatus: String
    var currentGitCommit: String?
    var dirtyState: Bool
    var lastScannedAt: Date?
    var generatedDocsPath: String
    var documentationPackStatus: String
    var metadata: [String: JSONValue]
    var createdAt: Date
    var updatedAt: Date
}

struct DocumentationBlueprint: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var workspaceId: String?
    var forkedFromBlueprintId: String?
    var systemKey: String
    var name: String
    var version: String
    var status: String
    var isSystem: Bool
    var protected: Bool
    var compilerPromptVersion: String
    var content: String
    var changelog: String
    var metadata: [String: JSONValue]
    var createdAt: Date
    var updatedAt: Date
}

struct ApplicationDocumentationPack: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var workspaceId: String
    var linkedApplicationId: String
    var packPath: String
    var compilerVersion: String
    var repoCommit: String?
    var repoDirtyState: Bool
    var packHash: String?
    var reviewStatus: String
    var syncStatus: String
    var libraryTargetFolder: String?
    var metadata: [String: JSONValue]
    var createdAt: Date
    var updatedAt: Date
}

struct DocumentationProposalFile: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var proposalId: String
    var relativePath: String
    var previousContent: String?
    var updatedContent: String
    var classification: String
    var refreshPolicy: String
    var conflictStatus: String
    var requiresManualReview: Bool
    var applyStatus: String
}

struct DocumentationGenerationProposal: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var workspaceId: String
    var linkedApplicationId: String
    var packId: String?
    var mode: String
    var status: String
    var compilerInputMetadata: [String: JSONValue]?
    var compilerOutputMetadata: [String: JSONValue]?
    var files: [DocumentationProposalFile]?
    var createdAt: Date
    var updatedAt: Date
}

struct AgentDocumentationInstall: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var workspaceId: String
    var agentId: String
    var packId: String
    var role: String
    var installStatus: String
    var driftStatus: String
    var lastInstalledAt: Date?
    var createdAt: Date
    var updatedAt: Date
}

struct AgentDocumentationApplyResult: Codable, Hashable, Sendable {
    var proposalId: String?
    var pack: ApplicationDocumentationPack?
    var appliedFiles: [String]?
}

struct AgentDocumentationSyncResult: Codable, Hashable, Sendable {
    var pack: ApplicationDocumentationPack?
    var syncedFiles: [String]?
}

struct AgentDocumentationInstallResult: Codable, Hashable, Sendable {
    var install: AgentDocumentationInstall?
    var installedFiles: [String]?
}

// MARK: - Thread Wrap-Up

enum WrapUpStatus: String, Codable, Hashable, Sendable {
    case pending
    case generating
    case ready
    case failed
}

struct WrapUpParticipantSummary: Codable, Hashable, Sendable {
    var participantId: String
    var name: String
    var contributionSummary: String
    var messageCount: Int
}

struct ThreadWrapUp: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var threadId: String
    var workspaceId: String
    var status: WrapUpStatus
    var summary: String
    var keyDecisions: [String]
    var actionItems: [String]
    var participantSummaries: [WrapUpParticipantSummary]
    var periodStart: Date
    var periodEnd: Date
    var generatedAt: Date?
    var createdAt: Date
}

// MARK: - Paperclip Integration

struct PaperclipIssue: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var connectionId: String
    var externalId: String
    var title: String
    var status: String
    var priority: String?
    var assigneeName: String?
    var projectName: String
    var url: String
    var createdAt: Date
}

struct PaperclipConnection: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var workspaceId: String
    var displayName: String
    var baseUrl: String
    var companyId: String
    var companyName: String?
    var authType: String
    var status: String
    var lastValidatedAt: Date?
    var lastSuccessAt: Date?
    var lastErrorCode: String?
    var lastErrorMessage: String?
    var createdAt: Date
    var updatedAt: Date
}

struct PaperclipThreadLink: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var workspaceId: String
    var threadId: String
    var connectionId: String
    var objectType: String
    var paperclipObjectId: String
    var paperclipObjectRef: String?
    var createdByUserId: String
    var updatedByUserId: String
    var createdAt: Date
    var updatedAt: Date
}

struct PaperclipLinkedObjectSummary: Codable, Hashable, Sendable {
    var kind: String
    var id: String
    var identifier: String?
    var title: String
    var status: String
    var priority: String?
    var assigneeAgentId: String?
    var projectName: String?
    var approvalType: String?
    var requestedByAgentId: String?
    var decisionNote: String?
    var linkedIssueCount: Int?
    var deepLinkUrl: String
    var companyId: String?
    var updatedAt: Date
}

struct ThreadPaperclipLinkView: Codable, Hashable, Sendable {
    var link: PaperclipThreadLink?
    var connection: PaperclipConnection?
    var objectSummary: PaperclipLinkedObjectSummary?
    var fetchState: String
    var errorCode: String?
    var errorMessage: String?
    var fetchedAt: Date?
}

struct PaperclipConnectionTestResult: Codable, Hashable, Sendable {
    var ok: Bool
    var connection: PaperclipConnection
    var errorCode: String?
    var errorMessage: String?
}

// MARK: - Thread Analytics

struct ThreadAnalytics: Codable, Hashable, Sendable {
    var threadId: String
    var threadTitle: String
    var threadType: String
    var workspaceId: String
    var activityGapMinutes: Int
    var totalMessages: Int
    var totalSessions: Int
    var totalSenders: Int
    var userMessageCount: Int
    var agentMessageCount: Int
    var systemMessageCount: Int
    var requestingUserMessageCount: Int
    var firstMessageAt: Date?
    var lastMessageAt: Date?
    var elapsedMinutes: Double
    var activeDurationMinutes: Double
    var activePeriods: [ThreadAnalyticsActivePeriod]
    var messageCountsBySender: [ThreadAnalyticsSenderStat]
    var sessionBreakdown: [ThreadAnalyticsSessionStat]
}

struct ThreadAnalyticsActivePeriod: Codable, Hashable, Sendable {
    var startedAt: Date
    var endedAt: Date
    var messageCount: Int
    var uniqueSenderCount: Int
    var durationMinutes: Double
}

struct ThreadAnalyticsSenderStat: Codable, Hashable, Sendable {
    var senderKey: String
    var senderId: String?
    var senderName: String
    var senderKind: String
    var messageCount: Int
    var shareOfMessages: Double
    var firstMessageAt: Date
    var lastMessageAt: Date
    var sessionCount: Int
}

struct ThreadAnalyticsSessionStat: Codable, Hashable, Sendable {
    var threadSessionId: String
    var sequenceNumber: Int?
    var status: String?
    var startedAt: Date?
    var endedAt: Date?
    var firstMessageAt: Date?
    var lastMessageAt: Date?
    var messageCount: Int
    var agentMessageCount: Int
    var requestingUserMessageCount: Int
    var messagesAfterLongSilenceCount: Int
    var messagesAfterAgentSilenceCount: Int
    var agentRepeatAnalysisStatus: String
    var agentRepeatAnalysisErrorMessage: String?
    var repeatedAgentMessageCount: Int
    var repeatedCrossAgentMessageCount: Int
    var agentRepeatGroupCount: Int
    var repeatedAgentMessageGroups: [ThreadAnalyticsRepeatedAgentMessageGroup]
}

struct ThreadAnalyticsRepeatedAgentMessageGroup: Codable, Hashable, Sendable {
    var representativeMessage: String
    var occurrenceCount: Int
    var repeatedCount: Int
    var senderCount: Int
    var senderNames: [String]
    var firstMessageAt: Date
    var lastMessageAt: Date
}

// MARK: - Security

struct MobileSessionSummary: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var deviceName: String?
    var platform: String?
    var revokedAt: Date?
    var lastSeenAt: Date?
    var createdAt: Date
    var updatedAt: Date
    var active: Bool
    var current: Bool?
}

struct WebSessionSummary: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var createdAt: Date
    var updatedAt: Date
    var revokedAt: Date?
    var ipAddress: String?
    var userAgent: String?
    var lastSeenAt: Date?
    var active: Bool
}

struct AuditLogEntry: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var actorType: String
    var actorId: String?
    var workspaceId: String?
    var eventType: String
    var resourceType: String?
    var resourceId: String?
    var ipAddress: String?
    var userAgent: String?
    var metadata: [String: JSONValue]?
    var createdAt: Date
}

struct SecurityMetrics: Codable, Hashable, Sendable {
    var windowHours: Int
    var authFailures: Int
    var bridgeEnrollmentFailures: Int
    var websocketDisconnects: Int
    var crossWorkspaceAccessAttempts: Int
    var auditEvents: Int
}

// MARK: - Agent Dispatch

enum RuntimeTodoTaskStatus: String, Codable, Hashable, Sendable {
    case pending
    case inProgress = "in_progress"
    case completed
    case cancelled
}

struct RuntimeTodoTask: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let content: String
    let status: RuntimeTodoTaskStatus
}

struct RuntimeToolActivity: Identifiable, Hashable, Sendable {
    var id: String { toolName }
    let toolName: String
    let phase: String
    let summary: String?
    let updatedAt: Date
}

struct RuntimeDispatchEventPayload: Codable, Hashable, Sendable {
    let dispatchId: String
    let threadId: String
    let agentId: String
    let runtimeType: String
    let timestamp: Date
    let draftText: String?
}

struct RuntimeRunDeltaPayload: Codable, Hashable, Sendable {
    let dispatchId: String
    let threadId: String
    let agentId: String
    let runtimeType: String
    let timestamp: Date
    let text: String
}

struct RuntimeRunThinkingPayload: Codable, Hashable, Sendable {
    let dispatchId: String
    let threadId: String
    let agentId: String
    let runtimeType: String
    let timestamp: Date
    let thinking: String
}

struct RuntimeRunStatusPayload: Codable, Hashable, Sendable {
    let dispatchId: String
    let threadId: String
    let agentId: String
    let runtimeType: String
    let timestamp: Date
    let code: String
    let message: String
}

struct RuntimeRunToolPayload: Codable, Hashable, Sendable {
    let dispatchId: String
    let threadId: String
    let agentId: String
    let runtimeType: String
    let timestamp: Date
    let toolName: String
    let phase: String
    let summary: String?
    let tasks: [RuntimeTodoTask]?
}

struct RuntimeDispatchFailedPayload: Codable, Hashable, Sendable {
    let dispatchId: String
    let threadId: String
    let agentId: String
    let runtimeType: String
    let timestamp: Date
    let code: String
    let message: String
}

struct AgentDispatch: Codable, Identifiable, Hashable, Sendable {
    let id: String
    var threadId: String
    var agentId: String
    var agentName: String
    var runId: String?
    var status: RunStatus
    var startedAt: Date
    var completedAt: Date?
    var errorMessage: String?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        threadId = try c.decode(String.self, forKey: .threadId)
        agentId = try c.decode(String.self, forKey: .agentId)
        agentName = (try? c.decode(String.self, forKey: .agentName)) ?? agentId
        runId = (try? c.decodeIfPresent(String.self, forKey: .runId)) ?? (try? c.decodeIfPresent(String.self, forKey: .runtimeRunId)) ?? nil
        let rawStatus = (try? c.decode(String.self, forKey: .status)) ?? "running"
        status = rawStatus == "started" || rawStatus == "queued" ? .running : (RunStatus(rawValue: rawStatus) ?? .failed)
        startedAt = (try? c.decode(Date.self, forKey: .startedAt)) ?? (try? c.decode(Date.self, forKey: .createdAt)) ?? Date()
        completedAt = try? c.decodeIfPresent(Date.self, forKey: .completedAt)
        errorMessage = try? c.decodeIfPresent(String.self, forKey: .errorMessage)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(id, forKey: .id)
        try c.encode(threadId, forKey: .threadId)
        try c.encode(agentId, forKey: .agentId)
        try c.encode(agentName, forKey: .agentName)
        try c.encodeIfPresent(runId, forKey: .runId)
        try c.encode(status.rawValue, forKey: .status)
        try c.encode(startedAt, forKey: .startedAt)
        try c.encodeIfPresent(completedAt, forKey: .completedAt)
        try c.encodeIfPresent(errorMessage, forKey: .errorMessage)
    }

    private enum CodingKeys: String, CodingKey {
        case id, threadId, agentId, agentName, runId, runtimeRunId, status, startedAt, createdAt, completedAt, errorMessage
    }
}

struct RuntimeDispatchCancelResult: Codable, Hashable, Sendable {
    var cancelled: Bool
    var dispatchId: String
}
