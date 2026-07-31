import Foundation

public enum ShellSectionKey: String, Codable, CaseIterable, Hashable, Sendable {
    case chats
    case agents
    case agentOpsHQ = "agent_ops_hq"
    case artifacts
    case applications
    case approvals
    case insights
    case settings
}

public enum ShellRoutePolicy: String, Codable, Equatable, Sendable {
    case active
    case unavailable
    case excluded
}

public enum ShellRouteResolutionOutcome: String, Codable, Equatable, Sendable {
    case allowed
    case deniedUnavailable = "denied_unavailable"
    case deniedExcluded = "denied_excluded"
}

public struct ShellSectionState: Codable, Equatable, Identifiable, Sendable {
    public var id: String { key.rawValue }
    public var key: ShellSectionKey
    public var label: String
    public var iconName: String
    public var policy: ShellRoutePolicy
    public var stateKind: GuardedStateKind?
    public var reasonCode: GuardReasonCode?
    public var disposition: String
    public var missingPrerequisites: [String]
    public var serviceState: String
    public var activationRequirements: [String]
    public var notParityStatement: String
    public var traceability: [String]
    public var releaseImpact: String
    public var redactionStatus: String

    public init(
        key: ShellSectionKey,
        label: String,
        iconName: String,
        policy: ShellRoutePolicy,
        stateKind: GuardedStateKind? = nil,
        reasonCode: GuardReasonCode? = nil,
        disposition: String,
        missingPrerequisites: [String] = [],
        serviceState: String,
        activationRequirements: [String] = [],
        notParityStatement: String,
        traceability: [String],
        releaseImpact: String,
        redactionStatus: String = "no-secrets"
    ) {
        self.key = key
        self.label = label
        self.iconName = iconName
        self.policy = policy
        self.stateKind = stateKind
        self.reasonCode = reasonCode
        self.disposition = disposition
        self.missingPrerequisites = missingPrerequisites
        self.serviceState = serviceState
        self.activationRequirements = activationRequirements
        self.notParityStatement = notParityStatement
        self.traceability = traceability
        self.releaseImpact = releaseImpact
        self.redactionStatus = redactionStatus
    }

    public var isSelectable: Bool {
        policy == .active
    }

    public var statusText: String {
        if policy == .active {
            return "active"
        }
        return reasonCode?.rawValue ?? disposition
    }

    public var helpText: String {
        switch policy {
        case .active:
            return "Open \(label)"
        case .unavailable:
            return "\(label) unavailable: \(reasonCode?.rawValue ?? disposition)"
        case .excluded:
            return "\(label) excluded: \(reasonCode?.rawValue ?? disposition)"
        }
    }

    public var accessibilityLabel: String {
        switch policy {
        case .active:
            return "Open \(label)"
        case .unavailable:
            return "\(label) unavailable"
        case .excluded:
            return "\(label) excluded"
        }
    }

    public var accessibilityHint: String {
        switch policy {
        case .active:
            return "Selects the \(label) section."
        case .unavailable:
            return "Selection is denied and the current section is preserved. Reason code \(reasonCode?.rawValue ?? disposition)."
        case .excluded:
            return "This top-level section is outside the current Swift scope unless explicitly reinstated."
        }
    }
}

public struct ShellRouteResolution: Codable, Equatable, Sendable {
    public var requestedKey: ShellSectionKey
    public var resolvedKey: ShellSectionKey
    public var outcome: ShellRouteResolutionOutcome
    public var section: ShellSectionState
    public var guardResult: ServiceGuardResult?
    public var sideEffectsAllowed: Bool
    public var message: String

    public init(
        requestedKey: ShellSectionKey,
        resolvedKey: ShellSectionKey,
        outcome: ShellRouteResolutionOutcome,
        section: ShellSectionState,
        guardResult: ServiceGuardResult?,
        sideEffectsAllowed: Bool,
        message: String
    ) {
        self.requestedKey = requestedKey
        self.resolvedKey = resolvedKey
        self.outcome = outcome
        self.section = section
        self.guardResult = guardResult
        self.sideEffectsAllowed = sideEffectsAllowed
        self.message = message
    }
}

public struct ShellNavigationResolver: Sendable {
    public var sections: [ShellSectionState]
    public var hiddenSections: [ShellSectionState]

    public init(
        sections: [ShellSectionState] = ShellNavigationResolver.defaultSections,
        hiddenSections: [ShellSectionState] = ShellNavigationResolver.defaultHiddenSections
    ) {
        self.sections = sections
        self.hiddenSections = hiddenSections
    }

    public var activeSections: [ShellSectionState] {
        sections.filter { $0.policy == .active }
    }

    public var guardedSections: [ShellSectionState] {
        sections.filter { $0.policy == .unavailable || $0.policy == .excluded }
    }

    public func state(for key: ShellSectionKey) -> ShellSectionState {
        sections.first { $0.key == key }
            ?? hiddenSections.first { $0.key == key }
            ?? ShellNavigationResolver.fallbackUnavailableState(for: key)
    }

    public func resolveSelection(
        current: ShellSectionKey,
        requested: ShellSectionKey,
        correlationId: String? = nil
    ) -> ShellRouteResolution {
        let section = state(for: requested)
        if section.policy == .active {
            return ShellRouteResolution(
                requestedKey: requested,
                resolvedKey: requested,
                outcome: .allowed,
                section: section,
                guardResult: nil,
                sideEffectsAllowed: true,
                message: "Opened \(section.label)."
            )
        }

        let id = correlationId ?? "shell-nav-\(requested.rawValue)"
        let context = ServiceRequestContext(
            actorId: "local-shell",
            workspaceId: "local-workspace",
            roles: [],
            correlationId: id
        )
        let result: ServiceGuardResult
        let outcome: ShellRouteResolutionOutcome
        switch section.policy {
        case .active:
            fatalError("Active shell route handled before guard resolution.")
        case .unavailable:
            result = ServiceGuard.unavailable(
                context: context,
                reasonCode: section.reasonCode ?? .featureUnavailable,
                message: section.serviceState,
                recovery: section.activationRequirements.first
            )
            outcome = .deniedUnavailable
        case .excluded:
            result = ServiceGuard.blocked(
                context: context,
                reasonCode: section.reasonCode ?? .actionUnsupported,
                message: section.serviceState,
                auditRequired: false
            )
            outcome = .deniedExcluded
        }

        return ShellRouteResolution(
            requestedKey: requested,
            resolvedKey: current,
            outcome: outcome,
            section: section,
            guardResult: result,
            sideEffectsAllowed: false,
            message: section.serviceState
        )
    }

    public static let defaultSections: [ShellSectionState] = [
        ShellSectionState(
            key: .chats,
            label: "Chats",
            iconName: "bubble.left.and.bubble.right",
            policy: .active,
            disposition: "implemented",
            serviceState: "Active local chat route.",
            notParityStatement: "Chats remains active and is not an unavailable-surface claim.",
            traceability: ["ITC-0011", "RCSPR-0016", "FI-0016", "SM-0016"],
            releaseImpact: "Active route preserved by shell navigation readiness."
        ),
        ShellSectionState(
            key: .agents,
            label: "Agents",
            iconName: "person.2",
            policy: .active,
            disposition: "implemented",
            serviceState: "Active local agents route.",
            notParityStatement: "Agents remains active and is not an unavailable-surface claim.",
            traceability: ["ITC-0011", "RCSPR-0017", "FI-0017", "SM-0017"],
            releaseImpact: "Active route preserved by shell navigation readiness."
        ),
        ShellSectionState(
            key: .artifacts,
            label: "Artifacts",
            iconName: "tray.full",
            policy: .active,
            disposition: "agent-output-library",
            serviceState: "Active artifact library route backed by local agent outputs and a curated Relay control-plane snapshot.",
            activationRequirements: [],
            notParityStatement: "Artifacts publishes bounded metadata and readable content to the Relay control plane without synchronizing absolute paths, runtime logs, credentials, or unrelated agent instruction files.",
            traceability: ["RCSPR-ARTIFACTS-LOCAL"],
            releaseImpact: "Generated agent work has a first-class top-level route without moving chat, agent, approval, or settings workflows."
        ),
        ShellSectionState(
            key: .applications,
            label: "Applications",
            iconName: "square.grid.2x2",
            policy: .active,
            disposition: "marketplace-catalog",
            serviceState: "Active Applications Marketplace route backed by retained local catalog records.",
            activationRequirements: [],
            notParityStatement: "Applications Marketplace catalog is active, while provider OAuth, Marketplace installs, local apps, source-host records, generated packs, Paperclip, and controlled writes remain later or excluded scope.",
            traceability: ["ITC-0032", "RCSPR-0035", "RCSPR-0036", "RCSPR-0178", "FI-0041", "VC-0102", "VC-0108"],
            releaseImpact: "Applications can show service-backed retained Marketplace catalog state without enabling excluded local app or Paperclip workflows."
        ),
        ShellSectionState(
            key: .approvals,
            label: "Approvals",
            iconName: "checkmark.seal",
            policy: .active,
            disposition: "provider-action-approvals",
            serviceState: "Active provider-action approvals route backed by retained generic approval records.",
            activationRequirements: [],
            notParityStatement: "Approvals resolves provider-action requests only when retained payload state still hashes to the exact payload proposed by the broker; redacted payloads remain blocked from top-level execution.",
            traceability: ["MPF-001-007", "MPF-003"],
            releaseImpact: "Approvals can show service-backed retained provider-action approval cards without exposing raw provider payloads or weakening exact-payload approval gates."
        ),
        ShellSectionState(
            key: .settings,
            label: "Settings",
            iconName: "gearshape",
            policy: .active,
            disposition: "implemented",
            serviceState: "Active local settings route.",
            notParityStatement: "Settings remains active and is not an unavailable-surface claim.",
            traceability: ["ITC-0011", "RCSPR-0016", "FI-0021", "SM-0022"],
            releaseImpact: "Active route preserved by shell navigation readiness."
        )
    ]

    public static let defaultHiddenSections: [ShellSectionState] = [
        ShellSectionState(
            key: .agentOpsHQ,
            label: "AgentOps HQ",
            iconName: "network",
            policy: .unavailable,
            stateKind: .unavailable,
            reasonCode: .featureUnavailable,
            disposition: "deferred-hidden",
            missingPrerequisites: ["shell exposure approval"],
            serviceState: "AgentOps HQ is deferred and hidden from top-level navigation while the retained implementation remains in the codebase.",
            activationRequirements: ["Re-enable AgentOps HQ shell exposure after product approval for the future HQ release."],
            notParityStatement: "AgentOps HQ is retained code only in this build and is not a visible or usable active surface.",
            traceability: ["ITC-0027", "RCSPR-0018", "FI-0018", "SM-0018", "VC-0102", "VC-0108"],
            releaseImpact: "AgentOps HQ must not appear in the bottom navigation or count as an active release surface."
        ),
        ShellSectionState(
            key: .insights,
            label: "Insights",
            iconName: "chart.bar",
            policy: .unavailable,
            stateKind: .unavailable,
            reasonCode: .featureUnavailable,
            disposition: "deferred-hidden",
            missingPrerequisites: ["first-launch scope approval"],
            serviceState: "Insights is deferred and hidden from top-level navigation while the retained implementation remains in the codebase.",
            activationRequirements: ["Re-enable Insights shell exposure after product approval for a later release."],
            notParityStatement: "Insights is retained code only in this build and is not a visible or usable active surface.",
            traceability: ["ITC-0051", "RCSPR-0106", "FI-0141", "SM-0141", "VC-0102", "VC-0108"],
            releaseImpact: "Insights must not appear in the bottom navigation or count as an active first-launch surface; runtime report generation/retry remains unavailable."
        )
    ]

    private static func fallbackUnavailableState(for key: ShellSectionKey) -> ShellSectionState {
        ShellSectionState(
            key: key,
            label: key.rawValue,
            iconName: "questionmark.circle",
            policy: .unavailable,
            stateKind: .unavailable,
            reasonCode: .featureUnavailable,
            disposition: "unavailable",
            missingPrerequisites: ["section taxonomy entry"],
            serviceState: "Shell section is unavailable because it has no registered route state.",
            activationRequirements: ["Register route state in ShellNavigationResolver."],
            notParityStatement: "Fallback unavailable state does not prove active parity.",
            traceability: ["ITC-0011"],
            releaseImpact: "No release parity claim allowed for unregistered shell sections."
        )
    }
}
