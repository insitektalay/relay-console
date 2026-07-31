import Foundation

extension MarketplaceRuntimeCapabilitySnapshot {
    func mergingCloudMarketplaceTools(_ descriptors: [JSONRecord]) -> MarketplaceRuntimeCapabilitySnapshot {
        let grouped = Dictionary(grouping: descriptors) {
            $0["appSlug"]?.string ?? $0["provider"]?.string ?? "marketplace"
        }
        guard !grouped.isEmpty else { return self }

        let cloudApps = grouped.keys.sorted().compactMap { slug -> MarketplaceRuntimeMountedApp? in
            guard let descriptors = grouped[slug] else { return nil }
            let tools = descriptors.compactMap {
                Self.cloudTool(
                    descriptor: $0,
                    slug: slug,
                    workspaceId: workspaceId,
                    agentId: agentId
                )
            }
            guard !tools.isEmpty else { return nil }
            let approvalCount = tools.filter(\.requiresApproval).count
            let connectionId = descriptors.compactMap { $0["connectionId"]?.string }.first
            return MarketplaceRuntimeMountedApp(
                appId: "railway:\(slug)",
                appSlug: slug,
                appName: Self.cloudAppName(slug),
                installId: "railway-install:\(slug):\(agentId)",
                connectionId: connectionId,
                permissionMapId: nil,
                policyPreset: approvalCount > 0 ? .approvalRequired : .allowDirectWrites,
                connected: true,
                assignedAgentReady: true,
                instructions: "Use the Railway-brokered \(Self.cloudAppName(slug)) tools. Credentials remain on Railway.",
                tools: tools.sorted { $0.toolName < $1.toolName },
                diagnostics: RelayProviderWrapperToolDiagnostics(
                    availableToolCount: tools.count,
                    approvalRequiredCount: approvalCount,
                    autoExecuteCount: 0,
                    blockedActionCount: 0,
                    unavailableActionCount: 0,
                    suppressedRawProviderToolCount: 0,
                    connected: true,
                    assignedAgentReady: true,
                    rawProviderToolExposure: false,
                    executionAuthority: .railway,
                    executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
                    authorityReady: true,
                    message: "\(tools.count) Railway-brokered tool(s) mounted.",
                    redactionStatus: "credentials-excluded"
                ),
                redactionStatus: "credentials-excluded"
            )
        }

        let cloudSlugs = Set(cloudApps.map(\.appSlug))
        let mergedApps = apps.filter { !cloudSlugs.contains($0.appSlug) } + cloudApps
        var merged = self
        merged.apps = mergedApps.sorted { $0.appSlug < $1.appSlug }
        merged.toolCount = mergedApps.reduce(0) { $0 + $1.tools.count }
        let signature = descriptors
            .compactMap { $0["functionName"]?.string ?? $0["name"]?.string }
            .sorted()
            .joined(separator: "|")
        merged.fingerprint = "cloud-\(RelayProviderWrapperToolCompilerService.stableSuffix("\(fingerprint)|\(signature)"))"
        return merged
    }

    private static func cloudTool(
        descriptor: JSONRecord,
        slug: String,
        workspaceId: String,
        agentId: String
    ) -> RelayProviderWrapperTool? {
        guard let toolName = descriptor["functionName"]?.string ?? descriptor["name"]?.string,
              !toolName.isEmpty,
              case .object(let execution)? = descriptor["execution"],
              execution["transport"]?.string == "clawchat_bridge_marketplace_tool",
              execution["requiresBridgeAccessToken"]?.bool == true
        else {
            return nil
        }
        let action = descriptor["action"]?.string ?? "read"
        let requiresApproval = descriptor["approvalRequired"]?.bool == true
        let readOnly = action == "read"
        let inputSchema: JSONRecord
        if case .object(let schema)? = descriptor["inputSchema"] {
            inputSchema = schema
        } else {
            inputSchema = [
                "type": .string("object"),
                "properties": .object([:]),
                "additionalProperties": .bool(false),
            ]
        }
        return RelayProviderWrapperTool(
            id: "railway-tool:\(slug):\(toolName)",
            workspaceId: workspaceId,
            appId: "railway:\(slug)",
            appSlug: slug,
            executionAuthority: .railway,
            executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
            installId: "railway-install:\(slug):\(agentId)",
            agentId: agentId,
            toolName: toolName,
            displayName: descriptor["name"]?.string ?? toolName,
            summary: descriptor["description"]?.string ?? "Railway-brokered Marketplace action.",
            kind: readOnly ? .read : .write,
            riskLevel: readOnly ? .low : .high,
            permission: requiresApproval ? .approvalRequired : .allowed,
            executionMode: requiresApproval ? .approvalRequired : .allowed,
            requiresApproval: requiresApproval,
            autoExecutes: false,
            readOnly: readOnly,
            inputSchema: inputSchema,
            resultSchema: [
                "type": .string("object"),
                "additionalProperties": .bool(true),
            ],
            metadata: [
                "source": .string("railway_marketplace_runtime"),
                "tokenExposure": .string("never_exposed_to_agent"),
            ],
            redactionStatus: "credentials-excluded"
        )
    }

    private static func cloudAppName(_ slug: String) -> String {
        slug.split(separator: "-")
            .map { part in
                let value = String(part)
                return value.prefix(1).uppercased() + value.dropFirst()
            }
            .joined(separator: " ")
    }
}
