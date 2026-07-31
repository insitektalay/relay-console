import Foundation

public struct AgentOrgDashboardCounts: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var companyCount: Int
    public var departmentCount: Int
    public var teamCount: Int
    public var managerRelationshipCount: Int
    public var personalAgentCount: Int
    public var familyAgentCount: Int
    public var businessAgentCount: Int
    public var agentsByCompany: [RelayId: Int]
    public var agentsByDepartment: [RelayId: Int]
    public var agentsByTeam: [RelayId: Int]
}

public struct AgentOrgCascadeDeleteResult: Codable, Equatable, Sendable {
    public var company: AgentOrgCompany
    public var departments: [AgentOrgDepartment]
    public var teams: [AgentOrgTeam]
    public var unassignedAgents: [AgentWithBinding]
}

public final class AgentOrganizationService {
    private let data: LocalDataService

    public init(data: LocalDataService) {
        self.data = data
    }

    public func createCompany(
        context: ServiceRequestContext,
        name: String,
        industry: String? = nil,
        metadata: JSONRecord = [:]
    ) throws -> AgentOrgCompany {
        try requireOrgAuthority(context: context, action: "create_company", detail: metadata)
        return try data.createAgentOrgCompany(
            workspaceId: context.workspaceId,
            name: name,
            industry: industry,
            metadata: metadata.merging(serviceMetadata(context: context, action: "create_company")) { current, _ in current }
        )
    }

    public func createDepartment(
        context: ServiceRequestContext,
        companyId: String,
        name: String,
        colorHex: String? = nil,
        headAgentId: String? = nil,
        agentOpsRoomId: String? = nil,
        metadata: JSONRecord = [:]
    ) throws -> AgentOrgDepartment {
        try requireOrgAuthority(context: context, action: "create_department", detail: metadata)
        let company = try data.getAgentOrgCompany(companyId)
        try requireSameWorkspace(context: context, workspaceId: company.workspaceId, action: "create_department", detail: [
            "companyId": .string(companyId)
        ])
        let department = try data.createAgentOrgDepartment(
            workspaceId: context.workspaceId,
            companyId: companyId,
            name: name,
            colorHex: colorHex,
            headAgentId: headAgentId,
            agentOpsRoomId: agentOpsRoomId,
            metadata: metadata.merging(serviceMetadata(context: context, action: "create_department")) { current, _ in current }
        )
        if let headAgentId {
            _ = try syncAgentPlacementToDepartment(agentId: headAgentId, department: department, teamId: nil)
        }
        return department
    }

    public func createTeam(
        context: ServiceRequestContext,
        departmentId: String,
        name: String,
        leadAgentId: String? = nil,
        inheritDepartmentHeadAsLead: Bool = false,
        agentOpsRoomId: String? = nil,
        metadata: JSONRecord = [:]
    ) throws -> AgentOrgTeam {
        try requireOrgAuthority(context: context, action: "create_team", detail: metadata)
        let department = try data.getAgentOrgDepartment(departmentId)
        try requireSameWorkspace(context: context, workspaceId: department.workspaceId, action: "create_team", detail: [
            "departmentId": .string(departmentId)
        ])
        var resolvedLeadAgentId = leadAgentId
        var serviceFields = serviceMetadata(context: context, action: "create_team")
        if resolvedLeadAgentId == nil, inheritDepartmentHeadAsLead, let headAgentId = department.headAgentId {
            resolvedLeadAgentId = headAgentId
            serviceFields["leadProvenance"] = .string("inherited_from_department_head")
            serviceFields["leadInheritedFromDepartmentId"] = .string(department.id)
        } else {
            serviceFields["leadProvenance"] = .string("explicit_or_empty")
        }
        let team = try data.createAgentOrgTeam(
            workspaceId: context.workspaceId,
            departmentId: departmentId,
            name: name,
            leadAgentId: resolvedLeadAgentId,
            agentOpsRoomId: agentOpsRoomId,
            metadata: metadata.merging(serviceFields) { current, _ in current }
        )
        if let resolvedLeadAgentId {
            _ = try syncAgentPlacementToDepartment(agentId: resolvedLeadAgentId, department: department, teamId: team.id)
        }
        return team
    }

    public func updateAgentPlacement(
        context: ServiceRequestContext,
        agentId: String,
        groupType: AgentGroupType,
        familyLabel: String? = nil,
        companyId: String? = nil,
        departmentId: String? = nil,
        teamId: String? = nil,
        classification: String? = nil
    ) throws -> AgentWithBinding {
        try requireOrgAuthority(context: context, action: "update_agent_placement", detail: [
            "agentId": .string(agentId),
            "groupType": .string(groupType.rawValue)
        ])
        let agent = try data.getAgent(agentId)
        try requireSameWorkspace(context: context, workspaceId: agent.workspaceId, action: "update_agent_placement", detail: [
            "agentId": .string(agentId)
        ])
        switch groupType {
        case .personal, .unassigned:
            return try data.updateAgentOrgPlacement(
                agentId: agentId,
                groupType: groupType,
                familyLabel: nil,
                companyId: nil,
                departmentId: nil,
                teamId: nil,
                managerAgentId: nil,
                classification: classification
            )
        case .family:
            _ = try requireNonEmptyString(familyLabel, field: "Family label", maxLength: 160)
            return try data.updateAgentOrgPlacement(
                agentId: agentId,
                groupType: .family,
                familyLabel: familyLabel,
                companyId: nil,
                departmentId: nil,
                teamId: nil,
                managerAgentId: nil,
                classification: classification
            )
        case .business:
            let placement = try validateBusinessPlacement(
                context: context,
                companyId: companyId,
                departmentId: departmentId,
                teamId: teamId
            )
            return try data.updateAgentOrgPlacement(
                agentId: agentId,
                groupType: .business,
                familyLabel: nil,
                companyId: placement.companyId,
                departmentId: placement.departmentId,
                teamId: placement.teamId,
                managerAgentId: agent.managerAgentId,
                classification: classification
            )
        }
    }

    public func assignDepartmentManager(
        context: ServiceRequestContext,
        departmentId: String,
        managerAgentId: String,
        replaceExisting: Bool = false
    ) throws -> AgentOrgDepartment {
        try requireOrgAuthority(context: context, action: "assign_department_manager", detail: [
            "departmentId": .string(departmentId),
            "managerAgentId": .string(managerAgentId)
        ])
        let department = try data.getAgentOrgDepartment(departmentId)
        let manager = try data.getAgent(managerAgentId)
        try requireSameWorkspace(context: context, workspaceId: department.workspaceId, action: "assign_department_manager", detail: [
            "departmentId": .string(departmentId)
        ])
        try requireSameWorkspace(context: context, workspaceId: manager.workspaceId, action: "assign_department_manager", detail: [
            "managerAgentId": .string(managerAgentId)
        ])
        if let existing = department.headAgentId, existing != managerAgentId, !replaceExisting {
            let result = ServiceGuard.decisionRequired(
                context: context,
                decisionId: "agent.department.manager.replace",
                message: "Replacing the current department manager requires confirmation."
            )
            try auditDenied(context: context, result: result, action: "assign_department_manager", detail: [
                "departmentId": .string(departmentId),
                "existingManagerAgentId": .string(existing),
                "requestedManagerAgentId": .string(managerAgentId)
            ])
            throw result
        }
        let updated = try data.setAgentOrgDepartmentHead(
            departmentId: departmentId,
            headAgentId: managerAgentId,
            metadata: [
                "managerReplacementConfirmed": .bool(replaceExisting),
                "previousManagerAgentId": department.headAgentId.map(JSONValue.string) ?? .null,
                "source": .string("AgentOrganizationService.assignDepartmentManager")
            ]
        )
        _ = try syncAgentPlacementToDepartment(agentId: managerAgentId, department: updated, teamId: nil)
        return updated
    }

    public func clearDepartmentManager(
        context: ServiceRequestContext,
        departmentId: String
    ) throws -> AgentOrgDepartment {
        try requireOrgAuthority(context: context, action: "clear_department_manager", detail: [
            "departmentId": .string(departmentId)
        ])
        let department = try data.getAgentOrgDepartment(departmentId)
        try requireSameWorkspace(context: context, workspaceId: department.workspaceId, action: "clear_department_manager", detail: [
            "departmentId": .string(departmentId)
        ])
        return try data.setAgentOrgDepartmentHead(
            departmentId: departmentId,
            headAgentId: nil,
            metadata: [
                "previousManagerAgentId": department.headAgentId.map(JSONValue.string) ?? .null,
                "source": .string("AgentOrganizationService.clearDepartmentManager")
            ]
        )
    }

    public func setAgentManager(
        context: ServiceRequestContext,
        reportAgentId: String,
        managerAgentId: String?
    ) throws -> AgentWithBinding {
        try requireOrgAuthority(context: context, action: "set_agent_manager", detail: [
            "reportAgentId": .string(reportAgentId),
            "managerAgentId": managerAgentId.map(JSONValue.string) ?? .null
        ])
        let report = try data.getAgent(reportAgentId)
        try requireSameWorkspace(context: context, workspaceId: report.workspaceId, action: "set_agent_manager", detail: [
            "reportAgentId": .string(reportAgentId)
        ])
        if let managerAgentId {
            let manager = try data.getAgent(managerAgentId)
            try requireSameWorkspace(context: context, workspaceId: manager.workspaceId, action: "set_agent_manager", detail: [
                "managerAgentId": .string(managerAgentId)
            ])
        }
        return try data.setAgentManagerRelationship(
            workspaceId: context.workspaceId,
            reportAgentId: reportAgentId,
            managerAgentId: managerAgentId,
            metadata: serviceMetadata(context: context, action: "set_agent_manager")
        )
    }

    public func setDepartmentAgentOpsRoom(
        context: ServiceRequestContext,
        departmentId: String,
        agentOpsRoomId: String?
    ) throws -> AgentOrgDepartment {
        try requireOrgAuthority(context: context, action: "set_department_agentops_room", detail: [
            "departmentId": .string(departmentId),
            "agentOpsRoomId": agentOpsRoomId.map(JSONValue.string) ?? .null
        ])
        let department = try data.getAgentOrgDepartment(departmentId)
        try requireSameWorkspace(context: context, workspaceId: department.workspaceId, action: "set_department_agentops_room", detail: [
            "departmentId": .string(departmentId)
        ])
        return try data.setAgentOrgDepartmentAgentOpsRoom(
            departmentId: departmentId,
            agentOpsRoomId: agentOpsRoomId,
            metadata: serviceMetadata(context: context, action: "set_department_agentops_room")
        )
    }

    public func setTeamAgentOpsRoom(
        context: ServiceRequestContext,
        teamId: String,
        agentOpsRoomId: String?
    ) throws -> AgentOrgTeam {
        try requireOrgAuthority(context: context, action: "set_team_agentops_room", detail: [
            "teamId": .string(teamId),
            "agentOpsRoomId": agentOpsRoomId.map(JSONValue.string) ?? .null
        ])
        let team = try data.getAgentOrgTeam(teamId)
        try requireSameWorkspace(context: context, workspaceId: team.workspaceId, action: "set_team_agentops_room", detail: [
            "teamId": .string(teamId)
        ])
        return try data.setAgentOrgTeamAgentOpsRoom(
            teamId: teamId,
            agentOpsRoomId: agentOpsRoomId,
            metadata: serviceMetadata(context: context, action: "set_team_agentops_room")
        )
    }

    public func dashboardCounts(context: ServiceRequestContext) throws -> AgentOrgDashboardCounts {
        let companies = try data.listAgentOrgCompanies(workspaceId: context.workspaceId)
        let departments = try data.listAgentOrgDepartments(workspaceId: context.workspaceId)
        let teams = try data.listAgentOrgTeams(workspaceId: context.workspaceId)
        let relationships = try data.listAgentManagerRelationships(workspaceId: context.workspaceId)
        let agents = try data.listAgents(workspaceId: context.workspaceId)
        var agentsByCompany: [RelayId: Int] = [:]
        var agentsByDepartment: [RelayId: Int] = [:]
        var agentsByTeam: [RelayId: Int] = [:]
        var personalAgentCount = 0
        var familyAgentCount = 0
        var businessAgentCount = 0
        for agent in agents where agent.status == "active" {
            switch agent.groupType {
            case .personal:
                personalAgentCount += 1
            case .family:
                familyAgentCount += 1
            case .business:
                businessAgentCount += 1
            case .unassigned, nil:
                break
            }
            if let companyId = agent.companyId {
                agentsByCompany[companyId, default: 0] += 1
            }
            if let departmentId = agent.departmentId {
                agentsByDepartment[departmentId, default: 0] += 1
            }
            if let teamId = agent.teamId {
                agentsByTeam[teamId, default: 0] += 1
            }
        }
        return AgentOrgDashboardCounts(
            workspaceId: context.workspaceId,
            companyCount: companies.count,
            departmentCount: departments.count,
            teamCount: teams.count,
            managerRelationshipCount: relationships.count,
            personalAgentCount: personalAgentCount,
            familyAgentCount: familyAgentCount,
            businessAgentCount: businessAgentCount,
            agentsByCompany: agentsByCompany,
            agentsByDepartment: agentsByDepartment,
            agentsByTeam: agentsByTeam
        )
    }

    public func deleteCompany(context: ServiceRequestContext, companyId: String) throws -> AgentOrgCompany {
        try requireOrgAuthority(context: context, action: "delete_company", detail: ["companyId": .string(companyId)])
        let company = try data.getAgentOrgCompany(companyId)
        try requireSameWorkspace(context: context, workspaceId: company.workspaceId, action: "delete_company", detail: [
            "companyId": .string(companyId)
        ])
        let hasDepartments = try data
            .listAgentOrgDepartments(workspaceId: context.workspaceId)
            .contains { $0.companyId == companyId }
        let hasAgents = try data
            .listAgents(workspaceId: context.workspaceId)
            .contains { $0.companyId == companyId && $0.status == "active" }
        guard !hasDepartments && !hasAgents else {
            let result = ServiceGuard.blocked(
                context: context,
                reasonCode: .policyBlocked,
                message: "Delete organization after moving or deleting its departments and agents."
            )
            try auditDenied(context: context, result: result, action: "delete_company", detail: [
                "companyId": .string(companyId),
                "hasDepartments": .bool(hasDepartments),
                "hasAgents": .bool(hasAgents)
            ])
            throw result
        }
        return try data.markAgentOrgCompanyDeleted(companyId)
    }

    public func cascadeDeleteCompany(context: ServiceRequestContext, companyId: String) throws -> AgentOrgCascadeDeleteResult {
        try requireOrgAuthority(context: context, action: "cascade_delete_company", detail: ["companyId": .string(companyId)])
        let company = try data.getAgentOrgCompany(companyId)
        try requireSameWorkspace(context: context, workspaceId: company.workspaceId, action: "cascade_delete_company", detail: [
            "companyId": .string(companyId)
        ])
        return try data.cascadeDeleteAgentOrgCompany(companyId)
    }

    public func deleteDepartment(context: ServiceRequestContext, departmentId: String) throws -> AgentOrgDepartment {
        try requireOrgAuthority(context: context, action: "delete_department", detail: ["departmentId": .string(departmentId)])
        let department = try data.getAgentOrgDepartment(departmentId)
        try requireSameWorkspace(context: context, workspaceId: department.workspaceId, action: "delete_department", detail: [
            "departmentId": .string(departmentId)
        ])
        let hasTeams = try data
            .listAgentOrgTeams(workspaceId: context.workspaceId)
            .contains { $0.departmentId == departmentId }
        let hasAgents = try data
            .listAgents(workspaceId: context.workspaceId)
            .contains { $0.departmentId == departmentId && $0.status == "active" }
        guard !hasTeams && !hasAgents else {
            let result = ServiceGuard.blocked(
                context: context,
                reasonCode: .policyBlocked,
                message: "Delete department after moving or deleting its teams and agents."
            )
            try auditDenied(context: context, result: result, action: "delete_department", detail: [
                "departmentId": .string(departmentId),
                "hasTeams": .bool(hasTeams),
                "hasAgents": .bool(hasAgents)
            ])
            throw result
        }
        return try data.markAgentOrgDepartmentDeleted(departmentId)
    }

    public func deleteTeam(context: ServiceRequestContext, teamId: String) throws -> AgentOrgTeam {
        try requireOrgAuthority(context: context, action: "delete_team", detail: ["teamId": .string(teamId)])
        let team = try data.getAgentOrgTeam(teamId)
        try requireSameWorkspace(context: context, workspaceId: team.workspaceId, action: "delete_team", detail: [
            "teamId": .string(teamId)
        ])
        let hasAgents = try data
            .listAgents(workspaceId: context.workspaceId)
            .contains { $0.teamId == teamId && $0.status == "active" }
        guard !hasAgents else {
            let result = ServiceGuard.blocked(
                context: context,
                reasonCode: .policyBlocked,
                message: "Delete team after moving its agents."
            )
            try auditDenied(context: context, result: result, action: "delete_team", detail: [
                "teamId": .string(teamId),
                "hasAgents": .bool(hasAgents)
            ])
            throw result
        }
        return try data.markAgentOrgTeamDeleted(teamId)
    }

    private func requireOrgAuthority(
        context: ServiceRequestContext,
        action: String,
        detail: JSONRecord = [:]
    ) throws {
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin],
            context: context,
            message: "Only workspace owners and admins can change agent organization.",
            recovery: "Ask a workspace owner or admin to make this change."
        ) {
            try auditDenied(context: context, result: denied, action: action, detail: detail)
            throw denied
        }
    }

    private func requireSameWorkspace(
        context: ServiceRequestContext,
        workspaceId: String,
        action: String,
        detail: JSONRecord = [:]
    ) throws {
        guard context.workspaceId == workspaceId else {
            let result = ServiceGuard.invalidInput(
                context: context,
                message: "Selected organization record does not belong to this workspace."
            )
            try auditDenied(context: context, result: result, action: action, detail: detail)
            throw result
        }
    }

    private func validateBusinessPlacement(
        context: ServiceRequestContext,
        companyId: String?,
        departmentId: String?,
        teamId: String?
    ) throws -> (companyId: String, departmentId: String?, teamId: String?) {
        guard let companyId else {
            let result = ServiceGuard.invalidInput(
                context: context,
                message: "Business placement requires an organization."
            )
            try auditDenied(context: context, result: result, action: "update_agent_placement", detail: [
                "groupType": .string(AgentGroupType.business.rawValue)
            ])
            throw result
        }
        let company = try data.getAgentOrgCompany(companyId)
        try requireSameWorkspace(context: context, workspaceId: company.workspaceId, action: "update_agent_placement", detail: [
            "companyId": .string(companyId)
        ])
        var resolvedDepartmentId = departmentId
        if let departmentId {
            let department = try data.getAgentOrgDepartment(departmentId)
            try requireSameWorkspace(context: context, workspaceId: department.workspaceId, action: "update_agent_placement", detail: [
                "departmentId": .string(departmentId)
            ])
            guard department.companyId == companyId else {
                let result = ServiceGuard.invalidInput(
                    context: context,
                    message: "Department must belong to the selected organization."
                )
                try auditDenied(context: context, result: result, action: "update_agent_placement", detail: [
                    "companyId": .string(companyId),
                    "departmentId": .string(departmentId)
                ])
                throw result
            }
        }
        if let teamId {
            let team = try data.getAgentOrgTeam(teamId)
            try requireSameWorkspace(context: context, workspaceId: team.workspaceId, action: "update_agent_placement", detail: [
                "teamId": .string(teamId)
            ])
            guard let teamDepartmentId = team.departmentId else {
                let result = ServiceGuard.invalidInput(
                    context: context,
                    message: "Team must belong to a department before placement."
                )
                try auditDenied(context: context, result: result, action: "update_agent_placement", detail: [
                    "teamId": .string(teamId)
                ])
                throw result
            }
            guard let departmentId, departmentId == teamDepartmentId else {
                let result = ServiceGuard.invalidInput(
                    context: context,
                    message: "Team must belong to the selected department."
                )
                try auditDenied(context: context, result: result, action: "update_agent_placement", detail: [
                    "departmentId": departmentId.map(JSONValue.string) ?? .null,
                    "teamDepartmentId": .string(teamDepartmentId),
                    "teamId": .string(teamId)
                ])
                throw result
            }
            resolvedDepartmentId = teamDepartmentId
        }
        return (companyId, resolvedDepartmentId, teamId)
    }

    @discardableResult
    private func syncAgentPlacementToDepartment(
        agentId: String,
        department: AgentOrgDepartment,
        teamId: String?
    ) throws -> AgentWithBinding {
        let agent = try data.getAgent(agentId)
        return try data.updateAgentOrgPlacement(
            agentId: agentId,
            groupType: .business,
            familyLabel: nil,
            companyId: department.companyId,
            departmentId: department.id,
            teamId: teamId,
            managerAgentId: agent.managerAgentId,
            classification: agent.classification
        )
    }

    private func serviceMetadata(context: ServiceRequestContext, action: String) -> JSONRecord {
        [
            "source": .string("AgentOrganizationService"),
            "action": .string(action),
            "actorId": .string(context.actorId),
            "correlationId": .string(context.correlationId)
        ]
    }

    private func auditDenied(
        context: ServiceRequestContext,
        result: ServiceGuardResult,
        action: String,
        detail: JSONRecord = [:]
    ) throws {
        var auditDetail = detail
        auditDetail["action"] = .string(action)
        auditDetail["actorId"] = .string(context.actorId)
        auditDetail["workspaceId"] = .string(context.workspaceId)
        auditDetail["stateKind"] = .string(result.stateKind.rawValue)
        auditDetail["reasonCode"] = .string(result.reasonCode.rawValue)
        auditDetail["auditRequired"] = .bool(result.auditRequired)
        _ = try data.log(
            severity: "warning",
            category: "authority",
            message: "Denied agent organization mutation.",
            correlationId: context.correlationId,
            detail: auditDetail
        )
    }
}
