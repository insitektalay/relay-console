import Foundation

public enum SetupAssistantMode: String, Codable, CaseIterable, Sendable {
    case undecided
    case local
    case remote
    case localAndRemote
}

public enum SetupAssistantStep: String, Codable, CaseIterable, Sendable {
    case location
    case localDiscovery
    case localNotFound
    case localRailwayOffer
    case railwayConnection
    case railwayBrowser
    case railwayURL
    case relayAccount
    case remoteRuntimes
    case remoteOperatingSystem
    case remoteInstallation
    case remotePairing
    case installationGuides
    case installationGuideReturn
    case complete
}

public enum SetupAssistantLifecycle: String, Codable, Sendable {
    case notStarted
    case inProgress
    case skipped
    case completed
}

public enum SetupRemoteRuntime: String, Codable, CaseIterable, Hashable, Sendable {
    case hermes
    case openClaw

    public var displayName: String {
        switch self {
        case .hermes: return "Hermes Agent"
        case .openClaw: return "OpenClaw"
        }
    }
}

public enum SetupRemoteOperatingSystem: String, Codable, CaseIterable, Sendable {
    case macOS
    case linux
}

public enum SetupPairingState: String, Codable, Sendable {
    case notGenerated
    case ready
    case expired
    case used
    case permissionDenied
    case bridgeOffline
    case incompatible
    case backendUnreachable
    case installationFailed
    case activationRolledBack
    case healthCheckFailed
    case connected
}

public enum SetupPairingRecoveryAction: String, Codable, Sendable {
    case reconnectRailway
    case retryPairing
    case retryInstallation
    case checkStatus
}

public struct SetupPairingResponse: Equatable, Sendable {
    public let code: String
    public let expiresAt: Date

    public init(code: String, expiresAt: Date) {
        self.code = code
        self.expiresAt = expiresAt
    }
}

public enum SetupBridgeCompatibilityLevel: String, Codable, Equatable, Sendable {
    case verified
    case compatible
    case unsupported
}

public struct SetupBridgeCompatibilitySummary: Codable, Equatable, Sendable {
    public var level: SetupBridgeCompatibilityLevel
    public var operatingMode: String
    public var runtimeVersion: String?
    public var enabledCapabilities: [String]
    public var disabledCapabilities: [String]
    public var warnings: [String]

    public init(
        level: SetupBridgeCompatibilityLevel,
        operatingMode: String,
        runtimeVersion: String?,
        enabledCapabilities: [String],
        disabledCapabilities: [String],
        warnings: [String]
    ) {
        self.level = level
        self.operatingMode = operatingMode
        self.runtimeVersion = runtimeVersion
        self.enabledCapabilities = enabledCapabilities
        self.disabledCapabilities = disabledCapabilities
        self.warnings = warnings
    }

    public var allowsInstallation: Bool { level != .unsupported }
}

public enum SetupBridgeCompatibilityParser {
    public static func parse(_ response: [String: Any]) -> SetupBridgeCompatibilitySummary? {
        guard let rawLevel = response["level"] as? String,
              let level = SetupBridgeCompatibilityLevel(rawValue: rawLevel),
              let operatingMode = response["operatingMode"] as? String
        else { return nil }
        return SetupBridgeCompatibilitySummary(
            level: level,
            operatingMode: operatingMode,
            runtimeVersion: response["runtimeVersion"] as? String,
            enabledCapabilities: response["enabledCapabilities"] as? [String] ?? [],
            disabledCapabilities: response["disabledCapabilities"] as? [String] ?? [],
            warnings: response["warnings"] as? [String] ?? []
        )
    }
}

public enum SetupPairingResponseParser {
    public static func parse(_ response: [String: Any]) -> SetupPairingResponse? {
        guard let code = response["code"] as? String,
              let expiresText = response["expiresAt"] as? String,
              let expiresAt = ISO8601DateFormatter.relayConsole.date(from: expiresText)
                ?? ISO8601DateFormatter().date(from: expiresText)
        else { return nil }
        return SetupPairingResponse(code: code, expiresAt: expiresAt)
    }
}

public struct SetupPairingCode: Codable, Equatable, Sendable {
    public var code: String
    public var expiresAt: Date
    public var state: SetupPairingState
    public var detailMessage: String?
    public var recoveryAction: SetupPairingRecoveryAction?
    public var compatibility: SetupBridgeCompatibilitySummary?

    public init(
        code: String = "",
        expiresAt: Date = .distantPast,
        state: SetupPairingState = .notGenerated,
        detailMessage: String? = nil,
        recoveryAction: SetupPairingRecoveryAction? = nil,
        compatibility: SetupBridgeCompatibilitySummary? = nil
    ) {
        self.code = code
        self.expiresAt = expiresAt
        self.state = state
        self.detailMessage = detailMessage
        self.recoveryAction = recoveryAction
        self.compatibility = compatibility
    }

    public var isExpired: Bool { state == .ready && expiresAt <= Date() }
}

public struct SetupAssistantSnapshot: Codable, Equatable, Sendable {
    public static let persistenceKey = "setup.assistant.v1"

    public var lifecycle: SetupAssistantLifecycle
    public var mode: SetupAssistantMode
    public var step: SetupAssistantStep
    public var history: [SetupAssistantStep]
    public var selectedRemoteRuntimes: Set<SetupRemoteRuntime>
    public var remoteOperatingSystem: SetupRemoteOperatingSystem?
    public var guideRuntime: SetupRemoteRuntime?
    public var pairing: [SetupRemoteRuntime: SetupPairingCode]
    public var configuredRailwayOrigin: String?
    public var reviewRecommended: Bool

    public init(
        lifecycle: SetupAssistantLifecycle = .notStarted,
        mode: SetupAssistantMode = .undecided,
        step: SetupAssistantStep = .location,
        history: [SetupAssistantStep] = [],
        selectedRemoteRuntimes: Set<SetupRemoteRuntime> = [],
        remoteOperatingSystem: SetupRemoteOperatingSystem? = nil,
        guideRuntime: SetupRemoteRuntime? = nil,
        pairing: [SetupRemoteRuntime: SetupPairingCode] = [:],
        configuredRailwayOrigin: String? = nil,
        reviewRecommended: Bool = false
    ) {
        self.lifecycle = lifecycle
        self.mode = mode
        self.step = step
        self.history = history
        self.selectedRemoteRuntimes = selectedRemoteRuntimes
        self.remoteOperatingSystem = remoteOperatingSystem
        self.guideRuntime = guideRuntime
        self.pairing = pairing
        self.configuredRailwayOrigin = configuredRailwayOrigin
        self.reviewRecommended = reviewRecommended
    }

    public var requiresFirstLaunchPresentation: Bool {
        lifecycle == .notStarted || lifecycle == .inProgress
    }

    public var allowsLocalOnlyUse: Bool {
        (mode == .local || mode == .localAndRemote) && lifecycle != .notStarted
    }

    public mutating func begin(reopen: Bool = false) {
        lifecycle = .inProgress
        if reopen || step == .complete {
            step = .location
            history = []
        }
    }

    public mutating func advance(to next: SetupAssistantStep) {
        guard next != step else { return }
        history.append(step)
        step = next
        lifecycle = .inProgress
    }

    @discardableResult
    public mutating func goBack() -> Bool {
        guard let previous = history.popLast() else { return false }
        step = previous
        return true
    }

    public mutating func skip() {
        lifecycle = .skipped
        step = .location
        history = []
    }

    public mutating func finish() {
        lifecycle = .completed
        step = .complete
        history = []
        reviewRecommended = false
    }

    public static func migrateExistingUser(
        saved: SetupAssistantSnapshot?,
        hasLocalConnection: Bool,
        configuredRailwayOrigin: String?
    ) -> SetupAssistantSnapshot {
        if var saved {
            // The backend setting is the runtime source of truth. Older setup snapshots may
            // predate it or may have been saved before a backend was connected.
            saved.configuredRailwayOrigin = configuredRailwayOrigin
            return saved
        }
        guard hasLocalConnection || configuredRailwayOrigin != nil else { return SetupAssistantSnapshot() }
        let inferredMode: SetupAssistantMode
        if hasLocalConnection && configuredRailwayOrigin != nil {
            inferredMode = .localAndRemote
        } else if hasLocalConnection {
            inferredMode = .local
        } else {
            inferredMode = .remote
        }
        return SetupAssistantSnapshot(
            lifecycle: .completed,
            mode: inferredMode,
            step: .complete,
            configuredRailwayOrigin: configuredRailwayOrigin,
            reviewRecommended: true
        )
    }
}
