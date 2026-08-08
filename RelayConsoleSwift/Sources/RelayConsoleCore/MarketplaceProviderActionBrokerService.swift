import Foundation

public struct MarketplaceProviderActionBrokerRequest: Codable, Equatable, Sendable {
    public var appIdOrSlug: RelayId
    public var actionKey: String
    public var payload: JSONRecord
    public var connectionId: RelayId?
    public var installId: RelayId?
    public var agentId: RelayId?
    public var approvalId: RelayId?
    public var idempotencyKey: String?
    public var dispatchId: RelayId?
    public var threadId: RelayId?
    public var source: String
    public var executionAuthority: MarketplaceExecutionAuthority?
    public var executionAuthorityVersion: String?

    public init(
        appIdOrSlug: RelayId,
        actionKey: String,
        payload: JSONRecord,
        connectionId: RelayId? = nil,
        installId: RelayId? = nil,
        agentId: RelayId? = nil,
        approvalId: RelayId? = nil,
        idempotencyKey: String? = nil,
        dispatchId: RelayId? = nil,
        threadId: RelayId? = nil,
        source: String = "provider-action-broker",
        executionAuthority: MarketplaceExecutionAuthority? = nil,
        executionAuthorityVersion: String? = nil
    ) {
        self.appIdOrSlug = appIdOrSlug
        self.actionKey = actionKey
        self.payload = payload
        self.connectionId = connectionId
        self.installId = installId
        self.agentId = agentId
        self.approvalId = approvalId
        self.idempotencyKey = idempotencyKey
        self.dispatchId = dispatchId
        self.threadId = threadId
        self.source = source
        self.executionAuthority = executionAuthority
        self.executionAuthorityVersion = executionAuthorityVersion
    }

    public var resolvedExecutionAuthority: MarketplaceExecutionAuthority? {
        guard executionAuthorityVersion == MarketplaceExecutionAuthority.contractVersion,
              let executionAuthority,
              executionAuthority != .unknown else { return nil }
        return executionAuthority
    }
}

public struct MarketplaceProviderActionBrokerResult: Codable, Equatable, Sendable {
    public var execution: MarketplaceProviderActionExecutionRecord
    public var approval: MarketplaceProviderActionApprovalRecord?
    public var permissionMap: MarketplaceActionPermissionMap?
    public var adapterExecuted: Bool
    public var auditEventId: RelayId?
    public var transientProviderResult: JSONRecord?
    public var redactionStatus: String

    public init(
        execution: MarketplaceProviderActionExecutionRecord,
        approval: MarketplaceProviderActionApprovalRecord? = nil,
        permissionMap: MarketplaceActionPermissionMap? = nil,
        adapterExecuted: Bool,
        auditEventId: RelayId? = nil,
        transientProviderResult: JSONRecord? = nil,
        redactionStatus: String = "private-state-excluded"
    ) {
        self.execution = execution
        self.approval = approval
        self.permissionMap = permissionMap
        self.adapterExecuted = adapterExecuted
        self.auditEventId = auditEventId
        self.transientProviderResult = transientProviderResult
        self.redactionStatus = redactionStatus
    }
}

public struct MarketplaceProviderActionAdapterRequest: Codable, Equatable, Sendable {
    public var context: ServiceRequestContext
    public var app: MarketplaceCatalogApp
    public var definition: MarketplaceProviderActionDefinition
    public var permission: ProviderActionPermission
    public var payload: JSONRecord
    public var approvalReference: ProviderActionApprovalReference?
    public var auditIdentity: ProviderExecutionAuditIdentity
    public var idempotencyKey: String

    public init(
        context: ServiceRequestContext,
        app: MarketplaceCatalogApp,
        definition: MarketplaceProviderActionDefinition,
        permission: ProviderActionPermission,
        payload: JSONRecord,
        approvalReference: ProviderActionApprovalReference?,
        auditIdentity: ProviderExecutionAuditIdentity,
        idempotencyKey: String
    ) {
        self.context = context
        self.app = app
        self.definition = definition
        self.permission = permission
        self.payload = payload
        self.approvalReference = approvalReference
        self.auditIdentity = auditIdentity
        self.idempotencyKey = idempotencyKey
    }
}

public struct MarketplaceProviderActionAdapterResult: Codable, Equatable, Sendable {
    public var result: JSONRecord
    public var error: JSONRecord?
    public var redactionStatus: String
    public var persistResult: Bool

    public init(
        result: JSONRecord = [:],
        error: JSONRecord? = nil,
        redactionStatus: String = "private-state-excluded",
        persistResult: Bool = true
    ) {
        self.result = result
        self.error = error
        self.redactionStatus = redactionStatus
        self.persistResult = persistResult
    }
}

public protocol MarketplaceProviderActionAdapter: Sendable {
    func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult
}

public struct RailwayRequiredMarketplaceProviderActionAdapter: MarketplaceProviderActionAdapter {
    public init() {}

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        throw ServiceGuard.unavailable(
            context: request.context,
            reasonCode: .featureUnavailable,
            message: "External Marketplace apps execute through Railway. Relay did not create fallback provider output."
        )
    }
}

public struct FakeMarketplaceProviderActionAdapter: MarketplaceProviderActionAdapter {
    public init() {}

    public func execute(request: MarketplaceProviderActionAdapterRequest) throws -> MarketplaceProviderActionAdapterResult {
        if request.app.slug == "x" {
            switch request.definition.actionKey {
            case "x_text_post_create":
                return try Self.xTextResult(
                    request: request,
                    idField: "postId",
                    idPrefix: "x-post",
                    requiresPostId: false
                )
            default:
                break
            }
        }
        return MarketplaceProviderActionAdapterResult(result: [
            "fakeAdapter": .bool(true),
            "appSlug": .string(request.app.slug),
            "actionKey": .string(request.definition.actionKey),
            "permission": .string(request.permission.rawValue),
            "adapterKind": .string(request.definition.adapterKind.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "redactionStatus": .string("private-state-excluded")
        ])
    }

    private static func xTextResult(
        request: MarketplaceProviderActionAdapterRequest,
        idField: String,
        idPrefix: String,
        requiresPostId: Bool
    ) throws -> MarketplaceProviderActionAdapterResult {
        if xPayloadContainsMedia(request.payload) {
            throw ServiceGuard.invalidInput(
                context: request.context,
                message: "X media payloads are deferred in the V1 provider action adapter."
            )
        }
        guard let text = request.payload["text"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else {
            throw ServiceGuard.invalidInput(
                context: request.context,
                message: "X text actions require non-empty text."
            )
        }
        guard text.count <= 280 else {
            throw ServiceGuard.invalidInput(
                context: request.context,
                message: "X text actions are limited to 280 characters in the V1 provider action adapter."
            )
        }
        let parentPostId: String?
        if requiresPostId {
            guard let postId = request.payload["postId"]?.string?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !postId.isEmpty else {
                throw ServiceGuard.invalidInput(
                    context: request.context,
                    message: "X replies require the parent post id."
                )
            }
            parentPostId = postId
        } else {
            parentPostId = nil
        }
        let providerId = "\(idPrefix)-\(stableSuffix("\(request.definition.actionKey)|\(text)|\(parentPostId ?? "")|\(request.idempotencyKey)"))"
        var result: JSONRecord = [
            "fakeAdapter": .bool(true),
            "provider": .string("x"),
            "actionFamily": .string("public-social-text"),
            "permission": .string(request.permission.rawValue),
            "payloadHash": .string(MarketplaceProviderActionApprovalService.payloadHash(request.payload)),
            "approved": .bool(request.approvalReference?.status == .approved),
            "idempotencyKey": .string(request.idempotencyKey),
            "textCharacterCount": .number(Double(text.count)),
            idField: .string(providerId),
            "simulated": .bool(true),
            "redactionStatus": .string("private-state-excluded")
        ]
        if let parentPostId {
            result["inReplyToPostId"] = .string(parentPostId)
        }
        return MarketplaceProviderActionAdapterResult(result: result)
    }

    private static func xPayloadContainsMedia(_ payload: JSONRecord) -> Bool {
        let mediaKeys = [
            "media",
            "mediaIds",
            "media_ids",
            "attachments",
            "image",
            "images",
            "video",
            "videos"
        ]
        return mediaKeys.contains { payload[$0] != nil }
    }

    private static func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        let hex = String(hash, radix: 16)
        return String(hex.suffix(10))
    }
}

public final class MarketplaceProviderActionBrokerService {
    private let data: LocalDataService
    private let approvals: MarketplaceProviderActionApprovalService
    private let auditSecurity: AuditSecurityService
    private let adapter: any MarketplaceProviderActionAdapter

    public init(
        data: LocalDataService,
        approvals: MarketplaceProviderActionApprovalService,
        auditSecurity: AuditSecurityService,
        adapter: any MarketplaceProviderActionAdapter = RoutingMarketplaceProviderActionAdapter()
    ) {
        self.data = data
        self.approvals = approvals
        self.auditSecurity = auditSecurity
        self.adapter = adapter
    }

    @discardableResult
    public func execute(
        context: ServiceRequestContext,
        request: MarketplaceProviderActionBrokerRequest,
        now: Date = Date()
    ) throws -> MarketplaceProviderActionBrokerResult {
        try requireExecutionAccess(context: context)
        let timestamp = ISO8601DateFormatter.relayConsole.string(from: now)
        let app = try requireProviderActionApp(context: context, appIdOrSlug: request.appIdOrSlug)
        guard MarketplaceExecutionAuthority.currentSwiftAdapterAuthority(for: app.slug) != .railway else {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .featureUnavailable,
                message: "External Marketplace apps execute through Railway. The local Swift broker will not run an adapter or create fallback output."
            )
        }
        let definition = try requireActionDefinition(context: context, app: app, actionKey: request.actionKey)
        let install = try validateInstall(request.installId, app: app, context: context)
        let effectiveConnectionId = request.connectionId ?? install?.connectionId
        let connection = try validateConnection(effectiveConnectionId, app: app, context: context)
        let executionAuthority = try validateExecutionAuthority(
            request: request,
            connection: connection,
            install: install,
            app: app,
            context: context
        )
        if let install, let requestConnectionId = request.connectionId, install.connectionId != requestConnectionId {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action broker connection does not match the Marketplace install.")
        }
        let effectiveAgentId = try validateAgent(request.agentId, install: install, context: context)
        let permissionMap = try resolvePermissionMap(
            context: context,
            app: app,
            connectionId: effectiveConnectionId,
            installId: install?.id,
            agentId: effectiveAgentId
        )
        if let permissionMap, permissionMap.resolvedExecutionAuthority != executionAuthority {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .featureUnavailable,
                message: "Marketplace permission policy belongs to a missing or different execution authority; no fallback was attempted."
            )
        }
        let permission = MarketplaceProviderActionPolicyCompilerService.effectivePermission(
            permissionMap?.permissions[definition.actionKey] ?? definition.defaultPermission,
            permissionMap: permissionMap
        )
        let payloadHash = MarketplaceProviderActionApprovalService.payloadHash(request.payload)
        let idempotencyKey = request.idempotencyKey ?? defaultIdempotencyKey(
            definition: definition,
            permission: permission,
            approvalId: request.approvalId,
            payloadHash: payloadHash
        )

        if let existing = try existingExecution(
            workspaceId: context.workspaceId,
            appId: app.id,
            providerActionId: definition.id,
            idempotencyKey: idempotencyKey
        ) {
            if permission == .approvalRequired,
               existing.status == .pendingApproval,
               let approvalId = existing.approvalReference?.approvalId {
                let linkedApproval = try data.getMarketplaceProviderActionApproval(
                    workspaceId: context.workspaceId,
                    approvalId: approvalId
                )
                if linkedApproval?.status == .approved {
                    let approval = try requireApprovedApproval(
                        context: context,
                        approvalId: approvalId,
                        definition: definition,
                        payloadHash: payloadHash,
                        now: now
                    )
                    if let resolvedExecution = try latestResolvedExecutionForApproval(
                        workspaceId: context.workspaceId,
                        appId: app.id,
                        approvalId: approval.id
                    ) {
                        return MarketplaceProviderActionBrokerResult(
                            execution: resolvedExecution,
                            approval: approval,
                            permissionMap: permissionMap,
                            adapterExecuted: false
                        )
                    }
                    let approvedIdempotencyKey = defaultIdempotencyKey(
                        definition: definition,
                        permission: permission,
                        approvalId: approval.id,
                        payloadHash: payloadHash
                    )
                    if let approvedExecution = try existingExecution(
                        workspaceId: context.workspaceId,
                        appId: app.id,
                        providerActionId: definition.id,
                        idempotencyKey: approvedIdempotencyKey
                    ) {
                        if approvedExecution.status != .pendingApproval {
                            return MarketplaceProviderActionBrokerResult(
                                execution: approvedExecution,
                                approval: approval,
                                permissionMap: permissionMap,
                                adapterExecuted: false
                            )
                        }
                        let reference = approvalReference(approval, executionId: approvedExecution.id)
                        return try runAdapter(
                            context: context,
                            app: app,
                            definition: definition,
                            permission: permission,
                            idempotencyKey: approvedIdempotencyKey,
                            payload: request.payload,
                            payloadHash: payloadHash,
                            approvalReference: reference,
                            connectionId: effectiveConnectionId,
                            installId: install?.id,
                            agentId: effectiveAgentId,
                            dispatchId: request.dispatchId,
                            threadId: request.threadId,
                            source: request.source,
                            permissionMap: permissionMap,
                            now: timestamp,
                            executionId: approvedExecution.id
                        )
                    }
                    let reference = approvalReference(approval, executionId: nil)
                    return try runAdapter(
                        context: context,
                        app: app,
                        definition: definition,
                        permission: permission,
                        idempotencyKey: approvedIdempotencyKey,
                        payload: request.payload,
                        payloadHash: payloadHash,
                        approvalReference: reference,
                        connectionId: effectiveConnectionId,
                        installId: install?.id,
                        agentId: effectiveAgentId,
                        dispatchId: request.dispatchId,
                        threadId: request.threadId,
                        source: request.source,
                        permissionMap: permissionMap,
                        now: timestamp
                    )
                }
            }
            return MarketplaceProviderActionBrokerResult(
                execution: existing,
                approval: try existing.approvalReference.flatMap {
                    try data.getMarketplaceProviderActionApproval(workspaceId: context.workspaceId, approvalId: $0.approvalId)
                },
                permissionMap: permissionMap,
                adapterExecuted: false
            )
        }

        if let v1BlockReason = providerV1BlockReason(app: app, definition: definition, payload: request.payload) {
            let execution = try saveExecution(
                context: context,
                app: app,
                definition: definition,
                permission: .blocked,
                status: .blocked,
                idempotencyKey: idempotencyKey,
                payload: request.payload,
                payloadHash: payloadHash,
                approvalReference: nil,
                connectionId: effectiveConnectionId,
                installId: install?.id,
                agentId: effectiveAgentId,
                dispatchId: request.dispatchId,
                threadId: request.threadId,
                providerResult: nil,
                providerError: [
                    "reason": .string(v1BlockReason),
                    "reasonCode": .string(GuardReasonCode.inputInvalid.rawValue),
                    "permission": .string(ProviderActionPermission.blocked.rawValue)
                ],
                startedAt: nil,
                completedAt: timestamp,
                now: timestamp,
                source: request.source
            )
            let audit = recordAudit(
                context: context,
                execution: execution,
                eventType: "provider_action.blocked",
                severity: "warning",
                message: "Provider action blocked by Marketplace provider V1 scope.",
                permissionMap: permissionMap,
                payloadHash: payloadHash
            )
            return MarketplaceProviderActionBrokerResult(
                execution: execution,
                permissionMap: permissionMap,
                adapterExecuted: false,
                auditEventId: audit?.id
            )
        }

        switch permission {
        case .blocked:
            let reason = permissionMap?.blockedReasons[definition.actionKey] ?? "Provider action is blocked by Marketplace policy."
            let execution = try saveExecution(
                context: context,
                app: app,
                definition: definition,
                permission: permission,
                status: .blocked,
                idempotencyKey: idempotencyKey,
                payload: request.payload,
                payloadHash: payloadHash,
                approvalReference: nil,
                connectionId: effectiveConnectionId,
                installId: install?.id,
                agentId: effectiveAgentId,
                dispatchId: request.dispatchId,
                threadId: request.threadId,
                providerResult: nil,
                providerError: [
                    "reason": .string(reason),
                    "reasonCode": .string(GuardReasonCode.authorityRoleRequired.rawValue),
                    "permission": .string(permission.rawValue)
                ],
                startedAt: nil,
                completedAt: timestamp,
                now: timestamp,
                source: request.source
            )
            let audit = recordAudit(
                context: context,
                execution: execution,
                eventType: "provider_action.blocked",
                severity: "warning",
                message: "Provider action blocked by Marketplace policy.",
                permissionMap: permissionMap,
                payloadHash: payloadHash
            )
            return MarketplaceProviderActionBrokerResult(
                execution: execution,
                permissionMap: permissionMap,
                adapterExecuted: false,
                auditEventId: audit?.id
            )

        case .approvalRequired:
            let approval = try request.approvalId.map {
                try requireApprovedApproval(
                    context: context,
                    approvalId: $0,
                    definition: definition,
                    payloadHash: payloadHash,
                    now: now
                )
            }
            guard let approval else {
                let executionId = createRelayId("mpexec")
                let approvalRecord = try approvals.requestApproval(
                    context: context,
                    appIdOrSlug: app.id,
                    actionKey: definition.actionKey,
                    proposedPayload: request.payload,
                    connectionId: effectiveConnectionId,
                    installId: install?.id,
                    agentId: effectiveAgentId,
                    idempotencyKey: "approval-\(definition.id)-\(payloadHash)",
                    executionId: executionId,
                    metadata: [
                        "brokerSource": .string(request.source),
                        "permission": .string(permission.rawValue),
                        "executionAuthority": .string(executionAuthority.rawValue),
                        "executionAuthorityVersion": .string(MarketplaceExecutionAuthority.contractVersion)
                    ],
                    now: now
                )
                let reference = approvalReference(approvalRecord, executionId: executionId)
                let execution = try saveExecution(
                    context: context,
                    app: app,
                    definition: definition,
                    permission: permission,
                    status: .pendingApproval,
                    idempotencyKey: idempotencyKey,
                    payload: request.payload,
                    payloadHash: payloadHash,
                    approvalReference: reference,
                    connectionId: effectiveConnectionId,
                    installId: install?.id,
                    agentId: effectiveAgentId,
                    dispatchId: request.dispatchId,
                    threadId: request.threadId,
                    providerResult: nil,
                    providerError: nil,
                    startedAt: nil,
                    completedAt: nil,
                    now: timestamp,
                    source: request.source,
                    executionId: executionId
                )
                let audit = recordAudit(
                    context: context,
                    execution: execution,
                    eventType: "provider_action.approval_requested",
                    severity: "info",
                    message: "Provider action queued for approval.",
                    permissionMap: permissionMap,
                    payloadHash: payloadHash
                )
                return MarketplaceProviderActionBrokerResult(
                    execution: execution,
                    approval: approvalRecord,
                    permissionMap: permissionMap,
                    adapterExecuted: false,
                    auditEventId: audit?.id
                )
            }
            let reference = approvalReference(approval, executionId: nil)
            return try runAdapter(
                context: context,
                app: app,
                definition: definition,
                permission: permission,
                idempotencyKey: idempotencyKey,
                payload: request.payload,
                payloadHash: payloadHash,
                approvalReference: reference,
                connectionId: effectiveConnectionId,
                installId: install?.id,
                agentId: effectiveAgentId,
                dispatchId: request.dispatchId,
                threadId: request.threadId,
                source: request.source,
                permissionMap: permissionMap,
                now: timestamp
            )

        case .allowed, .autoExecute:
            return try runAdapter(
                context: context,
                app: app,
                definition: definition,
                permission: permission,
                idempotencyKey: idempotencyKey,
                payload: request.payload,
                payloadHash: payloadHash,
                approvalReference: nil,
                connectionId: effectiveConnectionId,
                installId: install?.id,
                agentId: effectiveAgentId,
                dispatchId: request.dispatchId,
                threadId: request.threadId,
                source: request.source,
                permissionMap: permissionMap,
                now: timestamp
            )
        }
    }

    private func runAdapter(
        context: ServiceRequestContext,
        app: MarketplaceCatalogApp,
        definition: MarketplaceProviderActionDefinition,
        permission: ProviderActionPermission,
        idempotencyKey: String,
        payload: JSONRecord,
        payloadHash: String,
        approvalReference: ProviderActionApprovalReference?,
        connectionId: RelayId?,
        installId: RelayId?,
        agentId: RelayId?,
        dispatchId: RelayId?,
        threadId: RelayId?,
        source: String,
        permissionMap: MarketplaceActionPermissionMap?,
        now: IsoTimestamp,
        executionId: RelayId? = nil
    ) throws -> MarketplaceProviderActionBrokerResult {
        let executionId = executionId ?? createRelayId("mpexec")
        let auditIdentity = makeAuditIdentity(
            context: context,
            app: app,
            connectionId: connectionId,
            installId: installId,
            agentId: agentId,
            approvalId: approvalReference?.approvalId,
            dispatchId: dispatchId,
            threadId: threadId,
            source: source
        )
        let adapterRequest = MarketplaceProviderActionAdapterRequest(
            context: context,
            app: app,
            definition: definition,
            permission: permission,
            payload: payload,
            approvalReference: approvalReference,
            auditIdentity: auditIdentity,
            idempotencyKey: idempotencyKey
        )
        do {
            let adapterResult = try adapter.execute(request: adapterRequest)
            try validateProviderSuccessEvidence(
                app: app,
                definition: definition,
                adapterResult: adapterResult
            )
            let execution = try saveExecution(
                context: context,
                app: app,
                definition: definition,
                permission: permission,
                status: .succeeded,
                idempotencyKey: idempotencyKey,
                payload: payload,
                payloadHash: payloadHash,
                approvalReference: approvalReference,
                connectionId: connectionId,
                installId: installId,
                agentId: agentId,
                dispatchId: dispatchId,
                threadId: threadId,
                providerResult: adapterResult.persistResult ? adapterResult.result : [
                    "providerDataPersisted": .bool(false),
                    "transientResultReturned": .bool(true),
                    "redactionStatus": .string("provider-content-not-stored"),
                ],
                providerError: adapterResult.error,
                startedAt: now,
                completedAt: now,
                now: now,
                source: source,
                executionId: executionId
            )
            let audit = recordAudit(
                context: context,
                execution: execution,
                eventType: "provider_action.succeeded",
                severity: "info",
                message: "Provider action completed through adapter.",
                permissionMap: permissionMap,
                payloadHash: payloadHash
            )
            return MarketplaceProviderActionBrokerResult(
                execution: execution,
                permissionMap: permissionMap,
                adapterExecuted: true,
                auditEventId: audit?.id,
                transientProviderResult: adapterResult.persistResult ? nil : adapterResult.result
            )
        } catch {
            let providerError = providerErrorRecord(error)
            let execution = try saveExecution(
                context: context,
                app: app,
                definition: definition,
                permission: permission,
                status: .failed,
                idempotencyKey: idempotencyKey,
                payload: payload,
                payloadHash: payloadHash,
                approvalReference: approvalReference,
                connectionId: connectionId,
                installId: installId,
                agentId: agentId,
                dispatchId: dispatchId,
                threadId: threadId,
                providerResult: nil,
                providerError: providerError,
                startedAt: now,
                completedAt: now,
                now: now,
                source: source,
                executionId: executionId
            )
            let audit = recordAudit(
                context: context,
                execution: execution,
                eventType: "provider_action.failed",
                severity: "error",
                message: "Provider action adapter failed.",
                permissionMap: permissionMap,
                payloadHash: payloadHash
            )
            return MarketplaceProviderActionBrokerResult(
                execution: execution,
                permissionMap: permissionMap,
                adapterExecuted: true,
                auditEventId: audit?.id
            )
        }
    }

    private func saveExecution(
        context: ServiceRequestContext,
        app: MarketplaceCatalogApp,
        definition: MarketplaceProviderActionDefinition,
        permission: ProviderActionPermission,
        status: ProviderActionExecutionStatus,
        idempotencyKey: String,
        payload: JSONRecord,
        payloadHash: String,
        approvalReference: ProviderActionApprovalReference?,
        connectionId: RelayId?,
        installId: RelayId?,
        agentId: RelayId?,
        dispatchId: RelayId?,
        threadId: RelayId?,
        providerResult: JSONRecord?,
        providerError: JSONRecord?,
        startedAt: IsoTimestamp?,
        completedAt: IsoTimestamp?,
        now: IsoTimestamp,
        source: String,
        executionId: RelayId = createRelayId("mpexec")
    ) throws -> MarketplaceProviderActionExecutionRecord {
        let auditIdentity = makeAuditIdentity(
            context: context,
            app: app,
            connectionId: connectionId,
            installId: installId,
            agentId: agentId,
            approvalId: approvalReference?.approvalId,
            dispatchId: dispatchId,
            threadId: threadId,
            source: source
        )
        let execution = MarketplaceProviderActionExecutionRecord(
            id: executionId,
            workspaceId: context.workspaceId,
            appId: app.id,
            appSlug: app.slug,
            connectionId: connectionId,
            installId: installId,
            agentId: agentId,
            providerActionId: definition.id,
            actionKey: definition.actionKey,
            permission: permission,
            status: status,
            idempotencyKey: idempotencyKey,
            requestedPayload: payload,
            approvedPayloadHash: payloadHash,
            approvalReference: approvalReference,
            adapterKind: definition.adapterKind,
            auditIdentity: auditIdentity,
            providerResult: providerResult,
            providerError: providerError,
            startedAt: startedAt,
            completedAt: completedAt,
            createdAt: now,
            updatedAt: now,
            executionAuthority: MarketplaceExecutionAuthority.currentSwiftAdapterAuthority(for: app.slug),
            executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
            redactionStatus: "private-state-excluded"
        )
        return try data.saveMarketplaceProviderActionExecution(execution)
    }

    private func recordAudit(
        context: ServiceRequestContext,
        execution: MarketplaceProviderActionExecutionRecord,
        eventType: String,
        severity: String,
        message: String,
        permissionMap: MarketplaceActionPermissionMap?,
        payloadHash: String
    ) -> AuditLogRecord? {
        auditSecurity.record(
            context: context,
            request: AuditLogRecordRequest(
                eventType: eventType,
                resourceType: "marketplace_provider_action",
                resourceId: execution.providerActionId,
                severity: severity,
                message: message,
                approvalId: execution.approvalReference?.approvalId,
                actionRunId: execution.id,
                dispatchId: execution.auditIdentity.dispatchId,
                threadId: execution.auditIdentity.threadId,
                source: "provider-action-broker",
                context: [
                    "appId": .string(execution.appId),
                    "appSlug": .string(execution.appSlug),
                    "actionKey": .string(execution.actionKey),
                    "permission": .string(execution.permission.rawValue),
                    "status": .string(execution.status.rawValue),
                    "executionAuthority": execution.executionAuthority.map { .string($0.rawValue) } ?? .null,
                    "executionAuthorityVersion": execution.executionAuthorityVersion.map(JSONValue.string) ?? .null,
                    "payloadHash": .string(payloadHash),
                    "permissionMapId": permissionMap.map { .string($0.id) } ?? .null,
                    "redactionStatus": .string("private-state-excluded")
                ]
            )
        )
    }

    private func approvalReference(
        _ approval: MarketplaceProviderActionApprovalRecord,
        executionId: RelayId?
    ) -> ProviderActionApprovalReference {
        ProviderActionApprovalReference(
            approvalId: approval.id,
            status: approval.status,
            proposedPayloadHash: approval.proposedPayloadHash,
            expiresAt: approval.expiresAt,
            idempotencyKey: approval.idempotencyKey,
            executionId: executionId ?? approval.executionId,
            redactionStatus: "private-state-excluded"
        )
    }

    private func existingExecution(
        workspaceId: RelayId,
        appId: RelayId,
        providerActionId: RelayId,
        idempotencyKey: String
    ) throws -> MarketplaceProviderActionExecutionRecord? {
        try data.listMarketplaceProviderActionExecutions(
            workspaceId: workspaceId,
            appId: appId,
            limit: 500
        ).first {
            $0.providerActionId == providerActionId && $0.idempotencyKey == idempotencyKey
        }
    }

    private func latestResolvedExecutionForApproval(
        workspaceId: RelayId,
        appId: RelayId,
        approvalId: RelayId
    ) throws -> MarketplaceProviderActionExecutionRecord? {
        try data.listMarketplaceProviderActionExecutions(
            workspaceId: workspaceId,
            appId: appId,
            limit: 500
        )
        .filter {
            $0.approvalReference?.approvalId == approvalId
                && $0.status != .pendingApproval
        }
        .sorted { $0.updatedAt > $1.updatedAt }
        .first
    }

    private func requireProviderActionApp(
        context: ServiceRequestContext,
        appIdOrSlug: RelayId
    ) throws -> MarketplaceCatalogApp {
        guard let app = try data.getMarketplaceCatalogApp(workspaceId: context.workspaceId, appIdOrSlug: appIdOrSlug) else {
            throw ServiceGuard.invalidInput(context: context, message: "Marketplace app was not found for provider-action broker.")
        }
        guard app.sourceType == .externalProvider,
              app.availability == .available,
              !app.localAppExcluded,
              !app.reviewExcluded
        else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action broker requires an available external Marketplace app.")
        }
        return app
    }

    private func requireActionDefinition(
        context: ServiceRequestContext,
        app: MarketplaceCatalogApp,
        actionKey: String
    ) throws -> MarketplaceProviderActionDefinition {
        guard let definition = try data.listMarketplaceProviderActionDefinitions(
            workspaceId: context.workspaceId,
            appId: app.id,
            limit: 500
        ).first(where: { $0.actionKey == actionKey }) else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider action definition was not found for broker execution.")
        }
        guard definition.enabled else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider action definition is disabled.")
        }
        return definition
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
            .filter { map in
                map.appId == app.id
                    && mapMatches(map.installId, requested: installId)
                    && mapMatches(map.connectionId, requested: connectionId)
                    && mapMatches(map.agentId, requested: agentId)
            }
            .sorted { lhs, rhs in specificity(lhs) > specificity(rhs) }
            .first
    }

    private func mapMatches(_ mapped: RelayId?, requested: RelayId?) -> Bool {
        if let requested {
            return mapped == requested || mapped == nil
        }
        return mapped == nil
    }

    private func specificity(_ map: MarketplaceActionPermissionMap) -> Int {
        [map.installId, map.connectionId, map.agentId].reduce(0) { total, value in
            total + (value == nil ? 0 : 1)
        }
    }

    private func providerErrorRecord(_ error: Error) -> JSONRecord {
        if let adapterFailure = error as? MarketplaceProviderActionAdapterFailure {
            return adapterFailure.providerErrorRecord
        }
        return [
            "message": .string("Provider action adapter failed."),
            "error": .string(String(describing: error)),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private func validateProviderSuccessEvidence(
        app: MarketplaceCatalogApp,
        definition: MarketplaceProviderActionDefinition,
        adapterResult: MarketplaceProviderActionAdapterResult
    ) throws {
        guard app.slug == "linkedin", isLinkedInPublishingAction(definition.actionKey) else {
            return
        }
        let fakeAdapter = adapterResult.result["fakeAdapter"]?.bool == true
        let simulated = adapterResult.result["simulated"]?.bool == true
        let evidenceKey = definition.actionKey == "linkedin_comment_create" ? "commentId" : "postId"
        let providerId = adapterResult.result[evidenceKey]?.string?.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !fakeAdapter, !simulated, providerId?.isEmpty == false else {
            throw MarketplaceProviderActionAdapterFailure(
                code: "linkedin_live_adapter_missing",
                message: "Not posted to LinkedIn: live LinkedIn publishing is not implemented in this build.",
                detail: [
                    "actionKey": .string(definition.actionKey),
                    "requiredProviderEvidence": .string(evidenceKey),
                    "adapterReturnedFakeResult": .bool(fakeAdapter),
                    "adapterReturnedSimulatedResult": .bool(simulated),
                    "liveAdapterMissing": .bool(true),
                    "notPosted": .bool(true)
                ]
            )
        }
    }

    private func isLinkedInPublishingAction(_ actionKey: String) -> Bool {
        actionKey == "linkedin_text_post_create"
    }

    private func providerV1BlockReason(
        app: MarketplaceCatalogApp,
        definition: MarketplaceProviderActionDefinition,
        payload: JSONRecord
    ) -> String? {
        guard app.slug == "x",
              definition.actionKey == "x_text_post_create"
        else {
            return nil
        }
        let mediaKeys = [
            "media",
            "mediaIds",
            "media_ids",
            "attachments",
            "image",
            "images",
            "video",
            "videos"
        ]
        let requestedMediaKeys = mediaKeys.filter { payload[$0] != nil }
        if !requestedMediaKeys.isEmpty {
            return "X media payloads are deferred in the V1 Marketplace provider action map."
        }
        return nil
    }

    private func requireApprovedApproval(
        context: ServiceRequestContext,
        approvalId: RelayId,
        definition: MarketplaceProviderActionDefinition,
        payloadHash: String,
        now: Date
    ) throws -> MarketplaceProviderActionApprovalRecord {
        guard let approval = try data.getMarketplaceProviderActionApproval(workspaceId: context.workspaceId, approvalId: approvalId) else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action approval was not found for execution.")
        }
        guard approval.providerActionId == definition.id, approval.actionKey == definition.actionKey else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action approval does not match the requested action.")
        }
        guard approval.proposedPayloadHash == payloadHash else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action approval payload does not match the requested payload.")
        }
        guard approval.status == .approved else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action execution requires an approved approval record.")
        }
        if let expiresAt = approval.expiresAt,
           let expiry = ISO8601DateFormatter.relayConsole.date(from: expiresAt) ?? ISO8601DateFormatter().date(from: expiresAt),
           expiry <= now {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action approval has expired.")
        }
        return approval
    }

    private func validateConnection(
        _ connectionId: RelayId?,
        app: MarketplaceCatalogApp,
        context: ServiceRequestContext
    ) throws -> MarketplaceProviderConnection? {
        guard let connectionId else { return nil }
        guard let connection = try data.getProviderConnection(workspaceId: context.workspaceId, connectionId: connectionId),
              connection.appId == app.id,
              connection.appSlug == app.slug else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action broker connection does not match the Marketplace app.")
        }
        return connection
    }

    private func validateExecutionAuthority(
        request: MarketplaceProviderActionBrokerRequest,
        connection: MarketplaceProviderConnection?,
        install: MarketplaceInstallRecord?,
        app: MarketplaceCatalogApp,
        context: ServiceRequestContext
    ) throws -> MarketplaceExecutionAuthority {
        let expected = MarketplaceExecutionAuthority.currentSwiftAdapterAuthority(for: app.slug)
        if let connection, connection.resolvedExecutionAuthority != expected {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .featureUnavailable,
                message: "Marketplace connection belongs to a missing or different execution authority; no fallback was attempted."
            )
        }
        if let install, install.resolvedExecutionAuthority != expected {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .featureUnavailable,
                message: "Marketplace install belongs to a missing or different execution authority; no fallback was attempted."
            )
        }
        if request.executionAuthority != nil || request.executionAuthorityVersion != nil,
           request.resolvedExecutionAuthority != expected {
            throw ServiceGuard.unavailable(
                context: context,
                reasonCode: .featureUnavailable,
                message: "Marketplace dispatch belongs to a missing or different execution authority; no fallback was attempted."
            )
        }
        return expected
    }

    private func validateInstall(
        _ installId: RelayId?,
        app: MarketplaceCatalogApp,
        context: ServiceRequestContext
    ) throws -> MarketplaceInstallRecord? {
        guard let installId else { return nil }
        guard let install = try data.getMarketplaceInstall(workspaceId: context.workspaceId, installId: installId),
              install.appId == app.id,
              install.appSlug == app.slug else {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action broker install does not match the Marketplace app.")
        }
        return install
    }

    private func validateAgent(
        _ agentId: RelayId?,
        install: MarketplaceInstallRecord?,
        context: ServiceRequestContext
    ) throws -> RelayId? {
        if let install, let agentId, install.agentId != agentId {
            throw ServiceGuard.invalidInput(context: context, message: "Provider-action broker agent does not match the Marketplace install.")
        }
        return agentId ?? install?.agentId
    }

    private func makeAuditIdentity(
        context: ServiceRequestContext,
        app: MarketplaceCatalogApp,
        connectionId: RelayId?,
        installId: RelayId?,
        agentId: RelayId?,
        approvalId: RelayId?,
        dispatchId: RelayId?,
        threadId: RelayId?,
        source: String
    ) -> ProviderExecutionAuditIdentity {
        ProviderExecutionAuditIdentity(
            workspaceId: context.workspaceId,
            actorId: context.actorId,
            actorRole: context.roles.map(\.rawValue).sorted().first,
            agentId: agentId,
            appId: app.id,
            appSlug: app.slug,
            connectionId: connectionId,
            installId: installId,
            approvalId: approvalId,
            dispatchId: dispatchId,
            threadId: threadId,
            source: source,
            executionAuthority: MarketplaceExecutionAuthority.currentSwiftAdapterAuthority(for: app.slug),
            executionAuthorityVersion: MarketplaceExecutionAuthority.contractVersion,
            redactionStatus: "private-state-excluded"
        )
    }

    private func defaultIdempotencyKey(
        definition: MarketplaceProviderActionDefinition,
        permission: ProviderActionPermission,
        approvalId: RelayId?,
        payloadHash: String
    ) -> String {
        if permission == .approvalRequired, let approvalId {
            return "execute-\(definition.id)-\(approvalId)-\(payloadHash)"
        }
        if permission == .approvalRequired {
            return "approval-request-\(definition.id)-\(payloadHash)"
        }
        return "execute-\(definition.id)-\(payloadHash)"
    }

    private func requireExecutionAccess(context: ServiceRequestContext) throws {
        if let denied = ServiceGuard.requireAnyRole([.owner, .admin, .operator], context: context) {
            throw denied
        }
    }
}
