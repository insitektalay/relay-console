import Foundation

public struct RuntimeBridgeEvent: Sendable, Equatable {
    public var id: RelayId
    public var type: RuntimeEventType
    public var dispatchId: RelayId
    public var correlationId: String
    public var timestamp: IsoTimestamp
    public var text: String?
    public var status: String?
    public var detail: JSONRecord
}

public protocol RuntimeEventSink {
    func emit(_ event: RuntimeBridgeEvent) async
}

public struct RuntimeArtifactContract: Sendable, Equatable, Codable {
    public static let pointerManifestSuffix = ".artifact.json"
    public static let cronOutputMarker = "[Relay Console cron artifact output]"
    public static let cronOutputEndMarker = "[End Relay Console cron artifact output]"

    public var rootPath: String
    public var runDirectoryPath: String
    public var cronDirectoryRootPath: String

    public init(rootPath: String, runDirectoryPath: String, cronDirectoryRootPath: String) {
        self.rootPath = rootPath
        self.runDirectoryPath = runDirectoryPath
        self.cronDirectoryRootPath = cronDirectoryRootPath
    }

    public var metadata: JSONRecord {
        [
            "rootPath": .string(rootPath),
            "runDirectoryPath": .string(runDirectoryPath),
            "cronDirectoryRootPath": .string(cronDirectoryRootPath),
            "pointerManifestSuffix": .string(Self.pointerManifestSuffix)
        ]
    }
}

public struct RuntimeDispatchRequest: Sendable, Equatable {
    public var dispatchId: String
    public var correlationId: String
    public var threadId: String
    public var messageId: String
    public var sessionId: String
    public var attempt: Int
    public var agent: AgentWithBinding
    public var runtimeBinding: RuntimeBinding
    public var harness: Harness
    public var inputContent: String
    public var inputFormat: MessageFormat
    public var recentMessages: [Message]
    public var approvalMode: RuntimeApprovalMode
    public var timeoutMs: Int
    public var createdAt: String
    public var artifactContract: RuntimeArtifactContract?
    public var cloudMarketplaceTools: [JSONRecord]
    public var attachmentPaths: [String]

    public init(
        dispatchId: String,
        correlationId: String,
        threadId: String,
        messageId: String,
        sessionId: String,
        attempt: Int,
        agent: AgentWithBinding,
        runtimeBinding: RuntimeBinding,
        harness: Harness,
        inputContent: String,
        inputFormat: MessageFormat,
        recentMessages: [Message],
        approvalMode: RuntimeApprovalMode = .askForApproval,
        timeoutMs: Int,
        createdAt: String,
        artifactContract: RuntimeArtifactContract? = nil,
        cloudMarketplaceTools: [JSONRecord] = [],
        attachmentPaths: [String] = []
    ) {
        self.dispatchId = dispatchId
        self.correlationId = correlationId
        self.threadId = threadId
        self.messageId = messageId
        self.sessionId = sessionId
        self.attempt = attempt
        self.agent = agent
        self.runtimeBinding = runtimeBinding
        self.harness = harness
        self.inputContent = inputContent
        self.inputFormat = inputFormat
        self.recentMessages = recentMessages
        self.approvalMode = approvalMode
        self.timeoutMs = timeoutMs
        self.createdAt = createdAt
        self.artifactContract = artifactContract
        self.cloudMarketplaceTools = cloudMarketplaceTools
        self.attachmentPaths = attachmentPaths
    }
}

public enum RuntimeApprovalDecision: String, Codable, CaseIterable, Sendable {
    case allowOnce = "once"
    case allowForSession = "session"
    case deny
}

public enum RuntimeDispatchTimeouts {
    public static let chatTurnMs = 3_600_000
}

public struct RuntimeDispatchTerminalResult: Sendable, Equatable {
    public var status: String
    public var finalText: String?
    public var contentFormat: MessageFormat
    public var error: RuntimeBridgeError?
    public var metadata: JSONRecord

    public init(
        status: String,
        finalText: String? = nil,
        contentFormat: MessageFormat,
        error: RuntimeBridgeError? = nil,
        metadata: JSONRecord
    ) {
        self.status = status
        self.finalText = finalText
        self.contentFormat = contentFormat
        self.error = error
        self.metadata = metadata
    }
}

public struct RuntimeBridgeError: Codable, Equatable, Sendable {
    public var category: String
    public var message: String
    public var recoverable: Bool
    public var detail: JSONRecord

    public init(category: String, message: String, recoverable: Bool, detail: JSONRecord = [:]) {
        self.category = category
        self.message = message
        self.recoverable = recoverable
        self.detail = detail
    }
}

public struct CancelRuntimeDispatchResult: Sendable, Equatable {
    public var status: String
    public var message: String?

    public init(status: String, message: String? = nil) {
        self.status = status
        self.message = message
    }
}

public protocol DesktopRuntimeBridge {
    var runtimeType: RuntimeType { get }
    var adapterId: String { get }
    var displayName: String { get }
    func getHealth(harnessId: String, config: JSONRecord) async -> HarnessHealth
    func getCapabilities(harnessId: String, config: JSONRecord) async -> RuntimeCapabilities
    func dispatchTurn(_ request: RuntimeDispatchRequest, sink: RuntimeEventSink) async -> RuntimeDispatchTerminalResult
    func cancelDispatch(dispatchId: String, correlationId: String) async -> CancelRuntimeDispatchResult
    func resolveApproval(
        dispatchId: String,
        correlationId: String,
        decision: RuntimeApprovalDecision
    ) async -> Bool
}

public extension DesktopRuntimeBridge {
    func resolveApproval(
        dispatchId: String,
        correlationId: String,
        decision: RuntimeApprovalDecision
    ) async -> Bool {
        false
    }
}

public final class RuntimeBridgeRegistry {
    private var bridges: [RuntimeType: DesktopRuntimeBridge] = [:]

    public init() {}

    public func register(_ bridge: DesktopRuntimeBridge) {
        bridges[bridge.runtimeType] = bridge
    }

    public func get(_ runtimeType: RuntimeType) throws -> DesktopRuntimeBridge {
        guard let bridge = bridges[runtimeType] else {
            throw RelayError(.unsupported, "Runtime \(runtimeType.rawValue) is not available in this Relay Console build.")
        }
        return bridge
    }
}

public func bridgeEvent(_ request: RuntimeDispatchRequest, _ type: RuntimeEventType, text: String? = nil, status: String? = nil, detail: JSONRecord = [:]) -> RuntimeBridgeEvent {
    RuntimeBridgeEvent(
        id: createRelayId("evt"),
        type: type,
        dispatchId: request.dispatchId,
        correlationId: request.correlationId,
        timestamp: nowIso(),
        text: text,
        status: status,
        detail: detail
    )
}

public func failedResult(_ category: String, _ message: String, recoverable: Bool = true, detail: JSONRecord = [:]) -> RuntimeDispatchTerminalResult {
    RuntimeDispatchTerminalResult(
        status: "failed",
        finalText: nil,
        contentFormat: .plain,
        error: RuntimeBridgeError(category: category, message: message, recoverable: recoverable, detail: detail),
        metadata: [:]
    )
}

public func artifactContractPrompt(_ prompt: String, contract: RuntimeArtifactContract?) -> String {
    guard let contract else { return prompt }
    let block = """
    [Relay Console artifact contract]
    Durable deliverables for this run must be written under:
    \(contract.runDirectoryPath)

    Use that directory for documents, images, video, audio, data exports, and any other files the user should be able to find later in Relay Console Artifacts.

    Do not place scheduler/debug run records, raw prompt transcripts, or temporary logs in the artifact directory unless the user explicitly asked for them as deliverables.

    If the durable deliverable lives in an external product such as Google Docs, write a pointer manifest inside the artifact directory. The filename must end with "\(RuntimeArtifactContract.pointerManifestSuffix)" and contain JSON like:
    {"title":"Document title","kind":"document","external_url":"https://...","provider":"google_docs"}
    external_url must be an absolute HTTPS URL without embedded credentials.

    If the user specifies an output location for a scheduled/cron job, use that location when it is accessible and permitted. Otherwise, choose an artifact output directory under:
    \(contract.cronDirectoryRootPath)

    The user-selected location is authoritative. If the user supplies a filename, use its parent directory below while retaining the exact filename in the job instructions. Save this exact machine-readable block in every scheduled job's instructions, replacing the placeholder with the chosen absolute directory:
    \(RuntimeArtifactContract.cronOutputMarker)
    Directory: <absolute output directory>
    \(RuntimeArtifactContract.cronOutputEndMarker)

    Do not rename or omit that block. Relay Console uses it to persist the job's structured output_directory and index the output. After creating or editing the job, read it back when the scheduler tool supports that and do not claim artifact registration if the block was not retained.

    This specifies artifact discoverability only; it does not determine filenames or whether repeated runs create, replace, or update files. Clearly confirm the chosen location and repeated-run behavior to the user.

    For a registered local file, tell the user that its catalogue entry will appear in Relay Console Artifacts on macOS, web, and iOS after the source Mac synchronizes, but the file bytes remain on that Mac and can only be opened there. If the output is an approved external HTTPS artifact, tell the user it can be opened from all three platforms. If the job could not retain the registration block, explicitly say the file will not appear in Artifacts.
    [End Relay Console artifact contract]
    """
    return [block, "", prompt].joined(separator: "\n")
}
