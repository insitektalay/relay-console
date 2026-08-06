import Foundation

public struct MarketplaceRuntimeToolExecutionContext: Codable, Equatable, Sendable {
    public var agentId: RelayId
    public var workspaceId: RelayId
    public var runtimeType: RuntimeType?
    public var dispatchId: RelayId?
    public var threadId: RelayId?
    public var runtimeSessionId: RelayId?
    public var actorId: RelayId
    public var correlationId: RelayId?

    public init(
        agentId: RelayId,
        workspaceId: RelayId,
        runtimeType: RuntimeType? = nil,
        dispatchId: RelayId? = nil,
        threadId: RelayId? = nil,
        runtimeSessionId: RelayId? = nil,
        actorId: RelayId = "relay-runtime-tool",
        correlationId: RelayId? = nil
    ) {
        self.agentId = agentId
        self.workspaceId = workspaceId
        self.runtimeType = runtimeType
        self.dispatchId = dispatchId
        self.threadId = threadId
        self.runtimeSessionId = runtimeSessionId
        self.actorId = actorId
        self.correlationId = correlationId
    }
}

public final class MarketplaceRuntimeToolBridgeService {
    public typealias TeamMessagePublisher = (
        _ dispatchId: RelayId,
        _ payload: JSONRecord,
        _ runtime: MarketplaceRuntimeToolExecutionContext
    ) throws -> JSONRecord

    private let data: LocalDataService
    private let runtimeMounts: MarketplaceRuntimeMountService
    private let broker: MarketplaceProviderActionBrokerService
    private let cloudProxy: CloudMarketplaceRuntimeToolProxy?
    private let openExternal: (String) -> Void
    private var teamMessagePublisher: TeamMessagePublisher?

    public init(
        data: LocalDataService,
        runtimeMounts: MarketplaceRuntimeMountService,
        broker: MarketplaceProviderActionBrokerService,
        cloudProxy: CloudMarketplaceRuntimeToolProxy? = nil,
        openExternal: @escaping (String) -> Void = { _ in }
    ) {
        self.data = data
        self.runtimeMounts = runtimeMounts
        self.broker = broker
        self.cloudProxy = cloudProxy
        self.openExternal = openExternal
    }

    public func setTeamMessagePublisher(_ publisher: @escaping TeamMessagePublisher) {
        teamMessagePublisher = publisher
    }

    public func execute(
        toolName: String,
        payload: JSONRecord,
        runtime: MarketplaceRuntimeToolExecutionContext,
        now: Date = Date()
    ) throws -> JSONRecord {
        let context = ServiceRequestContext(
            actorId: runtime.actorId,
            workspaceId: runtime.workspaceId,
            roles: [.operator],
            correlationId: runtime.correlationId ?? runtime.dispatchId ?? "relay-runtime-tool"
        )
        let agent = try data.getAgent(runtime.agentId)
        guard agent.workspaceId == runtime.workspaceId else {
            throw ServiceGuard.invalidInput(context: context, message: "Runtime tool bridge agent workspace does not match the request context.")
        }
        if let runtimeType = runtime.runtimeType, agent.binding.runtimeType != runtimeType {
            throw ServiceGuard.invalidInput(context: context, message: "Runtime tool bridge agent runtime does not match the current capability snapshot.")
        }

        if toolName == "relay_publish_message" {
            guard let dispatchId = runtime.dispatchId,
                  let teamMessagePublisher
            else {
                throw ServiceGuard.invalidInput(
                    context: context,
                    message: "Relay team message publishing requires an authoritative local runtime dispatch."
                )
            }
            return try teamMessagePublisher(dispatchId, payload, runtime)
        }

        if isRelayConsoleResidentAgent(agent),
           toolName.hasPrefix("relay_console_") {
            return try executeResidentTool(
                toolName: toolName,
                payload: payload,
                context: context,
                agent: agent
            )
        }

        if let localDispatchId = runtime.dispatchId,
           cloudProxy?.hasTool(
               localDispatchId: localDispatchId,
               toolName: toolName,
               runtime: runtime
           ) == true {
            return try cloudProxy!.execute(
                localDispatchId: localDispatchId,
                toolName: toolName,
                payload: payload,
                runtime: runtime
            )
        }

        let snapshot = try runtimeMounts.snapshot(context: context, agent: agent, now: now)
        guard let match = try mountedTool(named: toolName, snapshot: snapshot, context: context) else {
            throw ServiceGuard.invalidInput(context: context, message: "Relay provider wrapper tool is not mounted for this agent.")
        }
        let payloadHash = MarketplaceProviderActionApprovalService.payloadHash(payload)
        let idempotencySeed = [
            runtime.dispatchId,
            runtime.runtimeSessionId,
            runtime.threadId,
            toolName,
            payloadHash
        ].compactMap { $0 }.joined(separator: "|")
        let idempotencyKey = "runtime-wrapper-\(RelayProviderWrapperToolCompilerService.stableSuffix(idempotencySeed))"

        let result = try broker.execute(
            context: context,
            request: MarketplaceProviderActionBrokerRequest(
                appIdOrSlug: match.app.appId,
                actionKey: match.definition.actionKey,
                payload: payload,
                connectionId: match.app.connectionId,
                installId: match.app.installId,
                agentId: runtime.agentId,
                idempotencyKey: idempotencyKey,
                dispatchId: runtime.dispatchId,
                threadId: runtime.threadId,
                source: "runtime-wrapper-tool",
                executionAuthority: match.tool.executionAuthority,
                executionAuthorityVersion: match.tool.executionAuthorityVersion
            ),
            now: now
        )
        return bridgeResult(
            toolName: toolName,
            app: match.app,
            tool: match.tool,
            definition: match.definition,
            brokerResult: result,
            payloadHash: payloadHash
        )
    }

    private func executeResidentTool(
        toolName: String,
        payload: JSONRecord,
        context: ServiceRequestContext,
        agent: AgentWithBinding
    ) throws -> JSONRecord {
        guard isRelayConsoleResidentAgent(agent) else {
            throw ServiceGuard.invalidInput(context: context, message: "Resident Relay Console tools are only mounted for the resident Relay Console agent.")
        }
        switch toolName {
        case "relay_console_google_docs_status":
            return try googleDocsStatus(context: context)
        case "relay_console_google_docs_open_setup":
            return googleDocsOpenSetup(payload: payload)
        case "relay_console_google_docs_oauth_authorization_url",
             "relay_console_google_docs_exchange_auth_code",
             "relay_console_google_docs_save_oauth_credentials":
            throw ServiceGuard.invalidInput(
                context: context,
                message: "Google Docs OAuth credentials and authorization codes are accepted only by the authenticated Railway broker."
            )
        default:
            throw ServiceGuard.invalidInput(context: context, message: "Unknown resident Relay Console tool.")
        }
    }

    private func googleDocsStatus(context: ServiceRequestContext) throws -> JSONRecord {
        guard let app = try data.getMarketplaceCatalogApp(workspaceId: context.workspaceId, appIdOrSlug: "google-docs") else {
            throw ServiceGuard.invalidInput(context: context, message: "Google Docs is not present in the application catalog.")
        }
        let connections = try data.listProviderConnections(workspaceId: context.workspaceId, appId: app.id)
        let connected = connections.first { $0.status == .connected }
        return [
            "ok": .bool(true),
            "toolName": .string("relay_console_google_docs_status"),
            "appSlug": .string("google-docs"),
            "appName": .string(app.name),
            "connectionState": .string(app.connectionState.rawValue),
            "connected": .bool(connected != nil),
            "connectionId": connected.map { .string($0.id) } ?? .null,
            "accountLabel": connected?.accountLabel.map(JSONValue.string) ?? .null,
            "primaryConnectionFlow": .string("applications-google-docs-connect-relay-owned-oauth"),
            "needsUserOwnedDeveloperCredentials": .bool(false),
            "manualFallbackSecretFields": .array([
                "google_docs_oauth_client_id",
                "google_docs_oauth_client_secret",
                "google_docs_oauth_refresh_token"
            ].map(JSONValue.string)),
            "optionalFields": .array([
                "google_docs_oauth_access_token",
                "google_cloud_project_id",
                "accountEmail",
                "displayName"
            ].map(JSONValue.string)),
            "setupUrls": .object(googleDocsSetupURLs()),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func googleDocsOpenSetup(payload: JSONRecord) -> JSONRecord {
        let urls = googleDocsSetupURLs()
        let requested = arrayStrings(payload["targets"]).isEmpty
            ? ["cloudConsole", "oauthCredentials", "oauthPlayground", "docsApi"]
            : arrayStrings(payload["targets"])
        let opened = requested.compactMap { key -> String? in
            guard let url = urls[key]?.string else { return nil }
            openExternal(url)
            return url
        }
        return [
            "ok": .bool(true),
            "toolName": .string("relay_console_google_docs_open_setup"),
            "openedUrls": .array(opened.map(JSONValue.string)),
            "setupUrls": .object(urls),
            "nextAction": .string("Use these Google pages only for manual fallback or troubleshooting. The primary path is Applications > Google Docs > Connect, which uses Relay-owned OAuth and stores the grant securely."),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func googleDocsSetupURLs() -> JSONRecord {
        [
            "cloudConsole": .string("https://console.cloud.google.com/"),
            "oauthCredentials": .string("https://console.cloud.google.com/apis/credentials"),
            "docsApi": .string("https://console.cloud.google.com/apis/library/docs.googleapis.com"),
            "oauthConsent": .string("https://console.cloud.google.com/apis/credentials/consent"),
            "oauthPlayground": .string("https://developers.google.com/oauthplayground/")
        ]
    }

    private func mountedTool(
        named toolName: String,
        snapshot: MarketplaceRuntimeCapabilitySnapshot,
        context: ServiceRequestContext
    ) throws -> (app: MarketplaceRuntimeMountedApp, tool: RelayProviderWrapperTool, definition: MarketplaceProviderActionDefinition)? {
        for app in snapshot.apps {
            guard let tool = app.tools.first(where: { $0.toolName == toolName }) else {
                continue
            }
            let definitions = try data.listMarketplaceProviderActionDefinitions(
                workspaceId: context.workspaceId,
                appId: app.appId,
                limit: 500
            )
            guard let definition = definitions.first(where: {
                RelayProviderWrapperToolCompilerService.wrapperToolName(appSlug: app.appSlug, definition: $0) == toolName
            }) else {
                throw ServiceGuard.invalidInput(context: context, message: "Relay provider wrapper tool has no provider action mapping.")
            }
            return (app, tool, definition)
        }
        return nil
    }

    private func bridgeResult(
        toolName: String,
        app: MarketplaceRuntimeMountedApp,
        tool: RelayProviderWrapperTool,
        definition: MarketplaceProviderActionDefinition,
        brokerResult: MarketplaceProviderActionBrokerResult,
        payloadHash: String
    ) -> JSONRecord {
        var record: JSONRecord = [
            "ok": .bool(brokerResult.execution.status == .succeeded || brokerResult.execution.status == .pendingApproval),
            "toolName": .string(toolName),
            "appId": .string(app.appId),
            "appSlug": .string(app.appSlug),
            "appName": .string(app.appName),
            "actionKey": .string(definition.actionKey),
            "actionKind": .string(definition.kind.rawValue),
            "permission": .string(brokerResult.execution.permission.rawValue),
            "executionMode": .string(tool.executionMode.rawValue),
            "executionId": .string(brokerResult.execution.id),
            "executionStatus": .string(brokerResult.execution.status.rawValue),
            "adapterExecuted": .bool(brokerResult.adapterExecuted),
            "requiresApproval": .bool(tool.requiresApproval),
            "payloadHash": .string(payloadHash),
            "rawProviderToolExposure": .bool(false),
            "redactionStatus": .string("private-state-excluded")
        ]
        if let providerResult = brokerResult.transientProviderResult ?? brokerResult.execution.providerResult {
            record["providerResult"] = .object(providerResult)
        }
        if let providerError = brokerResult.execution.providerError {
            record["providerError"] = .object(providerError)
        }
        if let approval = brokerResult.approval {
            record["approval"] = .object([
                "approvalId": .string(approval.id),
                "status": .string(approval.status.rawValue),
                "expiresAt": approval.expiresAt.map(JSONValue.string) ?? .null,
                "redactionStatus": .string("private-state-excluded")
            ])
        }
        return record
    }
}
