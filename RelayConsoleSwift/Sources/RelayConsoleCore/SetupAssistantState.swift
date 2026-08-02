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
    case healthCheckFailed
    case connected
}

public struct SetupPairingCode: Codable, Equatable, Sendable {
    public var code: String
    public var expiresAt: Date
    public var state: SetupPairingState

    public init(code: String = "", expiresAt: Date = .distantPast, state: SetupPairingState = .notGenerated) {
        self.code = code
        self.expiresAt = expiresAt
        self.state = state
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
        if let saved { return saved }
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
