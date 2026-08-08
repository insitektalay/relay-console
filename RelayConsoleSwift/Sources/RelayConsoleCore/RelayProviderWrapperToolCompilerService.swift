import Foundation

public enum RelayProviderWrapperExecutionMode: String, Codable, CaseIterable, Sendable {
    case allowed
    case approvalRequired = "approval_required"
    case autoExecute = "auto_execute"
}

public struct RelayProviderWrapperTool: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var workspaceId: RelayId
    public var appId: RelayId
    public var appSlug: String
    public var executionAuthority: MarketplaceExecutionAuthority
    public var executionAuthorityVersion: String
    public var installId: RelayId?
    public var agentId: RelayId?
    public var toolName: String
    public var displayName: String
    public var summary: String
    public var kind: ProviderActionKind
    public var riskLevel: ProviderActionRiskLevel
    public var permission: ProviderActionPermission
    public var executionMode: RelayProviderWrapperExecutionMode
    public var requiresApproval: Bool
    public var autoExecutes: Bool
    public var readOnly: Bool
    public var inputSchema: JSONRecord
    public var resultSchema: JSONRecord
    public var metadata: JSONRecord
    public var redactionStatus: String

    public init(
        id: RelayId,
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        executionAuthority: MarketplaceExecutionAuthority,
        executionAuthorityVersion: String,
        installId: RelayId?,
        agentId: RelayId?,
        toolName: String,
        displayName: String,
        summary: String,
        kind: ProviderActionKind,
        riskLevel: ProviderActionRiskLevel,
        permission: ProviderActionPermission,
        executionMode: RelayProviderWrapperExecutionMode,
        requiresApproval: Bool,
        autoExecutes: Bool,
        readOnly: Bool,
        inputSchema: JSONRecord,
        resultSchema: JSONRecord,
        metadata: JSONRecord,
        redactionStatus: String
    ) {
        self.id = id
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.executionAuthority = executionAuthority
        self.executionAuthorityVersion = executionAuthorityVersion
        self.installId = installId
        self.agentId = agentId
        self.toolName = toolName
        self.displayName = displayName
        self.summary = summary
        self.kind = kind
        self.riskLevel = riskLevel
        self.permission = permission
        self.executionMode = executionMode
        self.requiresApproval = requiresApproval
        self.autoExecutes = autoExecutes
        self.readOnly = readOnly
        self.inputSchema = inputSchema
        self.resultSchema = resultSchema
        self.metadata = metadata
        self.redactionStatus = redactionStatus
    }
}

public struct RelayProviderWrapperToolDiagnostics: Codable, Equatable, Sendable {
    public var availableToolCount: Int
    public var approvalRequiredCount: Int
    public var autoExecuteCount: Int
    public var blockedActionCount: Int
    public var unavailableActionCount: Int
    public var suppressedRawProviderToolCount: Int
    public var connected: Bool
    public var assignedAgentReady: Bool
    public var rawProviderToolExposure: Bool
    public var executionAuthority: MarketplaceExecutionAuthority
    public var executionAuthorityVersion: String
    public var authorityReady: Bool
    public var message: String
    public var redactionStatus: String

    public init(
        availableToolCount: Int,
        approvalRequiredCount: Int,
        autoExecuteCount: Int,
        blockedActionCount: Int,
        unavailableActionCount: Int,
        suppressedRawProviderToolCount: Int,
        connected: Bool,
        assignedAgentReady: Bool,
        rawProviderToolExposure: Bool,
        executionAuthority: MarketplaceExecutionAuthority,
        executionAuthorityVersion: String,
        authorityReady: Bool,
        message: String,
        redactionStatus: String
    ) {
        self.availableToolCount = availableToolCount
        self.approvalRequiredCount = approvalRequiredCount
        self.autoExecuteCount = autoExecuteCount
        self.blockedActionCount = blockedActionCount
        self.unavailableActionCount = unavailableActionCount
        self.suppressedRawProviderToolCount = suppressedRawProviderToolCount
        self.connected = connected
        self.assignedAgentReady = assignedAgentReady
        self.rawProviderToolExposure = rawProviderToolExposure
        self.executionAuthority = executionAuthority
        self.executionAuthorityVersion = executionAuthorityVersion
        self.authorityReady = authorityReady
        self.message = message
        self.redactionStatus = redactionStatus
    }
}

public struct RelayProviderWrapperToolSurface: Codable, Equatable, Sendable {
    public var workspaceId: RelayId
    public var appId: RelayId
    public var appSlug: String
    public var executionAuthority: MarketplaceExecutionAuthority
    public var executionAuthorityVersion: String
    public var connectionId: RelayId?
    public var installId: RelayId?
    public var agentId: RelayId?
    public var permissionMapId: RelayId?
    public var policyPreset: MarketplaceActionPolicyPreset?
    public var generatedAt: IsoTimestamp
    public var tools: [RelayProviderWrapperTool]
    public var diagnostics: RelayProviderWrapperToolDiagnostics
    public var readOnly: Bool
    public var redactionStatus: String

    public init(
        workspaceId: RelayId,
        appId: RelayId,
        appSlug: String,
        executionAuthority: MarketplaceExecutionAuthority,
        executionAuthorityVersion: String,
        connectionId: RelayId?,
        installId: RelayId?,
        agentId: RelayId?,
        permissionMapId: RelayId?,
        policyPreset: MarketplaceActionPolicyPreset?,
        generatedAt: IsoTimestamp,
        tools: [RelayProviderWrapperTool],
        diagnostics: RelayProviderWrapperToolDiagnostics,
        readOnly: Bool,
        redactionStatus: String
    ) {
        self.workspaceId = workspaceId
        self.appId = appId
        self.appSlug = appSlug
        self.executionAuthority = executionAuthority
        self.executionAuthorityVersion = executionAuthorityVersion
        self.connectionId = connectionId
        self.installId = installId
        self.agentId = agentId
        self.permissionMapId = permissionMapId
        self.policyPreset = policyPreset
        self.generatedAt = generatedAt
        self.tools = tools
        self.diagnostics = diagnostics
        self.readOnly = readOnly
        self.redactionStatus = redactionStatus
    }
}

public final class RelayProviderWrapperToolCompilerService {
    private let data: LocalDataService

    public init(data: LocalDataService) {
        self.data = data
    }

    public func compileSurface(
        context: ServiceRequestContext,
        appIdOrSlug: RelayId,
        connectionId: RelayId? = nil,
        installId: RelayId? = nil,
        agentId: RelayId? = nil,
        now: Date = Date()
    ) throws -> RelayProviderWrapperToolSurface {
        try requireReadAccess(context: context)
        let app = try requireProviderActionApp(context: context, appIdOrSlug: appIdOrSlug)
        let requestedInstall = try installId.flatMap { try requireInstall(context: context, installId: $0, app: app) }
        let requestedAgent = try agentId.flatMap { try requireAgent(context: context, agentId: $0) }
        if let requestedInstall, let requestedAgent, requestedInstall.agentId != requestedAgent.id {
            throw ServiceGuard.invalidInput(context: context, message: "Wrapper tool compiler install does not match the requested agent.")
        }
        let install = try requestedInstall ?? activeInstall(context: context, app: app, agentId: requestedAgent?.id)
        let effectiveAgentId = requestedAgent?.id ?? install?.agentId
        let effectiveConnectionId = connectionId ?? install?.connectionId
        let executionAuthority = MarketplaceExecutionAuthority.currentSwiftAdapterAuthority(for: app.slug)
        if executionAuthority == .railway {
            let diagnostics = RelayProviderWrapperToolDiagnostics(
                availableToolCount: 0,
                approvalRequiredCount: 0,
                autoExecuteCount: 0,
                blockedActionCount: 0,
                unavailableActionCount: 0,
                suppressedRawProviderToolCount: 0,
                connected: false,
                assignedAgentReady: install != nil && effectiveAgentId != nil,
                rawProviderToolExposure: false,
                executionAuthority: .railway,
                executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
                authorityReady: true,
                message: "Railway supplies external Marketplace tools. The local Swift compiler exposes no provider wrappers.",
                redactionStatus: "private-state-excluded"
            )
            return RelayProviderWrapperToolSurface(
                workspaceId: context.workspaceId,
                appId: app.id,
                appSlug: app.slug,
                executionAuthority: .railway,
                executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
                connectionId: effectiveConnectionId,
                installId: install?.id,
                agentId: effectiveAgentId,
                permissionMapId: nil,
                policyPreset: nil,
                generatedAt: ISO8601DateFormatter.relayConsole.string(from: now),
                tools: [],
                diagnostics: diagnostics,
                readOnly: !context.hasAnyRole([.owner, .admin, .operator]),
                redactionStatus: "private-state-excluded"
            )
        }
        let connection = try effectiveConnectionId.flatMap { try requireConnection(context: context, connectionId: $0, app: app) }
            ?? usableConnection(context: context, app: app, executionAuthority: executionAuthority)
        let connectionAuthorityReady = connection.map { $0.resolvedExecutionAuthority == executionAuthority } ?? true
        let installAuthorityReady = install.map { $0.resolvedExecutionAuthority == executionAuthority } ?? true
        let connected = (connection.map(Self.connectionIsUsable) ?? false) && connectionAuthorityReady
        let assignedAgentReady = install != nil && effectiveAgentId != nil && installAuthorityReady
        let definitions = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).filter(\.enabled)
        let permissionMap = try resolvePermissionMap(
            context: context,
            app: app,
            connectionId: connection?.id ?? effectiveConnectionId,
            installId: install?.id,
            agentId: effectiveAgentId
        )
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let policyAuthorityReady = permissionMap.map { $0.resolvedExecutionAuthority == executionAuthority } ?? true
        let authorityReady = connectionAuthorityReady && installAuthorityReady && policyAuthorityReady
        let rawActionCount = definitions.count
        let tools = definitions
            .sorted { lhs, rhs in
                if lhs.kind.rawValue == rhs.kind.rawValue {
                    return lhs.displayName < rhs.displayName
                }
                return lhs.kind.rawValue < rhs.kind.rawValue
            }
            .compactMap { definition -> RelayProviderWrapperTool? in
                let permission = MarketplaceProviderActionPolicyCompilerService.effectivePermission(
                    permissionMap?.permissions[definition.actionKey] ?? definition.defaultPermission,
                    permissionMap: permissionMap
                )
                guard connected, assignedAgentReady, authorityReady,
                      wrapperExposes(definition: definition, permission: permission) else {
                    return nil
                }
                return wrapperTool(
                    context: context,
                    app: app,
                    install: install,
                    agentId: effectiveAgentId,
                    definition: definition,
                    permission: permission,
                    policyPreset: permissionMap?.policyPreset,
                    executionAuthority: executionAuthority
                )
            }
        let blockedActionCount = definitions.filter {
            let permission = MarketplaceProviderActionPolicyCompilerService.effectivePermission(
                permissionMap?.permissions[$0.actionKey] ?? $0.defaultPermission,
                permissionMap: permissionMap
            )
            return permission == .blocked || $0.riskLevel == .destructive
        }.count
        let unavailableActionCount = max(rawActionCount - tools.count - blockedActionCount, 0)
        let diagnostics = RelayProviderWrapperToolDiagnostics(
            availableToolCount: tools.count,
            approvalRequiredCount: tools.filter(\.requiresApproval).count,
            autoExecuteCount: tools.filter(\.autoExecutes).count,
            blockedActionCount: blockedActionCount,
            unavailableActionCount: unavailableActionCount,
            suppressedRawProviderToolCount: rawActionCount,
            connected: connected,
            assignedAgentReady: assignedAgentReady,
            rawProviderToolExposure: false,
            executionAuthority: executionAuthority,
            executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
            authorityReady: authorityReady,
            message: diagnosticsMessage(
                connected: connected,
                assignedAgentReady: assignedAgentReady,
                authorityReady: authorityReady,
                executionAuthority: executionAuthority,
                tools: tools
            ),
            redactionStatus: "private-state-excluded"
        )
        return RelayProviderWrapperToolSurface(
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            executionAuthority: executionAuthority,
            executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
            connectionId: connection?.id ?? effectiveConnectionId,
            installId: install?.id,
            agentId: effectiveAgentId,
            permissionMapId: permissionMap?.id,
            policyPreset: permissionMap?.policyPreset,
            generatedAt: timestamp,
            tools: tools,
            diagnostics: diagnostics,
            readOnly: !context.hasAnyRole([.owner, .admin, .operator]),
            redactionStatus: "private-state-excluded"
        )
    }

    private func wrapperTool(
        context: ServiceRequestContext,
        app: MarketplaceCatalogApp,
        install: MarketplaceInstallRecord?,
        agentId: RelayId?,
        definition: MarketplaceProviderActionDefinition,
        permission: ProviderActionPermission,
        policyPreset: MarketplaceActionPolicyPreset?,
        executionAuthority: MarketplaceExecutionAuthority
    ) -> RelayProviderWrapperTool {
        let mode = executionMode(for: permission)
        let suffix = Self.wrapperToolSuffix(definition: definition)
        let toolId = "rwrap-\(Self.safeIdentifierComponent(context.workspaceId))-\(Self.safeIdentifierComponent(app.id))-\(suffix)"
        let toolName = Self.wrapperToolName(appSlug: app.slug, definition: definition)
        return RelayProviderWrapperTool(
            id: toolId,
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            executionAuthority: executionAuthority,
            executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
            installId: install?.id,
            agentId: agentId,
            toolName: toolName,
            displayName: definition.displayName,
            summary: definition.summary,
            kind: definition.kind,
            riskLevel: definition.riskLevel,
            permission: permission,
            executionMode: mode,
            requiresApproval: permission == .approvalRequired,
            autoExecutes: permission == .autoExecute,
            readOnly: definition.kind == .read || definition.kind == .search,
            inputSchema: definition.payloadSchema,
            resultSchema: definition.resultSchema,
            metadata: [
                "brokeredBy": .string("provider-action-broker"),
                "executionAuthority": .string(executionAuthority.rawValue),
                "executionAuthorityVersion": .string(MarketplaceExecutionAuthority.contractVersion),
                "policyPreset": policyPreset.map { .string($0.rawValue) } ?? .null,
                "rawProviderToolExposure": .bool(false),
                "providerActionMapping": .string("internal"),
                "redactionStatus": .string("private-state-excluded")
            ],
            redactionStatus: "private-state-excluded"
        )
    }

    private func wrapperExposes(
        definition: MarketplaceProviderActionDefinition,
        permission: ProviderActionPermission
    ) -> Bool {
        guard permission != .blocked, definition.riskLevel != .destructive else {
            return false
        }
        switch definition.adapterKind {
        case .unsupported, .manualOnly:
            return false
        case .officialMCP, .communityMCP, .nativeAPI, .browserAutomation, .localScript:
            return true
        }
    }

    private func executionMode(for permission: ProviderActionPermission) -> RelayProviderWrapperExecutionMode {
        switch permission {
        case .allowed:
            return .allowed
        case .approvalRequired:
            return .approvalRequired
        case .autoExecute:
            return .autoExecute
        case .blocked:
            return .allowed
        }
    }

    private func requireProviderActionApp(
        context: ServiceRequestContext,
        appIdOrSlug: RelayId
    ) throws -> MarketplaceCatalogApp {
        guard let app = try data.getMarketplaceCatalogApp(workspaceId: context.workspaceId, appIdOrSlug: appIdOrSlug) else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace app was not found for wrapper tool compilation.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              !app.localAppExcluded,
              !app.reviewExcluded,
              !app.slug.localizedCaseInsensitiveContains("paperclip")
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Wrapper tool compilation requires an available external Marketplace app.")
        }
        return app
    }

    private func requireConnection(
        context: ServiceRequestContext,
        connectionId: RelayId,
        app: MarketplaceCatalogApp
    ) throws -> MarketplaceProviderConnection {
        guard let connection = try data.getProviderConnection(workspaceId: context.workspaceId, connectionId: connectionId),
              connection.appId == app.id,
              connection.appSlug == app.slug else {
            throw ServiceGuard.invalidInput(context: context, message: "Wrapper tool compiler connection does not match the Marketplace app.")
        }
        return connection
    }

    private func usableConnection(
        context: ServiceRequestContext,
        app: MarketplaceCatalogApp,
        executionAuthority: MarketplaceExecutionAuthority
    ) throws -> MarketplaceProviderConnection? {
        try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
            .first {
                Self.connectionIsUsable($0) && $0.resolvedExecutionAuthority == executionAuthority
            }
    }

    private func requireInstall(
        context: ServiceRequestContext,
        installId: RelayId,
        app: MarketplaceCatalogApp
    ) throws -> MarketplaceInstallRecord {
        guard let install = try data.getMarketplaceInstall(workspaceId: context.workspaceId, installId: installId),
              install.appId == app.id,
              install.appSlug == app.slug else {
            throw ServiceGuard.invalidInput(context: context, message: "Wrapper tool compiler install does not match the Marketplace app.")
        }
        return install
    }

    private func activeInstall(
        context: ServiceRequestContext,
        app: MarketplaceCatalogApp,
        agentId: RelayId?
    ) throws -> MarketplaceInstallRecord? {
        try data.listMarketplaceInstalls(workspaceId: context.workspaceId, appId: app.id)
            .first {
                Self.isActiveInstall($0) && (agentId == nil || $0.agentId == agentId)
            }
    }

    private func requireAgent(
        context: ServiceRequestContext,
        agentId: RelayId
    ) throws -> AgentWithBinding {
        let agent = try data.getAgent(agentId)
        guard agent.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Wrapper tool compiler agent workspace does not match the request context.")
        }
        return agent
    }

    private func resolvePermissionMap(
        context: ServiceRequestContext,
        app: MarketplaceCatalogApp,
        connectionId: RelayId?,
        installId: RelayId?,
        agentId: RelayId?
    ) throws -> MarketplaceActionPermissionMap? {
        let maps = try data.listMarketplaceActionPermissionMaps(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        )
        return maps
            .filter {
                $0.appId == app.id
                    && Self.mapMatches($0.installId, requested: installId)
                    && Self.mapMatches($0.connectionId, requested: connectionId)
                    && Self.mapMatches($0.agentId, requested: agentId)
            }
            .sorted { Self.specificity($0) > Self.specificity($1) }
            .first
    }

    private static func mapMatches(_ mapped: RelayId?, requested: RelayId?) -> Bool {
        if let requested {
            return mapped == requested || mapped == nil
        }
        return mapped == nil
    }

    private static func specificity(_ map: MarketplaceActionPermissionMap) -> Int {
        [map.installId, map.connectionId, map.agentId].reduce(0) { total, value in
            total + (value == nil ? 0 : 1)
        }
    }

    private static func connectionIsUsable(_ connection: MarketplaceProviderConnection) -> Bool {
        switch connection.status {
        case .connected, .healthError, .senderInvalid, .expired, .reauthorizeRequired:
            return true
        case .disconnected, .authRequired, .validating, .disconnecting, .unavailable:
            return false
        }
    }

    private static func isActiveInstall(_ install: MarketplaceInstallRecord) -> Bool {
        install.installStatus == .installed || install.installStatus == .requested
    }

    private func diagnosticsMessage(
        connected: Bool,
        assignedAgentReady: Bool,
        authorityReady: Bool,
        executionAuthority: MarketplaceExecutionAuthority,
        tools: [RelayProviderWrapperTool]
    ) -> String {
        if !authorityReady {
            return "Marketplace execution authority is unavailable or does not match the \(executionAuthority.rawValue) broker; no fallback was attempted."
        }
        if !connected {
            return "No usable provider connection is available for wrapper tools."
        }
        if !assignedAgentReady {
            return "No active Marketplace install is assigned for wrapper tools."
        }
        if tools.isEmpty {
            return "Policy produced no agent-facing Relay wrapper tools."
        }
        return "\(tools.count) Relay wrapper tool\(tools.count == 1 ? "" : "s") compiled for the assigned agent."
    }

    public static func wrapperToolName(appSlug: String, definition: MarketplaceProviderActionDefinition) -> String {
        if appSlug == "microsoft-clarity",
           definition.actionKey == "microsoft_clarity_get_project_live_insights" {
            return "relay_microsoft_clarity_get_project_live_insights"
        }
        if appSlug == "google-search-console" {
            switch definition.actionKey {
            case "google_search_console_properties_list":
                return "relay_google_search_console_list_properties"
            case "google_search_console_property_get":
                return "relay_google_search_console_get_property"
            case "google_search_console_search_analytics_query":
                return "relay_google_search_console_query_search_analytics"
            case "google_search_console_url_inspect":
                return "relay_google_search_console_inspect_url"
            case "google_search_console_sitemaps_list":
                return "relay_google_search_console_list_sitemaps"
            case "google_search_console_sitemap_get":
                return "relay_google_search_console_get_sitemap"
            default:
                break
            }
        }
        if appSlug == "google-merchant-center" {
            switch definition.actionKey {
            case "google_merchant_center_accounts_list": return "relay_google_merchant_center_list_accounts"
            case "google_merchant_center_products_list": return "relay_google_merchant_center_list_products"
            case "google_merchant_center_product_get": return "relay_google_merchant_center_get_product"
            case "google_merchant_center_product_issues_summary": return "relay_google_merchant_center_review_product_issues"
            default: break
            }
        }
        if appSlug == "youtube" {
            switch definition.actionKey {
            case "youtube_channels_list_mine": return "relay_youtube_get_my_channel"
            case "youtube_playlists_list_mine": return "relay_youtube_list_my_playlists"
            case "youtube_playlist_items_list": return "relay_youtube_list_playlist_items"
            case "youtube_videos_list": return "relay_youtube_get_videos"
            default: break
            }
        }
        if appSlug == "google-classroom" {
            switch definition.actionKey {
            case "google_classroom_courses_list_mine": return "relay_google_classroom_list_my_courses"
            case "google_classroom_course_get": return "relay_google_classroom_get_course"
            case "google_classroom_coursework_list": return "relay_google_classroom_list_coursework"
            case "google_classroom_materials_list": return "relay_google_classroom_list_materials"
            default: break
            }
        }
        if appSlug == "outlook" {
            switch definition.actionKey {
            case "outlook_mail_folders_list": return "relay_outlook_list_mail_folders";
            case "outlook_inbox_messages_list": return "relay_outlook_list_inbox_messages";
            case "outlook_unread_messages_list": return "relay_outlook_list_unread_messages";
            case "outlook_message_get": return "relay_outlook_get_message";
            default: break
            }
        }
        if appSlug == "microsoft-teams" {
            switch definition.actionKey {
            case "microsoft_teams_joined_teams_list": return "relay_microsoft_teams_list_joined_teams";
            case "microsoft_teams_team_get": return "relay_microsoft_teams_get_team";
            case "microsoft_teams_channels_list": return "relay_microsoft_teams_list_channels";
            case "microsoft_teams_channel_get": return "relay_microsoft_teams_get_channel";
            default: break
            }
        }
        if appSlug == "onedrive" {
            switch definition.actionKey {
            case "onedrive_drive_get": return "relay_onedrive_get_drive";
            case "onedrive_root_children_list": return "relay_onedrive_list_root_items";
            case "onedrive_folder_children_list": return "relay_onedrive_list_folder_items";
            case "onedrive_item_get": return "relay_onedrive_get_item";
            default: break
            }
        }
        if appSlug == "sharepoint" {
            switch definition.actionKey {
            case "sharepoint_site_get": return "relay_sharepoint_get_site";
            case "sharepoint_lists_list": return "relay_sharepoint_list_lists";
            case "sharepoint_drives_list": return "relay_sharepoint_list_document_libraries";
            case "sharepoint_default_library_root_list": return "relay_sharepoint_list_default_library_root";
            default: break
            }
        }
        if appSlug == "microsoft-planner" {
            switch definition.actionKey {
            case "microsoft_planner_assigned_tasks_list": return "relay_microsoft_planner_list_my_tasks";
            case "microsoft_planner_task_get": return "relay_microsoft_planner_get_task";
            case "microsoft_planner_plan_get": return "relay_microsoft_planner_get_plan";
            case "microsoft_planner_plan_tasks_list": return "relay_microsoft_planner_list_plan_tasks";
            default: break
            }
        }
        if appSlug == "microsoft-to-do" {
            switch definition.actionKey {
            case "microsoft_todo_task_lists_list": return "relay_microsoft_todo_list_task_lists";
            case "microsoft_todo_task_list_get": return "relay_microsoft_todo_get_task_list";
            case "microsoft_todo_tasks_list": return "relay_microsoft_todo_list_tasks";
            case "microsoft_todo_task_get": return "relay_microsoft_todo_get_task";
            default: break
            }
        }
        if appSlug == "microsoft-lists" {
            switch definition.actionKey {
            case "microsoft_lists_list_get": return "relay_microsoft_lists_get_list";
            case "microsoft_lists_columns_list": return "relay_microsoft_lists_list_columns";
            case "microsoft_lists_items_list": return "relay_microsoft_lists_list_items";
            case "microsoft_lists_item_get": return "relay_microsoft_lists_get_item";
            default: break
            }
        }
        if appSlug == "onenote" {
            switch definition.actionKey {
            case "onenote_notebooks_list": return "relay_onenote_list_notebooks";
            case "onenote_notebook_sections_list": return "relay_onenote_list_sections";
            case "onenote_section_pages_list": return "relay_onenote_list_pages";
            case "onenote_page_get": return "relay_onenote_get_page_metadata";
            default: break
            }
        }
        if appSlug == "microsoft-bookings" {
            switch definition.actionKey {
            case "microsoft_bookings_business_get": return "relay_microsoft_bookings_get_business";
            case "microsoft_bookings_services_list": return "relay_microsoft_bookings_list_services";
            case "microsoft_bookings_service_get": return "relay_microsoft_bookings_get_service";
            case "microsoft_bookings_calendar_view": return "relay_microsoft_bookings_calendar_view";
            default: break
            }
        }
        if appSlug == "microsoft-power-bi" {
            switch definition.actionKey {
            case "microsoft_power_bi_workspace_get": return "relay_microsoft_power_bi_get_workspace";
            case "microsoft_power_bi_reports_list": return "relay_microsoft_power_bi_list_reports";
            case "microsoft_power_bi_semantic_models_list": return "relay_microsoft_power_bi_list_semantic_models";
            case "microsoft_power_bi_semantic_model_get": return "relay_microsoft_power_bi_get_semantic_model";
            default: break
            }
        }
        if appSlug == "microsoft-dynamics-365" {
            switch definition.actionKey {
            case "microsoft_dynamics_365_organization_get": return "relay_microsoft_dynamics_365_get_organization";
            case "microsoft_dynamics_365_accounts_list": return "relay_microsoft_dynamics_365_list_accounts";
            case "microsoft_dynamics_365_account_get": return "relay_microsoft_dynamics_365_get_account";
            case "microsoft_dynamics_365_opportunities_list": return "relay_microsoft_dynamics_365_list_opportunities";
            default: break
            }
        }
        if appSlug == "microsoft-viva-engage" {
            switch definition.actionKey {
            case "microsoft_viva_engage_network_get": return "relay_microsoft_viva_engage_get_network";
            case "microsoft_viva_engage_current_user_get": return "relay_microsoft_viva_engage_get_current_user";
            case "microsoft_viva_engage_my_communities_list": return "relay_microsoft_viva_engage_list_my_communities";
            case "microsoft_viva_engage_selected_community_messages_list": return "relay_microsoft_viva_engage_list_selected_community_messages";
            default: break
            }
        }
        if appSlug == "zoom" {
            switch definition.actionKey {
            case "zoom_scheduled_meetings_list": return "relay_zoom_list_scheduled_meetings";
            case "zoom_live_meetings_list": return "relay_zoom_list_live_meetings";
            case "zoom_upcoming_meetings_list": return "relay_zoom_list_upcoming_meetings";
            case "zoom_meeting_get": return "relay_zoom_get_meeting";
            default: break
            }
        }
        if appSlug == "discord" {
            switch definition.actionKey {
            case "discord_bot_get": return "relay_discord_get_bot";
            case "discord_selected_guild_get": return "relay_discord_get_selected_guild";
            case "discord_selected_guild_channels_list": return "relay_discord_list_selected_guild_channels";
            case "discord_selected_channel_messages_list": return "relay_discord_list_selected_channel_messages";
            default: break
            }
        }
        if appSlug == "linkedin" { switch definition.actionKey { case "linkedin_profile_get": return "relay_linkedin_get_profile"; case "linkedin_post_draft": return "relay_linkedin_draft_text_post"; case "linkedin_text_post_create": return "relay_linkedin_publish_text_post"; default: break } }
        if appSlug == "x" {
            switch definition.actionKey {
            case "x_account_get": return "relay_x_get_account";
            case "x_own_posts_list": return "relay_x_list_own_posts";
            case "x_post_draft": return "relay_x_draft_text_post";
            case "x_text_post_create": return "relay_x_publish_text_post";
            default: break
            }
        }
        if appSlug == "facebook-pages" {
            switch definition.actionKey {
            case "facebook_pages_page_get": return "relay_facebook_pages_get_page";
            case "facebook_pages_own_posts_list": return "relay_facebook_pages_list_own_posts";
            case "facebook_pages_post_draft": return "relay_facebook_pages_draft_post";
            case "facebook_pages_text_post_create": return "relay_facebook_pages_publish_text_post";
            default: break
            }
        }
        if appSlug == "instagram-business" {
            switch definition.actionKey {
            case "instagram_business_account_get": return "relay_instagram_business_get_account";
            case "instagram_business_own_media_list": return "relay_instagram_business_list_own_media";
            case "instagram_business_own_media_get": return "relay_instagram_business_get_own_media";
            default: break
            }
        }
        if appSlug == "threads" {
            switch definition.actionKey {
            case "threads_profile_get": return "relay_threads_get_profile";
            case "threads_own_posts_list": return "relay_threads_list_own_posts";
            case "threads_own_post_get": return "relay_threads_get_own_post";
            case "threads_text_post_draft": return "relay_threads_draft_text_post";
            case "threads_text_post_publish": return "relay_threads_publish_text_post";
            default: break
            }
        }
        if appSlug == "mastodon" {
            switch definition.actionKey {
            case "mastodon_account_get": return "relay_mastodon_get_account";
            case "mastodon_own_statuses_list": return "relay_mastodon_list_own_statuses";
            case "mastodon_text_status_draft": return "relay_mastodon_draft_text_status";
            case "mastodon_text_status_publish": return "relay_mastodon_publish_text_status";
            default: break
            }
        }
        if appSlug == "bluesky" {
            switch definition.actionKey {
            case "bluesky_profile_get": return "relay_bluesky_get_profile";
            case "bluesky_own_posts_list": return "relay_bluesky_list_own_posts";
            case "bluesky_text_post_draft": return "relay_bluesky_draft_text_post";
            case "bluesky_text_post_publish": return "relay_bluesky_publish_text_post";
            default: break
            }
        }
        if appSlug == "nextdoor" {
            switch definition.actionKey {
            case "nextdoor_profile_get": return "relay_nextdoor_get_profile";
            case "nextdoor_own_posts_list": return "relay_nextdoor_list_own_posts";
            case "nextdoor_text_post_draft": return "relay_nextdoor_draft_text_post";
            case "nextdoor_text_post_publish": return "relay_nextdoor_publish_text_post";
            default: break
            }
        }
        if appSlug == "meetup" { switch definition.actionKey { case "meetup_self_get": return "relay_meetup_get_self"; case "meetup_event_get": return "relay_meetup_get_event"; default: break } }
        if appSlug == "eventbrite" {
            switch definition.actionKey {
            case "eventbrite_user_get": return "relay_eventbrite_get_user";
            case "eventbrite_organizations_list": return "relay_eventbrite_list_organizations";
            case "eventbrite_organization_events_list": return "relay_eventbrite_list_organization_events";
            case "eventbrite_event_get": return "relay_eventbrite_get_event";
            default: break
            }
        }
        if appSlug == "luma" {
            switch definition.actionKey {
            case "luma_user_get": return "relay_luma_get_user";
            case "luma_calendar_get": return "relay_luma_get_calendar";
            case "luma_calendar_events_list": return "relay_luma_list_calendar_events";
            case "luma_event_get": return "relay_luma_get_event";
            default: break
            }
        }
        if appSlug == "hopin" {
            switch definition.actionKey {
            case "hopin_organization_get": return "relay_hopin_get_organization";
            case "hopin_organization_events_list": return "relay_hopin_list_organization_events";
            case "hopin_event_get": return "relay_hopin_get_event";
            case "hopin_event_schedule_items_list": return "relay_hopin_list_event_schedule_items";
            default: break
            }
        }
        if appSlug == "twist" {
            switch definition.actionKey {
            case "twist_user_get": return "relay_twist_get_user";
            case "twist_workspaces_list": return "relay_twist_list_workspaces";
            case "twist_channels_list": return "relay_twist_list_channels";
            case "twist_inbox_threads_list": return "relay_twist_list_inbox_threads";
            case "twist_thread_comments_get": return "relay_twist_get_thread_with_comments";
            default: break
            }
        }
        if appSlug == "zoho-mail" {
            switch definition.actionKey {
            case "zoho_mail_accounts_list": return "relay_zoho_mail_list_accounts";
            case "zoho_mail_folders_list": return "relay_zoho_mail_list_folders";
            case "zoho_mail_messages_list_filtered": return "relay_zoho_mail_list_messages_filtered";
            case "zoho_mail_message_get": return "relay_zoho_mail_get_message";
            default: break
            }
        }
        if appSlug == "webex" { switch definition.actionKey { case "webex_person_get": return "relay_webex_get_person"; case "webex_meetings_list": return "relay_webex_list_meetings"; case "webex_meeting_get": return "relay_webex_get_meeting"; default: break } }
        if appSlug == "goto-meeting" {
            switch definition.actionKey {
            case "goto_meeting_identity_get": return "relay_goto_meeting_get_identity";
            case "goto_meeting_upcoming_list": return "relay_goto_meeting_list_upcoming_meetings";
            case "goto_meeting_get": return "relay_goto_meeting_get_meeting";
            default: break
            }
        }
        if appSlug == "ringcentral" {
            switch definition.actionKey {
            case "ringcentral_extension_get": return "relay_ringcentral_get_extension";
            case "ringcentral_call_log_list": return "relay_ringcentral_list_call_log";
            case "ringcentral_call_log_get": return "relay_ringcentral_get_call_log_record";
            default: break
            }
        }
        if appSlug == "dialpad" { switch definition.actionKey { case "dialpad_user_get": return "relay_dialpad_get_user"; case "dialpad_caller_id_get": return "relay_dialpad_get_caller_id"; default: break } }
        if appSlug == "aircall" { switch definition.actionKey { case "aircall_company_get": return "relay_aircall_get_company"; case "aircall_numbers_list": return "relay_aircall_list_numbers"; default: break } }
        if appSlug == "openphone" { switch definition.actionKey { case "openphone_phone_numbers_list": return "relay_openphone_list_phone_numbers"; default: break } }
        if appSlug == "twilio" { switch definition.actionKey { case "twilio_messages_list": return "relay_twilio_list_message_statuses"; default: break } }
        if appSlug == "vonage" { switch definition.actionKey { case "vonage_account_balance_get": return "relay_vonage_get_account_balance"; default: break } }
        if appSlug == "messagebird" { switch definition.actionKey { case "messagebird_workspace_status_get": return "relay_messagebird_get_workspace_status"; default: break } }
        if appSlug == "fred" { switch definition.actionKey { case "fred_series_search": return "relay_fred_search_series"; case "fred_series_observations_get": return "relay_fred_get_series_observations"; default: break } }
        if appSlug == "apollo-graphql-studio" { switch definition.actionKey { case "apollo_graphos_graph_artifact_get": return "relay_apollo_graphos_get_graph_artifact"; case "apollo_graphos_launch_status_get": return "relay_apollo_graphos_get_launch_status"; default: break } }
        if appSlug == "hunter-io" {
            switch definition.actionKey {
            case "hunter_account_usage_get": return "relay_hunter_get_account_usage";
            case "hunter_domain_email_count_get": return "relay_hunter_get_domain_email_count";
            case "hunter_email_verify": return "relay_hunter_verify_email";
            default: break
            }
        }
        if appSlug == "snov-io" { switch definition.actionKey { case "snov_email_verification_start": return "relay_snov_start_email_verification"; case "snov_email_verification_result_get": return "relay_snov_get_email_verification_result"; default: break } }
        if appSlug == "lusha" { switch definition.actionKey { case "lusha_account_usage_get": return "relay_lusha_get_account_usage"; default: break } }
        if appSlug == "leadiq" { switch definition.actionKey { case "leadiq_account_usage_get": return "relay_leadiq_get_account_usage"; default: break } }
        if appSlug == "seamless-ai" { switch definition.actionKey { case "seamless_company_search": return "relay_seamless_search_companies"; default: break } }
        if appSlug == "rocketreach" { switch definition.actionKey { case "rocketreach_account_usage_get": return "relay_rocketreach_get_account_usage"; default: break } }
        if appSlug == "uplead" { switch definition.actionKey { case "uplead_credit_balance_get": return "relay_uplead_get_credit_balance"; default: break } }
        if appSlug == "wiza" { switch definition.actionKey { case "wiza_credit_balances_get": return "relay_wiza_get_credit_balances"; default: break } }
        if appSlug == "line" { switch definition.actionKey { case "line_profile_get": return "relay_line_get_profile"; default: break } }
        if appSlug == "pinterest" {
            switch definition.actionKey {
            case "pinterest_user_account_get": return "relay_pinterest_get_user_account";
            case "pinterest_public_boards_list": return "relay_pinterest_list_public_boards";
            case "pinterest_public_pins_list": return "relay_pinterest_list_public_pins";
            case "pinterest_public_pin_get": return "relay_pinterest_get_public_pin";
            default: break
            }
        }
        if appSlug == "tumblr" {
            switch definition.actionKey {
            case "tumblr_account_get": return "relay_tumblr_get_account";
            case "tumblr_owned_blog_get": return "relay_tumblr_get_owned_blog";
            case "tumblr_owned_blog_recent_posts_list": return "relay_tumblr_list_owned_blog_recent_posts";
            default: break
            }
        }
        return [
            "relay",
            "provider",
            safeIdentifierComponent(appSlug),
            safeIdentifierComponent(definition.kind.rawValue),
            wrapperToolSuffix(definition: definition)
        ].joined(separator: "_")
    }

    public static func wrapperToolSuffix(definition: MarketplaceProviderActionDefinition) -> String {
        stableSuffix("\(definition.id)|\(definition.actionKey)")
    }

    private func requireReadAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin, .member, .operator, .approver], context: context) {
            throw denied
        }
    }

    public static func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        let hex = String(hash, radix: 16)
        return String(hex.suffix(8))
    }

    public static func safeIdentifierComponent(_ value: String) -> String {
        let allowed = Set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_")
        let mapped = value.replacingOccurrences(of: "-", with: "_").map { allowed.contains($0) ? $0 : "_" }
        let normalized = String(mapped)
            .trimmingCharacters(in: CharacterSet(charactersIn: "_"))
            .lowercased()
        return normalized.isEmpty ? "provider" : normalized
    }
}
