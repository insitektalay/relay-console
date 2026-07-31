import Foundation

extension ApplicationsService {
    static func app(
        fromCatalogRecord record: [String: Any],
        workspaceId: RelayId,
        timestamp: IsoTimestamp
    ) -> MarketplaceCatalogApp {
        let slug = (record["slug"] as? String) ?? "unknown-provider"
        // Railway's provider manifest is the catalogue source of truth. Start
        // from the generic data-backed representation and overlay the manifest
        // fields below instead of dispatching through the former 541-case
        // Swift fallback. Apart from duplicating Railway data, that dispatcher
        // produced an oversized stack frame on cooperative Swift tasks.
        var app = marketplaceGenericRailwayApp(
            workspaceId: workspaceId,
            slug: slug,
            timestamp: timestamp
        )
        let name = (record["name"] as? String) ?? app.name
        let sourceMetadata = record["sourceMetadata"] as? [String: Any]
        let authentication = (record["authentication"] as? [String: Any])
            ?? (sourceMetadata?["authentication"] as? [String: Any])
        let connection = record["connection"] as? [String: Any]
        let connectionTypes = (record["connectionTypes"] as? [String])
            ?? (connection?["types"] as? [String])
            ?? []
        let credentialRecords = (record["credentialRequirements"] as? [[String: Any]])
            ?? (connection?["credentialRequirements"] as? [[String: Any]])
            ?? []
        let provider = record["provider"] as? [String: Any]
        let providerSetup = record["providerSetup"] as? [String: Any]
        let capabilityRecords = record["capabilities"] as? [[String: Any]] ?? []
        let runtimeRecords = record["runtimeSupport"] as? [[String: Any]] ?? []
        let roleManifestRecord = record["roleManifest"] as? [String: Any]
        let roleRecords = roleManifestRecord?["roles"] as? [[String: Any]] ?? []
        let actions = record["actions"] as? [String: Any]
        let allowedActionRecords = actions?["allowed"] as? [[String: Any]] ?? []
        let approvalActionRecords = actions?["approvalRequired"] as? [[String: Any]] ?? []
        let blockedActionRecords = actions?["blocked"] as? [[String: Any]] ?? []
        let allowedActionIds = allowedActionRecords.compactMap { $0["id"] as? String }
        let approvalActionIds = approvalActionRecords.compactMap { $0["id"] as? String }
        let blockedActionIds = blockedActionRecords.compactMap { $0["id"] as? String }
        let release = record["release"] as? [String: Any]

        app.id = (record["id"] as? String) ?? "mapp-\(slug)"
        app.slug = slug
        app.name = name
        app.summary = (record["agentUseSummary"] as? String)
            ?? (record["summary"] as? String)
            ?? app.summary
        app.description = (record["description"] as? String) ?? app.description
        if let category = record["category"] as? String {
            app.category = category
                .split(separator: "_")
                .map { $0.prefix(1).uppercased() + $0.dropFirst() }
                .joined(separator: " ")
        }
        if let risk = MarketplaceRiskLevel(rawValue: (record["riskLevel"] as? String) ?? "") {
            app.riskLevel = risk
        }
        if let manifestAvailability = record["availability"] as? String {
            switch manifestAvailability {
            case "available", "awaiting_provider_setup", "beta_available",
                 "provider_setup_required":
                app.availability = .available
                app.availabilityReason = nil
            case "preview", "provider_review_pending", "product_decision_required",
                 "deferred":
                app.availability = .comingSoon
            case "unsupported", "unavailable":
                app.availability = .unavailable
                app.availabilityReason = (providerSetup?["blocker"] as? String)
                    ?? "The canonical provider manifest does not expose a supported connection."
                app.betaNotice = app.availabilityReason
                app.connectionState = .unavailable
                app.installState = .unavailable
            default:
                app.availability = .comingSoon
                app.availabilityReason = "The provider manifest publishes an unrecognized availability state."
            }
        }
        app.authType = (authentication?["model"] as? String) ?? app.authType
        app.connectionTypes = connectionTypes
        if !connectionTypes.isEmpty { app.connectionType = connectionTypes.joined(separator: ", ") }
        app.credentialRequirements = credentialRecords.compactMap { requirement in
            guard let name = (requirement["name"] as? String)
                    ?? (requirement["key"] as? String)
                    ?? (requirement["id"] as? String),
                  !name.isEmpty else { return nil }
            return MarketplaceCatalogCredentialRequirement(
                name: name,
                label: (requirement["label"] as? String) ?? name,
                required: (requirement["required"] as? Bool) ?? false,
                secret: (requirement["secret"] as? Bool) ?? true,
                helpText: (requirement["helpText"] as? String)
                    ?? (requirement["description"] as? String)
                    ?? "",
                requiredForAuthTypes: requirement["requiredForAuthTypes"] as? [String],
                inputType: requirement["inputType"] as? String,
                options: (requirement["options"] as? [[String: Any]])?.compactMap { option in
                    guard let value = option["value"] as? String, !value.isEmpty else {
                        return nil
                    }
                    return MarketplaceCatalogCredentialOption(
                        value: value,
                        label: (option["label"] as? String) ?? value
                    )
                },
                defaultValue: requirement["defaultValue"] as? String
            )
        }
        app.capabilities = capabilityRecords.compactMap {
            ($0["label"] as? String) ?? ($0["name"] as? String) ?? ($0["id"] as? String)
        }
        app.capabilityIds = capabilityRecords.compactMap {
            ($0["id"] as? String) ?? ($0["name"] as? String)
        }
        let runtimes = runtimeRecords.compactMap { record -> RuntimeType? in
            guard (record["installSupport"] as? String) != "unsupported" else { return nil }
            guard let format = record["format"] as? String else { return nil }
            return RuntimeType(rawValue: format)
        }
        if !runtimeRecords.isEmpty {
            app.runtimeSupport = Array(Set(runtimes)).sorted { $0.rawValue < $1.rawValue }
        }
        if !roleRecords.isEmpty {
            let roles = roleRecords.compactMap { role -> MarketplaceInstallRoleDefinition? in
                guard let roleId = (role["role"] as? String) ?? (role["id"] as? String),
                      !roleId.isEmpty else { return nil }
                let rawCanWrite = role["canWrite"]
                let canWrite = (rawCanWrite as? Bool)
                    ?? ((rawCanWrite as? String).map { !["false", "none", "never"].contains($0.lowercased()) })
                    ?? false
                return MarketplaceInstallRoleDefinition(
                    roleId: roleId,
                    label: (role["label"] as? String) ?? roleId,
                    purpose: (role["purpose"] as? String) ?? "Use \(name) as \(roleId).",
                    canWrite: canWrite,
                    readOnly: (role["readOnly"] as? Bool) ?? !canWrite,
                    approvalRequiredActions: role["approvalRequiredFor"] as? [String] ?? [],
                    blockedActions: role["blockedActions"] as? [String] ?? [],
                    required: (role["required"] as? Bool) ?? false,
                    installAfterSetup: (role["installAfterSetup"] as? Bool) ?? true,
                    installable: (role["installable"] as? Bool) ?? true,
                    notInstallableReason: role["notInstallableReason"] as? String,
                    recommendedAgentRole: (role["recommendedAgentType"] as? String)
                        ?? (role["recommendedAgentName"] as? String),
                    source: (role["source"] as? String) ?? "railway-catalog",
                    redactionStatus: "private-state-excluded"
                )
            }
            if !roles.isEmpty {
                let primaryRole = roles.first(where: \.required)?.roleId ?? roles[0].roleId
                app.roleManifest = MarketplaceRoleManifest(
                    primaryRole: primaryRole,
                    supportedRoles: roles.map(\.roleId),
                    compatibleRuntimeTypes: app.runtimeSupport,
                    approvalRequired: roles.contains { !$0.approvalRequiredActions.isEmpty },
                    roleDefinitions: roles,
                    redactionStatus: "private-state-excluded"
                )
                app.readOnly = roles.allSatisfy(\.readOnly)
            }
        } else if !allowedActionIds.isEmpty || !approvalActionIds.isEmpty {
            // Provider manifests classify the executable surface directly.
            // When no optional role declaration is present, derive one stable
            // install role from that classification instead of retaining the
            // generic client's invented permissions.
            let readOnly = !(allowedActionIds + approvalActionIds).contains(
                where: isMutatingManifestActionId)
            let roleId = readOnly ? "analyst" : "operator"
            let role = MarketplaceInstallRoleDefinition(
                roleId: roleId,
                label: readOnly ? "Analyst" : "Operator",
                purpose: readOnly
                    ? "Use the bounded read-only \(name) actions published by Railway."
                    : "Use the bounded \(name) actions published by Railway under approval policy.",
                canWrite: !readOnly,
                readOnly: readOnly,
                approvalRequiredActions: approvalActionIds,
                blockedActions: blockedActionIds,
                required: true,
                installAfterSetup: true,
                installable: !app.runtimeSupport.isEmpty,
                notInstallableReason: app.runtimeSupport.isEmpty
                    ? "No supported runtime format is published for this provider."
                    : nil,
                recommendedAgentRole: roleId,
                source: "canonical-provider-manifest",
                redactionStatus: "private-state-excluded"
            )
            app.roleManifest = MarketplaceRoleManifest(
                primaryRole: roleId,
                supportedRoles: [roleId],
                compatibleRuntimeTypes: app.runtimeSupport,
                approvalRequired: !approvalActionIds.isEmpty,
                roleDefinitions: [role],
                redactionStatus: "private-state-excluded"
            )
            app.readOnly = readOnly
        } else if app.availability == .unavailable {
            let reason = app.availabilityReason
                ?? "The canonical provider manifest does not expose a supported connection."
            let role = MarketplaceInstallRoleDefinition(
                roleId: "unavailable",
                label: "Unavailable",
                purpose: reason,
                canWrite: false,
                readOnly: true,
                approvalRequiredActions: [],
                blockedActions: blockedActionIds,
                required: true,
                installAfterSetup: false,
                installable: false,
                notInstallableReason: reason,
                recommendedAgentRole: nil,
                source: "canonical-provider-manifest",
                redactionStatus: "private-state-excluded"
            )
            app.roleManifest = MarketplaceRoleManifest(
                primaryRole: "unavailable",
                supportedRoles: ["unavailable"],
                compatibleRuntimeTypes: [],
                approvalRequired: false,
                roleDefinitions: [role],
                redactionStatus: "private-state-excluded"
            )
            app.readOnly = true
        }
        app.docsURL = (record["providerDocsUrl"] as? String)
            ?? (provider?["docsUrl"] as? String)
            ?? app.docsURL
        app.websiteURL = (record["providerWebsiteUrl"] as? String)
            ?? (provider?["websiteUrl"] as? String)
            ?? app.websiteURL
        app.accountCreationURL = (record["accountCreationUrl"] as? String)
            ?? (provider?["accountCreationUrl"] as? String)
            ?? app.accountCreationURL
        if let accessOptions = (record["oauthAccessOptions"] as? [[String: Any]])
            ?? (authentication?["accessOptions"] as? [[String: Any]])
        {
            app.oauthAccessOptions = accessOptions.compactMap { option in
                guard let id = option["id"] as? String,
                    let label = option["label"] as? String,
                    let description = option["description"] as? String,
                    let scopes = option["scopes"] as? [String],
                    let capabilityIds = option["capabilityIds"] as? [String]
                else { return nil }
                return MarketplaceOAuthAccessOption(
                    id: id,
                    label: label,
                    description: description,
                    scopes: scopes,
                    capabilityIds: capabilityIds,
                    defaultSelected: option["defaultSelected"] as? Bool ?? false
                )
            }
        }
        if let connectEligible = release?["connectEligible"] as? Bool {
            app.availability = connectEligible ? .available : .comingSoon
            app.availabilityReason = release?["reason"] as? String
            app.betaNotice = release?["label"] as? String
        }
        app.iconFallback = iconFallback(slug: slug, name: name)
        return app
    }

    private static func isMutatingManifestActionId(_ actionId: String) -> Bool {
        actionId.range(
            of: #"(^|_)(create|update|delete|publish|send|post|comment|reply|append|upload|mutate|manage|set|patch|execute|trigger|cancel|archive|restore|assign|invite|approve|reject|start|stop|rotate|install|disconnect)(_|$)"#,
            options: .regularExpression
        ) != nil
    }
}
