import Foundation

public struct AgentRuntimeTeardownResult: Codable, Equatable, Sendable {
    public var deletedPaths: [String]
    public var skippedPaths: [String]
    public var harnessActions: [String]

    public init(deletedPaths: [String] = [], skippedPaths: [String] = [], harnessActions: [String] = []) {
        self.deletedPaths = deletedPaths
        self.skippedPaths = skippedPaths
        self.harnessActions = harnessActions
    }
}

public struct AgentDeletionImpact: Codable, Equatable, Sendable {
    public var agentId: RelayId
    public var agentName: String
    public var directThreadCount: Int
    public var directMessageCount: Int
    public var teamThreadCount: Int
    public var teamMessageCount: Int
    public var runtimeDispatchCount: Int
    public var activeDispatchCount: Int
    public var runtimeSessionCount: Int

    public init(
        agentId: RelayId,
        agentName: String,
        directThreadCount: Int,
        directMessageCount: Int,
        teamThreadCount: Int,
        teamMessageCount: Int,
        runtimeDispatchCount: Int,
        activeDispatchCount: Int,
        runtimeSessionCount: Int
    ) {
        self.agentId = agentId
        self.agentName = agentName
        self.directThreadCount = directThreadCount
        self.directMessageCount = directMessageCount
        self.teamThreadCount = teamThreadCount
        self.teamMessageCount = teamMessageCount
        self.runtimeDispatchCount = runtimeDispatchCount
        self.activeDispatchCount = activeDispatchCount
        self.runtimeSessionCount = runtimeSessionCount
    }
}

public struct AgentDeletionResult: Codable, Equatable, Sendable {
    public var impact: AgentDeletionImpact
    public var deletedDirectThreadIds: [RelayId]
    public var affectedTeamThreadIds: [RelayId]
    public var deletedTeamMessageCount: Int
    public var runtimeTeardown: AgentRuntimeTeardownResult
    public var deletedAt: IsoTimestamp

    public init(
        impact: AgentDeletionImpact,
        deletedDirectThreadIds: [RelayId],
        affectedTeamThreadIds: [RelayId],
        deletedTeamMessageCount: Int,
        runtimeTeardown: AgentRuntimeTeardownResult = AgentRuntimeTeardownResult(),
        deletedAt: IsoTimestamp
    ) {
        self.impact = impact
        self.deletedDirectThreadIds = deletedDirectThreadIds
        self.affectedTeamThreadIds = affectedTeamThreadIds
        self.deletedTeamMessageCount = deletedTeamMessageCount
        self.runtimeTeardown = runtimeTeardown
        self.deletedAt = deletedAt
    }
}

public final class AgentTeardownService {
    private let data: LocalDataService
    private let harnessInstall: HarnessInstallManager

    public init(data: LocalDataService, harnessInstall: HarnessInstallManager) {
        self.data = data
        self.harnessInstall = harnessInstall
    }

    public func impact(context: ServiceRequestContext, agentId: RelayId) throws -> AgentDeletionImpact {
        try requireDeleteAccess(context: context)
        let agent = try data.getAgent(agentId)
        guard agent.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Agent does not belong to this workspace.")
        }
        return try data.agentDeletionImpact(agentId: agentId)
    }

    public func deleteAgent(context: ServiceRequestContext, agentId: RelayId) async throws -> AgentDeletionResult {
        try requireDeleteAccess(context: context)
        let agent = try data.getAgent(agentId)
        guard agent.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Agent does not belong to this workspace.")
        }
        let runtimeTeardown = try await harnessInstall.teardownRuntimeIdentity(for: agent)
        var result = try data.deleteAgentCascade(agentId: agentId)
        result.runtimeTeardown = runtimeTeardown
        _ = try? data.log(
            severity: "info",
            category: "agents",
            message: "Agent deleted.",
            harnessId: agent.harness.id,
            detail: [
                "agentId": .string(agent.id),
                "agentName": .string(agent.name),
                "directThreadCount": .number(Double(result.impact.directThreadCount)),
                "teamThreadCount": .number(Double(result.impact.teamThreadCount)),
                "teamMessageCount": .number(Double(result.deletedTeamMessageCount)),
                "deletedRuntimePathCount": .number(Double(runtimeTeardown.deletedPaths.count)),
                "skippedRuntimePathCount": .number(Double(runtimeTeardown.skippedPaths.count))
            ]
        )
        return result
    }

    private func requireDeleteAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin],
            context: context,
            message: "Deleting an agent requires owner or admin authority."
        ) {
            throw denied
        }
    }
}
