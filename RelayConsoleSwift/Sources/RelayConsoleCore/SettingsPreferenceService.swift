import Foundation

public struct AccountSettingsInput: Codable, Equatable, Sendable {
    public var displayName: String
    public var email: String
    public var avatarUrl: String?
    public var telemetryEnabled: Bool
    public var crashReportingEnabled: Bool

    public init(
        displayName: String,
        email: String,
        avatarUrl: String?,
        telemetryEnabled: Bool,
        crashReportingEnabled: Bool
    ) {
        self.displayName = displayName
        self.email = email
        self.avatarUrl = avatarUrl
        self.telemetryEnabled = telemetryEnabled
        self.crashReportingEnabled = crashReportingEnabled
    }
}

public struct AppearanceSettingsInput: Codable, Equatable, Sendable {
    public var theme: String

    public init(theme: String) {
        self.theme = theme
    }
}

public struct WorkspaceSettingsInput: Codable, Equatable, Sendable {
    public var name: String
    public var workspaceType: String

    public init(name: String, workspaceType: String) {
        self.name = name
        self.workspaceType = workspaceType
    }
}

public struct WorkspaceSettingsSummary: Codable, Equatable, Sendable {
    public var workspace: Workspace
    public var organizations: Int
    public var departments: Int
    public var teams: Int
    public var agents: Int
    public var readOnly: Bool

    public init(
        workspace: Workspace,
        organizations: Int,
        departments: Int,
        teams: Int,
        agents: Int,
        readOnly: Bool
    ) {
        self.workspace = workspace
        self.organizations = organizations
        self.departments = departments
        self.teams = teams
        self.agents = agents
        self.readOnly = readOnly
    }
}

public final class SettingsPreferenceService {
    private let data: LocalDataService
    private let eventBus: RelayEventBus

    public init(data: LocalDataService, eventBus: RelayEventBus) {
        self.data = data
        self.eventBus = eventBus
    }

    @discardableResult
    public func saveAccount(
        context: ServiceRequestContext,
        profileId: RelayId,
        input: AccountSettingsInput
    ) throws -> LocalProfile {
        let current = try data.getProfile(profileId)
        try requireProfileMutationAuthority(context: context, profileId: profileId)
        let displayName = try requireNonEmptyString(input.displayName, field: "Display name", maxLength: 120)
        let email = try optionalTrimmedString(input.email, field: "Email", maxLength: 254)
        let updated = try data.updateProfile(
            profileId: current.id,
            displayName: displayName,
            email: email,
            avatarUrl: input.avatarUrl,
            telemetryEnabled: input.telemetryEnabled,
            crashReportingEnabled: input.crashReportingEnabled,
            theme: current.theme
        )
        eventBus.emit(.settingsProfileUpdated, updated)
        return updated
    }

    @discardableResult
    public func saveAppearance(
        context: ServiceRequestContext,
        profileId: RelayId,
        input: AppearanceSettingsInput
    ) throws -> LocalProfile {
        let current = try data.getProfile(profileId)
        try requireProfileMutationAuthority(context: context, profileId: profileId)
        let theme = try requireNonEmptyString(input.theme, field: "Theme", maxLength: 40)
        let updated = try data.updateProfile(
            profileId: current.id,
            displayName: current.displayName,
            email: current.email,
            avatarUrl: current.avatarUrl,
            telemetryEnabled: current.telemetryEnabled,
            crashReportingEnabled: current.crashReportingEnabled,
            theme: theme
        )
        eventBus.emit(.settingsProfileUpdated, updated)
        return updated
    }

    public func workspaceSummary(
        context: ServiceRequestContext,
        workspaceId: RelayId
    ) throws -> WorkspaceSettingsSummary {
        let workspace = try data.getWorkspace(workspaceId)
        try requireWorkspaceRead(context: context, workspaceId: workspaceId)
        return WorkspaceSettingsSummary(
            workspace: workspace,
            organizations: try data.listAgentOrgCompanies(workspaceId: workspaceId).count,
            departments: try data.listAgentOrgDepartments(workspaceId: workspaceId).count,
            teams: try data.listAgentOrgTeams(workspaceId: workspaceId).count,
            agents: try data.listAgents(workspaceId: workspaceId).count,
            readOnly: !context.hasAnyRole([.owner, .admin])
        )
    }

    @discardableResult
    public func saveWorkspace(
        context: ServiceRequestContext,
        workspaceId: RelayId,
        input: WorkspaceSettingsInput
    ) throws -> Workspace {
        let current = try data.getWorkspace(workspaceId)
        try requireWorkspaceRead(context: context, workspaceId: workspaceId)
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin],
            context: context,
            message: "Workspace settings require owner or admin access.",
            recovery: "Ask a workspace owner or admin to update workspace settings."
        ) {
            throw denied
        }
        let name = try requireNonEmptyString(input.name, field: "Workspace name", maxLength: 160)
        let updated = try data.updateWorkspaceSettings(
            workspaceId: current.id,
            name: name,
            defaultFolderPath: current.defaultFolderPath,
            workspaceType: input.workspaceType,
            settings: current.settings
        )
        eventBus.emit(.settingsWorkspaceUpdated, updated)
        return updated
    }

    private func requireProfileMutationAuthority(
        context: ServiceRequestContext,
        profileId: RelayId
    ) throws {
        guard context.actorId == profileId || context.hasAnyRole([.owner, .admin]) else {
            throw ServiceGuardResult(
                stateKind: .readOnly,
                reasonCode: .authorityReadOnly,
                message: "Only the local profile owner can update account settings.",
                recovery: "Switch to the matching local profile before saving account settings.",
                correlationId: context.correlationId,
                auditRequired: false
            )
        }
    }

    private func requireWorkspaceRead(
        context: ServiceRequestContext,
        workspaceId: RelayId
    ) throws {
        guard context.workspaceId == workspaceId else {
            throw ServiceGuardResult(
                stateKind: .readOnly,
                reasonCode: .authorityReadOnly,
                message: "Workspace settings are only available for the active workspace.",
                recovery: "Switch to the workspace before changing its settings.",
                correlationId: context.correlationId,
                auditRequired: false
            )
        }
        if let denied = ServiceGuard.requireAnyRole(
            [.owner, .admin, .member, .viewer],
            context: context,
            message: "Workspace settings are unavailable for your current role.",
            auditRequired: false
        ) {
            throw denied
        }
    }
}
