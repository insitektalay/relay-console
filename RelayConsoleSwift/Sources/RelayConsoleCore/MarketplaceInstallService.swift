import Foundation

public final class MarketplaceInstallService {
    public static let dangerouslySkipPermissionsPolicyId = "dangerously_skip_permissions"
    public static let dangerousPolicyAcknowledgementVersion = "relay-marketplace-dangerous-policy-v1"
    public static let dangerousPolicyPreservedInvariants = [
        "workspace_and_connection_ownership",
        "provider_authentication_and_granted_authority",
        "selected_capabilities_and_blocked_actions",
        "fixed_provider_origins_and_request_bounds",
        "provider_and_relay_rate_limits",
        "audit_evidence_and_truthful_results",
        "secret_non_exposure"
    ]
    private let data: LocalDataService
    private let secrets: SecretService
    private let providerActionPolicies: MarketplaceProviderActionPolicyCompilerService?

    public init(
        data: LocalDataService,
        secrets: SecretService,
        providerActionPolicies: MarketplaceProviderActionPolicyCompilerService? = nil
    ) {
        self.data = data
        self.secrets = secrets
        self.providerActionPolicies = providerActionPolicies
    }

    public func snapshot(
        context: ServiceRequestContext,
        appIdOrSlug: RelayId? = nil,
        selectedInstallId: RelayId? = nil,
        now: Date = Date()
    ) throws -> MarketplaceInstallSnapshot {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin, .member], context: context) {
            throw denied
        }
        let app = try appIdOrSlug.flatMap {
            try requireInstallApp(context: context, appIdOrSlug: $0, allowUnavailable: true)
        }
        let readOnly = !context.hasAnyRole([.owner, .admin])
        let installs = try data.listMarketplaceInstalls(workspaceId: context.workspaceId, appId: app?.id)
        let compatible = try app.map { try compatibleAgents(context: context, app: $0) } ?? []
        let selected = selectedInstallId.flatMap { id in
            installs.first { $0.id == id }
        } ?? installs.first { isActiveInstall($0) } ?? installs.first
        let state: MarketplaceInstallSnapshotState
        if let app, app.availability != .available {
            state = .unavailable
        } else if readOnly, (!installs.isEmpty || !compatible.isEmpty) {
            state = .readOnly
        } else if installs.isEmpty && compatible.isEmpty {
            state = .empty
        } else {
            state = .ready
        }
        let snapshot = MarketplaceInstallSnapshot(
            workspaceId: context.workspaceId,
            appId: app?.id,
            appSlug: app?.slug,
            state: state,
            refreshedAt: ISO8601DateFormatter.relayConsole.string(from: now),
            installs: installs,
            compatibleAgents: compatible,
            selectedInstall: selected,
            diagnostics: Self.diagnostics(app: app, installs: installs, compatibleAgents: compatible, state: state),
            readOnly: readOnly,
            redactionStatus: "private-state-excluded"
        )
        return try data.saveMarketplaceInstallSnapshot(snapshot)
    }

    public func latestSnapshot(context: ServiceRequestContext, appId: RelayId? = nil) throws -> MarketplaceInstallSnapshot? {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin, .member], context: context) {
            throw denied
        }
        return try data.latestMarketplaceInstallSnapshot(workspaceId: context.workspaceId, appId: appId)
    }

    @discardableResult
    public func repairRuntimeSkillFiles(
        context: ServiceRequestContext,
        installId: RelayId
    ) throws -> AgentWithBinding? {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        guard let install = try data.getMarketplaceInstall(workspaceId: context.workspaceId, installId: installId),
              isActiveInstall(install)
        else {
            return nil
        }
        let app = try requireInstallApp(context: context, appIdOrSlug: install.appId, allowUnavailable: true)
        guard app.slug == ExaSearchHermesRuntimeInstaller.appSlug || app.slug == XHermesRuntimeInstaller.appSlug else {
            return nil
        }
        let agent = try data.getAgent(install.agentId)
        let repaired: Bool
        if app.slug == ExaSearchHermesRuntimeInstaller.appSlug {
            switch agent.binding.runtimeType {
            case .hermes:
                repaired = try ExaSearchHermesRuntimeInstaller.repairSkillFile(in: agent)
            case .openclaw:
                repaired = try ExaSearchOpenClawRuntimeInstaller.repairSkillFiles(in: agent)
            default:
                repaired = false
            }
        } else {
            switch agent.binding.runtimeType {
            case .hermes:
                repaired = try XHermesRuntimeInstaller.repairInstall(into: agent)
            case .openclaw:
                repaired = try XOpenClawRuntimeInstaller.repairInstall(into: agent)
            default:
                repaired = false
            }
        }
        return repaired ? agent : nil
    }

    @discardableResult
    public func createInstall(
        context: ServiceRequestContext,
        request: MarketplaceInstallRequest,
        now: Date = Date()
    ) throws -> MarketplaceInstallRecord {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        guard request.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace install workspace does not match the request context.")
        }
        let app = try requireInstallApp(context: context, appIdOrSlug: request.appId, allowUnavailable: false)
        guard app.id == request.appId, app.slug == request.appSlug else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace install request must target the selected app.")
        }
        let connection = try validateConnection(request.connectionId, app: app, context: context)
        let executionAuthority = try validateExecutionAuthority(
            request: request,
            connection: connection,
            app: app,
            context: context
        )
        let role = try roleDefinition(for: request.roleId, app: app, context: context)
        let capabilities = try normalizedCapabilities(request.selectedCapabilities, app: app, context: context)
        try requireDangerousPolicyAcknowledgement(
            approvalProfileId: request.approvalProfileId,
            acknowledged: request.acknowledgeDangerouslySkipPermissions == true,
            context: context
        )
        guard request.targetMode == .existingAgent else {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .featureUnavailable,
                message: "Activating a new Marketplace agent is unavailable until explicit provisioning evidence exists."
            )
        }
        if app.riskLevel == .high && !request.riskAcknowledged {
            throw ServiceGuard.decisionRequired(
                context: context,
                decisionId: "marketplace-install-risk-\(app.slug)",
                message: "High-risk Marketplace installs require explicit risk acknowledgement."
            )
        }
        let agent = try data.getAgent(request.targetAgentId)
        let target = try compatibleTarget(for: agent, app: app, roleId: role.roleId, context: context)
        guard target.status == .compatible else {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .runtimeUnavailable,
                message: target.unavailableReason ?? "Selected agent is not compatible with this Marketplace role."
            )
        }
        guard agent.binding.runtimeType == request.runtimeFormat else {
            throw ServiceGuard.invalidInput(context: context, message: "Install runtime format must match the selected agent runtime binding.")
        }

        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        try supersedeDuplicateActiveTargets(
            workspaceId: context.workspaceId,
            appId: app.id,
            agentId: agent.id,
            roleId: role.roleId,
            runtimeFormat: request.runtimeFormat,
            actorId: context.actorId,
            timestamp: timestamp
        )
        let runtimeWrite = try performRuntimeInstallIfNeeded(app: app, agent: agent, connection: connection)
        var policyMetadata: JSONRecord = [:]
        if request.approvalProfileId == Self.dangerouslySkipPermissionsPolicyId {
            policyMetadata = dangerousPolicyAcknowledgementMetadata(actorId: context.actorId, timestamp: timestamp)
        }
        let metadata = request.metadata.merging([
            "runtimeWriteDeferred": .bool(!runtimeWrite.performed),
            "runtimeWritePerformed": .bool(runtimeWrite.performed),
            "providerWriteDeferred": .bool(!runtimeWrite.performed),
            "toolAutoGrantCreated": .bool(false),
            "runtimeCleanupPerformed": .bool(false),
            "rolePurpose": .string(role.purpose),
            "roleSource": .string(role.source),
            "executionAuthority": .string(executionAuthority.rawValue),
            "executionAuthorityVersion": .string(MarketplaceExecutionAuthority.contractVersion),
            "source": .string("marketplace-install-service")
        ].merging(runtimeWrite.metadata) { _, new in new }.merging(policyMetadata) { _, new in new }) { _, new in new }
        let install = MarketplaceInstallRecord(
            id: createRelayId("minst"),
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            connectionId: request.connectionId,
            agentId: agent.id,
            agentName: agent.name,
            runtimeBindingId: agent.binding.id,
            harnessId: agent.harness.id,
            runtimeType: agent.binding.runtimeType,
            roleId: role.roleId,
            roleLabel: role.label,
            selectedCapabilities: capabilities,
            approvalProfileId: request.approvalProfileId,
            runtimeFormat: request.runtimeFormat,
            targetMode: request.targetMode,
            riskAcknowledged: request.riskAcknowledged,
            installStatus: .installed,
            driftStatus: .current,
            lastInstalledAt: timestamp,
            removedAt: nil,
            failureMessage: nil,
            metadata: metadata,
            createdByActorId: context.actorId,
            createdAt: timestamp,
            updatedAt: timestamp,
            executionAuthority: executionAuthority,
            executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
            redactionStatus: "private-state-excluded"
        )
        var saved = try data.saveMarketplaceInstall(install)
        if let hydrated = try hydrateProviderActionFrameworkIfNeeded(
            context: context,
            app: app,
            role: role,
            install: saved,
            now: now
        ) {
            saved = hydrated
        }
        try synchronizeCatalogInstallState(workspaceId: context.workspaceId, app: app)
        return saved
    }

    private func validateExecutionAuthority(
        request: MarketplaceInstallRequest,
        connection: MarketplaceProviderConnection,
        app: MarketplaceCatalogApp,
        context: ServiceRequestContext
    ) throws -> MarketplaceExecutionAuthority {
        guard let connectionAuthority = connection.resolvedExecutionAuthority else {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .featureUnavailable,
                message: "Marketplace connection execution authority is missing or incompatible. Reconnect before installing."
            )
        }
        let expected = MarketplaceExecutionAuthority.currentSwiftAdapterAuthority(for: app.slug)
        guard connectionAuthority == expected else {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .featureUnavailable,
                message: "Marketplace connection belongs to a different execution broker and cannot be installed through this Swift adapter."
            )
        }
        if request.executionAuthority != nil || request.executionAuthorityVersion != nil {
            guard request.resolvedExecutionAuthority == connectionAuthority else {
                throw ServiceGuard.invalidInput(
                    context: context,
                    message: "Marketplace install request execution authority does not match its connection."
                )
            }
        }
        return connectionAuthority
    }

    @discardableResult
    public func updateInstall(
        context: ServiceRequestContext,
        installId: RelayId,
        selectedCapabilities: [String]? = nil,
        approvalProfileId: RelayId? = nil,
        acknowledgeDangerouslySkipPermissions: Bool = false,
        driftStatus: MarketplaceInstallDriftStatus? = nil,
        now: Date = Date()
    ) throws -> MarketplaceInstallRecord {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        guard var install = try data.getMarketplaceInstall(workspaceId: context.workspaceId, installId: installId) else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace install record was not found.")
        }
        let app = try requireInstallApp(context: context, appIdOrSlug: install.appId, allowUnavailable: true)
        if let selectedCapabilities {
            install.selectedCapabilities = try normalizedCapabilities(selectedCapabilities, app: app, context: context)
        }
        if let approvalProfileId {
            try requireDangerousPolicyAcknowledgement(
                approvalProfileId: approvalProfileId,
                acknowledged: acknowledgeDangerouslySkipPermissions,
                context: context
            )
            install.approvalProfileId = approvalProfileId
            if approvalProfileId == Self.dangerouslySkipPermissionsPolicyId {
                install.metadata.merge(
                    dangerousPolicyAcknowledgementMetadata(
                        actorId: context.actorId,
                        timestamp: ISO8601DateFormatter.relayConsole.string(from: now)
                    )
                ) { _, new in new }
            }
        }
        if let driftStatus {
            install.driftStatus = driftStatus
        }
        install.updatedAt = ISO8601DateFormatter.relayConsole.string(from: now)
        install.metadata["policyUpdated"] = .bool(approvalProfileId != nil)
        install.metadata["capabilitiesUpdated"] = .bool(selectedCapabilities != nil)
        var saved = try data.saveMarketplaceInstall(install)
        if let role = try? roleDefinition(for: saved.roleId, app: app, context: context),
           let hydrated = try hydrateProviderActionFrameworkIfNeeded(
                context: context,
                app: app,
                role: role,
                install: saved,
                now: now
           ) {
            saved = hydrated
        }
        try synchronizeCatalogInstallState(workspaceId: context.workspaceId, app: app)
        return saved
    }

    private func requireDangerousPolicyAcknowledgement(
        approvalProfileId: RelayId?,
        acknowledged: Bool,
        context: ServiceRequestContext
    ) throws {
        guard approvalProfileId == Self.dangerouslySkipPermissionsPolicyId else { return }
        guard acknowledged else {
            throw ServiceGuard.decisionRequired(
                context: context,
                decisionId: "marketplace-dangerous-policy-acknowledgement",
                message:
                    """
                        Dangerously skip permissions is an advanced policy that removes Relay per-action approval. Explicitly acknowledge the warning before activating it; workspace and connection ownership, provider-granted authority, selected \
                        capabilities, blocked actions, request bounds, rate limits, audit evidence, and secret non-exposure still apply.
                        """
            )
        }
    }

    private func dangerousPolicyAcknowledgementMetadata(
        actorId: RelayId,
        timestamp: IsoTimestamp
    ) -> JSONRecord {
        [
            "dangerousPolicyAcknowledged": .bool(true),
            "dangerousPolicyAcknowledgedAt": .string(timestamp),
            "dangerousPolicyAcknowledgedByActorId": .string(actorId),
            "dangerousPolicyAcknowledgementVersion": .string(Self.dangerousPolicyAcknowledgementVersion),
            "dangerousPolicyPreservedInvariants": .array(Self.dangerousPolicyPreservedInvariants.map(JSONValue.string))
        ]
    }

    @discardableResult
    public func removeInstall(
        context: ServiceRequestContext,
        installId: RelayId,
        now: Date = Date()
    ) throws -> MarketplaceInstallRecord {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin], context: context) {
            throw denied
        }
        guard var install = try data.getMarketplaceInstall(workspaceId: context.workspaceId, installId: installId) else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace install record was not found.")
        }
        let app = try requireInstallApp(context: context, appIdOrSlug: install.appId, allowUnavailable: true)
        let runtimeCleanup = try performRuntimeCleanupIfNeeded(app: app, install: install)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        install.installStatus = .removed
        install.driftStatus = .unconfigured
        install.removedAt = timestamp
        install.updatedAt = timestamp
        install.metadata["removeAsUnconfigured"] = .bool(true)
        install.metadata["runtimeCleanupPerformed"] = .bool(runtimeCleanup.performed)
        install.metadata["runtimeCleanupRemovedPaths"] = .array(runtimeCleanup.removedPaths.map(JSONValue.string))
        install.metadata["runtimeCleanupEnvPaths"] = .array(runtimeCleanup.envPaths.map(JSONValue.string))
        install.metadata["credentialsPreserved"] = .bool(true)
        install.metadata["removedByActorId"] = .string(context.actorId)
        let saved = try data.saveMarketplaceInstall(install)
        try synchronizeCatalogInstallState(workspaceId: context.workspaceId, app: app)
        return saved
    }

    public static func roleDefinitions(for app: MarketplaceCatalogApp) -> [MarketplaceInstallRoleDefinition] {
        if let definitions = app.roleManifest.roleDefinitions, !definitions.isEmpty {
            return definitions
        }
        return app.roleManifest.supportedRoles.map { roleId in
            let isPrimary = roleId == app.roleManifest.primaryRole
            return MarketplaceInstallRoleDefinition(
                roleId: roleId,
                label: roleId.split(separator: "_").map { $0.capitalized }.joined(separator: " "),
                purpose: isPrimary ? "Primary operator role for \(app.name)." : "Support role for \(app.name).",
                canWrite: isPrimary && app.roleManifest.approvalRequired,
                readOnly: !isPrimary,
                approvalRequiredActions: app.roleManifest.approvalRequired ? ["provider_write"] : [],
                blockedActions: ["local_file_write", "host_control", "paperclip"],
                required: isPrimary,
                installAfterSetup: true,
                installable: true,
                notInstallableReason: nil,
                recommendedAgentRole: roleId,
                source: "catalog-role-manifest",
                redactionStatus: "private-state-excluded"
            )
        }
    }

    public static func installActionTitle(for app: MarketplaceCatalogApp, snapshot: MarketplaceInstallSnapshot?) -> String {
        guard app.availability == .available else { return "Unavailable" }
        if snapshot?.readOnly == true { return "View install" }
        if snapshot?.compatibleAgents.contains(where: { $0.status == .compatible }) != true {
            return "No compatible agent"
        }
        if app.riskLevel == .high {
            return "Acknowledge risk and install"
        }
        return "Install"
    }

    public static func installStatusTitle(for install: MarketplaceInstallRecord) -> String {
        switch install.installStatus {
        case .installed:
            return "Installed"
        case .requested:
            return "Requested"
        case .failed:
            return "Failed"
        case .removed:
            return "Removed as unconfigured"
        case .superseded:
            return "Superseded"
        case .unavailable:
            return "Unavailable"
        }
    }

    private func requireInstallApp(
        context: ServiceRequestContext,
        appIdOrSlug: RelayId,
        allowUnavailable: Bool
    ) throws -> MarketplaceCatalogApp {
        guard let app = try data.getMarketplaceCatalogApp(workspaceId: context.workspaceId, appIdOrSlug: appIdOrSlug) else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace app is required before install state can be saved.")
        }
        guard app.sourceType == .externalProvider, !app.localAppExcluded, !app.reviewExcluded else {
            throw ServiceGuard.invalidInput(context: context, message: "Local repo Marketplace installs are excluded unless explicitly reinstated.")
        }
        guard !app.slug.localizedCaseInsensitiveContains("paperclip") else {
            throw ServiceGuard.invalidInput(context: context, message: "Paperclip install state is excluded unless explicitly reinstated.")
        }
        if app.availability != .available, !allowUnavailable {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .featureUnavailable,
                message: app.availabilityReason ?? "This Marketplace app is unavailable for install."
            )
        }
        return app
    }

    private func validateConnection(_ connectionId: RelayId?, app: MarketplaceCatalogApp, context: ServiceRequestContext) throws -> MarketplaceProviderConnection {
        guard app.connectionState == .connected else {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .authRequired,
                message: "Connect \(app.name) before installing it to agents."
            )
        }
        guard let connectionId,
              let connection = try data.getProviderConnection(workspaceId: context.workspaceId, connectionId: connectionId),
              connection.appId == app.id,
              connection.appSlug == app.slug,
              Self.connectionIsUsable(connection)
        else {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .authRequired,
                message: "A connected provider connection is required before Marketplace install."
            )
        }
        return connection
    }

    private func performRuntimeInstallIfNeeded(
        app: MarketplaceCatalogApp,
        agent: AgentWithBinding,
        connection: MarketplaceProviderConnection
    ) throws -> (performed: Bool, metadata: JSONRecord) {
        if app.slug == XHermesRuntimeInstaller.appSlug {
            switch agent.binding.runtimeType {
            case .hermes:
                let result = try XHermesRuntimeInstaller.install(into: agent)
                var metadata: JSONRecord = [
                    "runtimeInstaller": .string("x-hermes-profile-wrapper"),
                    "skillRelativePath": .string(XHermesRuntimeInstaller.skillRelativePath),
                    "skillPath": .string(result.skillPath),
                    "credentialEnvWrite": .bool(false),
                    "secretSource": .string("provider-action-broker-keychain-reference"),
                    "providerActionFramework": .bool(true),
                    "approvalGate": .string("publishing-requires-explicit-approval")
                ]
                if let legacyEnvCleanupPath = result.legacyEnvCleanupPath {
                    metadata["legacyEnvCleanupPerformed"] = .bool(true)
                    metadata["legacyEnvCleanupPaths"] = .array([.string(legacyEnvCleanupPath)])
                } else {
                    metadata["legacyEnvCleanupPerformed"] = .bool(false)
                    metadata["legacyEnvCleanupPaths"] = .array([])
                }
                return (true, metadata)
            case .openclaw:
                let result = try XOpenClawRuntimeInstaller.install(into: agent)
                return (true, [
                    "runtimeInstaller": .string("x-openclaw-agent-wrapper"),
                    "skillRelativePath": .string(XOpenClawRuntimeInstaller.skillRelativePath),
                    "skillPath": .string(result.workspaceSkillPath),
                    "workspaceSkillPath": .string(result.workspaceSkillPath),
                    "agentSkillPath": .string(result.agentSkillPath),
                    "credentialEnvWrite": .bool(false),
                    "legacyEnvCleanupPerformed": .bool(!result.legacyEnvCleanupPaths.isEmpty),
                    "legacyEnvCleanupPaths": .array(result.legacyEnvCleanupPaths.map(JSONValue.string)),
                    "secretSource": .string("provider-action-broker-keychain-reference"),
                    "providerActionFramework": .bool(true),
                    "approvalGate": .string("publishing-requires-explicit-approval")
                ])
            default:
                throw RelayError(.invalidInput, "X can only be installed into Hermes or OpenClaw agents.")
            }
        }
        guard app.slug == ExaSearchHermesRuntimeInstaller.appSlug else {
            return (false, [:])
        }
        guard let secretId = connection.secretReferenceIds.first ?? connection.credentialRequirements.compactMap(\.secretReferenceId).first else {
            throw RelayError(.secretStoreUnavailable, "Exa Search connection is missing a Keychain secret reference.")
        }
        let apiKey = try secrets.getSecretValue(secretId)
        switch agent.binding.runtimeType {
        case .hermes:
            let result = try ExaSearchHermesRuntimeInstaller.install(apiKey: apiKey, into: agent)
            return (true, [
                "runtimeInstaller": .string("exa-search-hermes-profile-wrapper"),
                "skillRelativePath": .string(ExaSearchHermesRuntimeInstaller.skillRelativePath),
                "skillPath": .string(result.skillPath),
                "credentialEnvWrite": .bool(false),
                "legacyEnvCleanupPerformed": .bool(result.legacyEnvCleanupPath != nil),
                "legacyEnvCleanupPaths": .array(result.legacyEnvCleanupPath.map { [.string($0)] } ?? []),
                "secretSource": .string("provider-action-broker-keychain-reference"),
                "providerActionFramework": .bool(true)
            ])
        case .openclaw:
            let result = try ExaSearchOpenClawRuntimeInstaller.install(apiKey: apiKey, into: agent)
            return (true, [
                "runtimeInstaller": .string("exa-search-openclaw-agent-wrapper"),
                "skillRelativePath": .string(ExaSearchOpenClawRuntimeInstaller.skillRelativePath),
                "skillPath": .string(result.workspaceSkillPath),
                "workspaceSkillPath": .string(result.workspaceSkillPath),
                "agentSkillPath": .string(result.agentSkillPath),
                "credentialEnvWrite": .bool(false),
                "legacyEnvCleanupPerformed": .bool(!result.legacyEnvCleanupPaths.isEmpty),
                "legacyEnvCleanupPaths": .array(result.legacyEnvCleanupPaths.map(JSONValue.string)),
                "secretSource": .string("provider-action-broker-keychain-reference"),
                "providerActionFramework": .bool(true)
            ])
        default:
            throw RelayError(.invalidInput, "Exa Search can only be installed into Hermes or OpenClaw agents.")
        }
    }

    private func performRuntimeCleanupIfNeeded(
        app: MarketplaceCatalogApp,
        install: MarketplaceInstallRecord
    ) throws -> (performed: Bool, removedPaths: [String], envPaths: [String]) {
        if app.slug == XHermesRuntimeInstaller.appSlug {
            let agent = try data.getAgent(install.agentId)
            let result: XRuntimeRemovalResult
            switch agent.binding.runtimeType {
            case .hermes:
                result = try XHermesRuntimeInstaller.uninstall(from: agent)
            case .openclaw:
                result = try XOpenClawRuntimeInstaller.uninstall(from: agent)
            default:
                throw RelayError(.invalidInput, "X can only be removed from Hermes or OpenClaw agents.")
            }
            return (
                !result.removedPaths.isEmpty || !result.envPaths.isEmpty,
                result.removedPaths,
                result.envPaths
            )
        }
        guard app.slug == ExaSearchHermesRuntimeInstaller.appSlug else {
            return (false, [], [])
        }
        let agent = try data.getAgent(install.agentId)
        let result: ExaSearchRuntimeRemovalResult
        switch agent.binding.runtimeType {
        case .hermes:
            result = try ExaSearchHermesRuntimeInstaller.uninstall(from: agent)
        case .openclaw:
            result = try ExaSearchOpenClawRuntimeInstaller.uninstall(from: agent)
        default:
            throw RelayError(.invalidInput, "Exa Search can only be removed from Hermes or OpenClaw agents.")
        }
        return (
            !result.removedPaths.isEmpty || !result.envPaths.isEmpty,
            result.removedPaths,
            result.envPaths
        )
    }

    private func hydrateProviderActionFrameworkIfNeeded(
        context: ServiceRequestContext,
        app: MarketplaceCatalogApp,
        role: MarketplaceInstallRoleDefinition,
        install: MarketplaceInstallRecord,
        now: Date
    ) throws -> MarketplaceInstallRecord? {
        guard let providerActionPolicies,
              Self.supportsProviderActionFramework(app),
              isActiveInstall(install)
        else {
            return nil
        }
        let preset: MarketplaceActionPolicyPreset = role.readOnly ? .readOnly : .approvalRequired
        let permissionMap = try providerActionPolicies.compilePolicyMap(
            context: context,
            appIdOrSlug: app.id,
            preset: preset,
            connectionId: install.connectionId,
            installId: install.id,
            agentId: install.agentId,
            now: now
        )
        var updated = install
        updated.metadata["providerActionFrameworkHydrated"] = .bool(true)
        updated.metadata["providerActionPolicyMapId"] = .string(permissionMap.id)
        updated.metadata["providerActionPolicyPreset"] = .string(permissionMap.policyPreset.rawValue)
        updated.metadata["providerActionDefinitionCount"] = .number(Double(permissionMap.permissions.count))
        updated.metadata["providerActionFrameworkSource"] = .string("marketplace-install-migration")
        updated.updatedAt = permissionMap.updatedAt
        return try data.saveMarketplaceInstall(updated)
    }

    private static func supportsProviderActionFramework(_ app: MarketplaceCatalogApp) -> Bool {
        [
            "x", "linkedin", "exa-search", "gmail", "google-docs", "google-search-console", "google-merchant-center", "youtube", "google-classroom", "outlook", "microsoft-teams", "onedrive", "sharepoint", "microsoft-planner", "microsoft-to-do", "microsoft-lists", "onenote", "microsoft-bookings",
            "microsoft-power-bi", "microsoft-dynamics-365", "microsoft-viva-engage", "zoom", "discord", "posthog", "datadog", "pagerduty", "cloudflare", "vercel", "heroku", "digitalocean", "telemetrydeck",
        ].contains(app.slug)
    }

    private func roleDefinition(for roleId: String, app: MarketplaceCatalogApp, context: ServiceRequestContext) throws -> MarketplaceInstallRoleDefinition {
        guard let role = Self.roleDefinitions(for: app).first(where: { $0.roleId == roleId }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace role is not defined for this app.")
        }
        guard role.installable else {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .capabilityMissing,
                message: role.notInstallableReason ?? "Marketplace role is not installable."
            )
        }
        return role
    }

    private func normalizedCapabilities(_ requested: [String], app: MarketplaceCatalogApp, context: ServiceRequestContext) throws -> [String] {
        var seen = Set<String>()
        let selected = (requested.isEmpty ? app.capabilities : requested).filter { seen.insert($0).inserted }
        let unsupported = selected.filter { !app.capabilities.contains($0) }
        guard unsupported.isEmpty else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace install selected unsupported capabilities.")
        }
        return selected
    }

    private func compatibleAgents(context: ServiceRequestContext, app: MarketplaceCatalogApp) throws -> [MarketplaceCompatibleAgentTarget] {
        let installs = try data.listMarketplaceInstalls(workspaceId: context.workspaceId, appId: app.id)
        return try data.listAgents(workspaceId: context.workspaceId).map { agent in
            try compatibleTarget(for: agent, app: app, roleId: app.roleManifest.primaryRole, existingInstalls: installs, context: context)
        }
    }

    private func compatibleTarget(
        for agent: AgentWithBinding,
        app: MarketplaceCatalogApp,
        roleId: String,
        existingInstalls: [MarketplaceInstallRecord]? = nil,
        context: ServiceRequestContext
    ) throws -> MarketplaceCompatibleAgentTarget {
        guard agent.workspaceId == context.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace install agent workspace does not match the request context.")
        }
        let supportedRoles = Self.roleDefinitions(for: app).filter(\.installable).map(\.roleId)
        let existing = existingInstalls?.first {
            $0.agentId == agent.id && $0.roleId == roleId && isActiveInstall($0)
        }
        let status: MarketplaceAgentCompatibilityStatus
        let reason: String?
        if agent.status != "active" {
            status = .inactiveAgent
            reason = "Agent is not active."
        } else if !app.runtimeSupport.contains(agent.binding.runtimeType)
                    || !app.roleManifest.compatibleRuntimeTypes.contains(agent.binding.runtimeType) {
            status = .runtimeUnsupported
            reason = "\(agent.binding.runtimeType.rawValue) is not supported by this Marketplace app."
        } else if !supportedRoles.contains(roleId) {
            status = .roleUnsupported
            reason = "Role \(roleId) is not installable for this app."
        } else {
            status = .compatible
            reason = nil
        }
        return MarketplaceCompatibleAgentTarget(
            agentId: agent.id,
            agentName: agent.name,
            agentRole: agent.role,
            runtimeBindingId: agent.binding.id,
            harnessId: agent.harness.id,
            runtimeType: agent.binding.runtimeType,
            status: status,
            supportedRoles: supportedRoles,
            unavailableReason: reason,
            existingInstallId: existing?.id,
            redactionStatus: "private-state-excluded"
        )
    }

    private func supersedeDuplicateActiveTargets(
        workspaceId: RelayId,
        appId: RelayId,
        agentId: RelayId,
        roleId: String,
        runtimeFormat: RuntimeType,
        actorId: RelayId,
        timestamp: IsoTimestamp
    ) throws {
        let existing = try data.listMarketplaceInstalls(workspaceId: workspaceId, appId: appId)
        for var install in existing where install.agentId == agentId
            && install.roleId == roleId
            && install.runtimeFormat == runtimeFormat
            && isActiveInstall(install) {
            install.installStatus = .superseded
            install.driftStatus = .superseded
            install.removedAt = timestamp
            install.updatedAt = timestamp
            install.metadata["duplicateSuperseded"] = .bool(true)
            install.metadata["supersededByActorId"] = .string(actorId)
            _ = try data.saveMarketplaceInstall(install)
        }
    }

    private func synchronizeCatalogInstallState(workspaceId: RelayId, app: MarketplaceCatalogApp) throws {
        let installs = try data.listMarketplaceInstalls(workspaceId: workspaceId, appId: app.id)
        let activeInstalls = installs.filter(isActiveInstall)
        var updated = app
        updated.installState = activeInstalls.isEmpty ? .notInstalled : .installed
        updated.installedAgentIds = Array(Set(activeInstalls.map(\.agentId))).sorted()
        updated.installedAgentCount = updated.installedAgentIds.count
        updated.updatedAt = nowIso()
        _ = try data.upsertMarketplaceCatalogApp(updated)
    }

    private static func diagnostics(
        app: MarketplaceCatalogApp?,
        installs: [MarketplaceInstallRecord],
        compatibleAgents: [MarketplaceCompatibleAgentTarget],
        state: MarketplaceInstallSnapshotState
    ) -> MarketplaceInstallDiagnostics {
        let active = installs.filter(isActiveInstall)
        let removed = installs.filter { $0.installStatus == .removed }
        let drifted = installs.filter { [.refreshNeeded, .unconfigured, .superseded].contains($0.driftStatus) }
        let compatible = compatibleAgents.filter { $0.status == .compatible }
        let message: String
        switch state {
        case .empty:
            message = app == nil ? "No Marketplace app selected" : "No Marketplace install records"
        case .readOnly:
            message = "Read-only Marketplace install summary"
        case .unavailable:
            message = app?.availabilityReason ?? "Marketplace install is unavailable for this app."
        case .ready:
            message = active.contains { $0.metadata["runtimeWritePerformed"] == .bool(true) }
                ? "Marketplace install records include local runtime writes where supported."
                : "Marketplace install records target real local agents and defer runtime writes."
        case .loading:
            message = "Loading Marketplace installs"
        case .error:
            message = "Marketplace install state could not be loaded."
        }
        return MarketplaceInstallDiagnostics(
            compatibleAgentSummary: "\(compatible.count) compatible / \(compatibleAgents.count) retained agents",
            installSummary: "\(active.count) active / \(installs.count) retained installs",
            driftSummary: "\(drifted.count) drift or unconfigured record\(drifted.count == 1 ? "" : "s")",
            runtimeWriteSummary: active.contains { $0.metadata["runtimeWritePerformed"] == .bool(true) }
                ? "Runtime writes performed for supported Marketplace apps."
                : "Runtime writes deferred until safety cards authorize them.",
            removalSummary: "\(removed.count) remove-as-unconfigured record\(removed.count == 1 ? "" : "s")",
            message: message
        )
    }

    private static func connectionIsUsable(_ connection: MarketplaceProviderConnection) -> Bool {
        switch connection.status {
        case .connected, .healthError, .senderInvalid, .expired, .reauthorizeRequired:
            return true
        case .disconnected, .authRequired, .validating, .disconnecting, .unavailable:
            return false
        }
    }
}

private func isActiveInstall(_ install: MarketplaceInstallRecord) -> Bool {
    install.installStatus == .installed || install.installStatus == .requested
}
