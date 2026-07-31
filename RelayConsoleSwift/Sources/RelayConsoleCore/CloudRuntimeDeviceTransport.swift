import CryptoKit
import Foundation

public struct CloudRuntimeDeviceSession: Codable, Equatable, Sendable {
    public var localDeviceId: String
    public var remoteDeviceId: String
    public var devicePublicId: String
    public var workspaceId: String
    public var accessToken: String
    public var websocketTicket: String?
    public var expiresAt: String?
}

public struct CloudRuntimeDeviceSummary: Identifiable, Codable, Equatable, Sendable {
    public var id: String
    public var remoteDeviceId: String?
    public var label: String
    public var state: String
    public var lastSeenAt: String?
    public var revokedAt: String?
}

public enum CloudRuntimeDeviceError: Error, Equatable, Sendable {
    case revoked
    case agentNotAssigned
    case duplicateDispatch
    case executionOwnerMissing
    case unsupportedCancellation
    case malformedDispatch
}

public protocol CloudMarketplaceAuthorityBroker: Sendable {
    var authority: CloudExecutionAuthority { get }
    func execute(tool: String, request: [String: JSONValue], idempotencyKey: String) async throws -> [String: JSONValue]
}

public final class CloudMarketplaceAuthorityRouter: @unchecked Sendable {
    private let brokers: [CloudExecutionAuthority: CloudMarketplaceAuthorityBroker]

    public init(brokers: [CloudMarketplaceAuthorityBroker]) {
        self.brokers = Dictionary(uniqueKeysWithValues: brokers.map { ($0.authority, $0) })
    }

    public func execute(authority: CloudExecutionAuthority, tool: String, request: [String: JSONValue], idempotencyKey: String) async throws -> [String: JSONValue] {
        guard let broker = brokers[authority] else {
            throw RelayError(.permissionDenied, "The selected Marketplace execution authority is unavailable. Relay will not fall back to another credential owner.")
        }
        return try await broker.execute(tool: tool, request: request, idempotencyKey: idempotencyKey)
    }
}

public final class CloudRuntimeDeviceTransport: @unchecked Sendable {
    private static let bridgeCapabilities = [
        "clawchat.runtime.hermes", "hermes", "openclaw", "dispatch_backfill", "terminal_ack",
        "marketplace_authority", "event_sequence", "hermes_cancellation",
        "openclaw_cancellation_unsupported", "clawchat.host.cron_management",
        "clawchat.runtime_connector.v3",
        "clawchat.bridge.rotating_credentials.v1",
        "clawchat.marketplace.tools",
        CloudAttachmentStore.capability,
        MarketplaceHermesSkillInstaller.capability,
    ]
    private static let bridgeControlCapabilities = [
        "runtime_dispatch", "cancel", "host_transfer",
        "clawchat.host.cron_management",
        "clawchat.marketplace.tools",
        CloudAttachmentStore.capability,
        MarketplaceHermesSkillInstaller.capability,
    ]

    private let database: DatabaseService
    private let data: LocalDataService
    private let secrets: SecretService
    private let registry: RuntimeBridgeRegistry
    private let harnessInstall: HarnessInstallManager
    private let transport: RelayCloudTransport
    private let marketplaceToolProxy: CloudMarketplaceRuntimeToolProxy
    private let attachmentStore: CloudAttachmentStore
    private var websocket: URLSessionWebSocketTask?
    private var websocketLoop: Task<Void, Never>?
    private var inventoryLoop: Task<Void, Never>?
    private var registeredExternalAgentIds = Set<String>()

    public init(database: DatabaseService, data: LocalDataService, secrets: SecretService, registry: RuntimeBridgeRegistry, harnessInstall: HarnessInstallManager, transport: RelayCloudTransport, marketplaceToolProxy: CloudMarketplaceRuntimeToolProxy = CloudMarketplaceRuntimeToolProxy()) {
        self.database = database
        self.data = data
        self.secrets = secrets
        self.registry = registry
        self.harnessInstall = harnessInstall
        self.transport = transport
        self.marketplaceToolProxy = marketplaceToolProxy
        self.attachmentStore = CloudAttachmentStore()
    }

    init(database: DatabaseService, data: LocalDataService, secrets: SecretService, registry: RuntimeBridgeRegistry, harnessInstall: HarnessInstallManager, transport: RelayCloudTransport, marketplaceToolProxy: CloudMarketplaceRuntimeToolProxy = CloudMarketplaceRuntimeToolProxy(), attachmentStore: CloudAttachmentStore) {
        self.database = database
        self.data = data
        self.secrets = secrets
        self.registry = registry
        self.harnessInstall = harnessInstall
        self.transport = transport
        self.marketplaceToolProxy = marketplaceToolProxy
        self.attachmentStore = attachmentStore
    }

    @discardableResult
    public func enroll(syncLinkId: String, enrollmentCode: String, deviceLabel: String) async throws -> String {
        let response = try await transport.send(method: "POST", path: "bridge/enroll", body: [
            "code": enrollmentCode,
            "deviceLabel": deviceLabel,
            "pluginVersion": "0.3.0-rc.1",
            "openCoreVersion": "0.12.0",
            "runtimeType": "hermes",
            "hostType": "macos-launchd",
            "apiContractVersion": "v2",
            "websocketContractVersion": "bridge.v1",
            "capabilities": Self.bridgeCapabilities,
        ], accessToken: nil)
        guard let device = (response["device"] as? [String: Any]) ?? response as [String: Any]?,
              let remoteId = (device["id"] as? String) ?? (device["deviceId"] as? String),
              let credentials = response["credentials"] as? [String: Any],
              let publicId = (credentials["devicePublicId"] as? String) ?? (device["devicePublicId"] as? String),
              let token = (credentials["deviceToken"] as? String) ?? (response["deviceToken"] as? String) ?? (device["deviceToken"] as? String) else {
            throw CloudRuntimeDeviceError.malformedDispatch
        }
        let localId = createRelayId("clouddev")
        let secret = try secrets.set(scope: "cloud_runtime_device", scopeId: localId, label: "Relay runtime device credential", secretValue: token)
        let timestamp = nowIso()
        try database.run("""
        INSERT INTO cloud_runtime_devices(id,sync_link_id,remote_device_id,device_public_id,credential_secret_reference_id,label,state,capability_json,created_at,updated_at)
        VALUES(?,?,?,?,?,?,'enrolled',?, ?, ?)
        """, [.text(localId), .text(syncLinkId), .text(remoteId), .text(publicId), .text(secret.id), .text(deviceLabel), .text("{\"runtimes\":[\"hermes\",\"openclaw\"],\"hermesCancellation\":true,\"openclawCancellation\":false}"), .text(timestamp), .text(timestamp)])
        return localId
    }

    public func ensureConnected(
        syncLinkId: String,
        workspaceId: String,
        userAccessToken: String,
        websocketBaseURL: URL,
        deviceLabel: String
    ) async throws {
        let existingId = try database.get(
            """
            SELECT id
            FROM cloud_runtime_devices
            WHERE sync_link_id=? AND revoked_at IS NULL
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            [.text(syncLinkId)]
        )?["id"]?.string
        let localDeviceId: String
        if let existingId {
            localDeviceId = existingId
        } else {
            let enrollment = try await transport.send(
                method: "POST",
                path: "bridge/workspaces/\(workspaceId)/enrollments",
                body: [
                    "deviceLabel": deviceLabel,
                    "expiresInMinutes": 10,
                ],
                accessToken: userAccessToken
            )
            guard let code = enrollment["code"] as? String else {
                throw RelayError(.internalError, "Relay did not return a runtime bridge enrollment code.")
            }
            localDeviceId = try await enroll(
                syncLinkId: syncLinkId,
                enrollmentCode: code,
                deviceLabel: deviceLabel
            )
        }
        let session = try await authenticate(localDeviceId: localDeviceId)
        guard session.workspaceId == workspaceId else {
            throw RelayError(.permissionDenied, "The runtime bridge credential belongs to another workspace.")
        }
        try await connectWebSocket(session: session, websocketBaseURL: websocketBaseURL)
    }

    public func authenticate(localDeviceId: String) async throws -> CloudRuntimeDeviceSession {
        guard let row = try database.get("SELECT d.*,l.remote_workspace_id FROM cloud_runtime_devices d JOIN workspace_sync_links l ON l.id=d.sync_link_id WHERE d.id=?", [.text(localDeviceId)]), row["revoked_at"]?.string == nil,
              let secretId = row["credential_secret_reference_id"]?.string else { throw CloudRuntimeDeviceError.revoked }
        let response = try await transport.send(method: "POST", path: "bridge/device/auth", body: [
            "devicePublicId": row["device_public_id"]?.string ?? "",
            "deviceToken": try secrets.getSecretValue(secretId),
            "pluginVersion": "0.3.0-rc.1",
            "openCoreVersion": "0.12.0",
            "runtimeType": "hermes",
            "hostType": "macos-launchd",
            "apiContractVersion": "v2",
            "websocketContractVersion": "bridge.v1",
            "capabilities": Self.bridgeCapabilities
        ], accessToken: nil)
        let tokens = response["tokens"] as? [String: Any]
        if let credentials = response["credentials"] as? [String: Any],
           let rotatedDeviceToken = credentials["deviceToken"] as? String {
            try secrets.replaceSecretValue(secretId, secretValue: rotatedDeviceToken)
        }
        guard let accessToken = (response["accessToken"] as? String) ?? (response["token"] as? String) ?? (tokens?["accessToken"] as? String) else { throw CloudRuntimeDeviceError.revoked }
        _ = try await transport.send(method: "POST", path: "bridge/execution-owner-leases/heartbeat", body: [:], accessToken: accessToken)
        let hermesCatalog = await harnessInstall.refreshRuntimeModelCatalog(for: .hermes)
        _ = try? await transport.send(
            method: "POST",
            path: "bridge/runtime-model-catalog",
            body: [
                "runtimeType": hermesCatalog.runtimeType.rawValue,
                "defaultModel": hermesCatalog.defaultModel,
                "models": hermesCatalog.models,
                "source": hermesCatalog.source,
                "observedAt": hermesCatalog.observedAt
            ],
            accessToken: accessToken
        )
        try database.run("UPDATE cloud_runtime_devices SET state='online',last_seen_at=?,updated_at=? WHERE id=?", [.text(nowIso()), .text(nowIso()), .text(localDeviceId)])
        let session = CloudRuntimeDeviceSession(
            localDeviceId: localDeviceId, remoteDeviceId: row["remote_device_id"]?.string ?? "", devicePublicId: row["device_public_id"]?.string ?? "", workspaceId: row["remote_workspace_id"]?.string ?? "", accessToken: accessToken,
            websocketTicket: (response["websocketTicket"] as? String) ?? (tokens?["wsToken"] as? String), expiresAt: response["expiresAt"] as? String)
        try reconcileSyncedLocalAgentMappings(session: session)
        try? await synchronizeNativeInventory(session: session)
        return session
    }

    public func connectWebSocket(session: CloudRuntimeDeviceSession, websocketBaseURL: URL) async throws {
        guard websocketBaseURL.scheme == "wss", let token = session.websocketTicket else { throw RelayError(.invalidInput, "Relay runtime websocket requires a pinned WSS origin and device token.") }
        marketplaceToolProxy.clearBridgeSession()
        websocketLoop?.cancel(); websocket?.cancel(with: .goingAway, reason: nil)
        let socket = URLSession.shared.webSocketTask(with: websocketBaseURL)
        websocket = socket; socket.resume()
        registeredExternalAgentIds.removeAll()
        try await sendSocket(["type": "authenticate", "token": token, "capabilities": Self.bridgeCapabilities])
        try await sendSocket(["type": "subscribe_bridge_control", "workspaceId": session.workspaceId, "capabilities": Self.bridgeControlCapabilities])
        try await registerPublishedAgents(session: session)
        let remoteAgentIds: [String: String] = Dictionary(
            uniqueKeysWithValues: try database.all(
                """
                SELECT local_agent_id,remote_agent_id
                FROM cloud_runtime_bindings
                WHERE runtime_device_id=? AND publication_state='published'
                  AND owner_lease_state='active'
                """,
                [.text(session.localDeviceId)]
            ).compactMap { row in
                guard let localAgentId = row["local_agent_id"]?.string,
                      let remoteAgentId = row["remote_agent_id"]?.string
                else { return nil }
                return (localAgentId, remoteAgentId)
            }
        )
        marketplaceToolProxy.configureBridgeSession(
            transport: transport,
            accessToken: session.accessToken,
            remoteAgentIds: remoteAgentIds
        )
        websocketLoop = Task { [weak self] in await self?.receiveSocketLoop(session: session, websocketBaseURL: websocketBaseURL) }
        inventoryLoop?.cancel()
        inventoryLoop = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(10))
                guard !Task.isCancelled else { return }
                try? self?.reconcileSyncedLocalAgentMappings(session: session)
                try? await self?.registerPublishedAgents(session: session)
                try? await self?.synchronizeNativeInventory(session: session)
            }
        }
        try await backfill(session: session)
    }

    public func disconnectWebSocket() {
        websocketLoop?.cancel(); websocketLoop = nil
        inventoryLoop?.cancel(); inventoryLoop = nil
        websocket?.cancel(with: .goingAway, reason: nil); websocket = nil
        registeredExternalAgentIds.removeAll()
        marketplaceToolProxy.clearBridgeSession()
    }

    public func publishAgent(localDeviceId: String, localAgentId: String, remoteAgentId: String?, session: CloudRuntimeDeviceSession) async throws -> String {
        let agent = try data.getAgent(localAgentId)
        let binding = agent.binding
        let harness = agent.harness
        let externalId = remoteAgentId ?? "swift:\(session.devicePublicId):\(localAgentId)"
        let capabilities = await (try registry.get(binding.runtimeType)).getCapabilities(harnessId: harness.id, config: harness.config)
        var advertised = ["sessions", "tools", "marketplace_authority", "terminal_ack", "dispatch_backfill"]
        if capabilities.supportsStreaming { advertised.append("streaming") }
        if capabilities.supportsCancellation { advertised.append("cancellation") } else { advertised.append("cancellation_unsupported") }
        let response = try await transport.send(method: "POST", path: "bridge/agents", body: ["agent": [
            "workspaceId": session.workspaceId, "externalId": externalId, "name": agent.name,
            "role": agent.role ?? "assistant", "description": agent.description ?? "", "status": "active",
            "source": binding.runtimeType.rawValue, "capabilities": advertised,
            "metadata": ["runtimeHostKind": "relay_console_swift", "devicePublicId": session.devicePublicId, "runtimeType": binding.runtimeType.rawValue]
        ]], accessToken: session.accessToken)
        guard let canonicalAgentId = response["id"] as? String else { throw CloudRuntimeDeviceError.malformedDispatch }
        let timestamp = nowIso()
        try database.run("""
        INSERT INTO cloud_runtime_bindings(id,runtime_device_id,local_agent_id,remote_agent_id,remote_binding_id,publication_state,owner_lease_state,capability_json,created_at,updated_at)
        VALUES(?,?,?,?,?,'published','active',?,?,?)
        ON CONFLICT(runtime_device_id,local_agent_id) DO UPDATE SET remote_agent_id=excluded.remote_agent_id,remote_binding_id=excluded.remote_binding_id,publication_state='published',owner_lease_state='active',capability_json=excluded.capability_json,updated_at=excluded.updated_at
        """, [.text(createRelayId("cloudbind")), .text(localDeviceId), .text(localAgentId), .text(canonicalAgentId), .text(externalId), .text("{\"runtime\":\"\(binding.runtimeType.rawValue)\",\"cancellation\":\(capabilities.supportsCancellation)}"), .text(timestamp), .text(timestamp)])
        marketplaceToolProxy.setRemoteAgentId(canonicalAgentId, for: localAgentId)
        return canonicalAgentId
    }

    public func backfill(session: CloudRuntimeDeviceSession) async throws {
        _ = try await transport.send(method: "POST", path: "bridge/execution-owner-leases/heartbeat", body: [:], accessToken: session.accessToken)
        let externalIds = try database.all("SELECT remote_binding_id FROM cloud_runtime_bindings WHERE runtime_device_id=? AND publication_state='published'", [.text(session.localDeviceId)]).compactMap { $0["remote_binding_id"]?.string }
        guard !externalIds.isEmpty else { return }
        let encoded = externalIds.joined(separator: ",").addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let response = try await transport.send(method: "GET", path: "bridge/runtime-dispatches/pending?externalAgentIds=\(encoded)", body: nil, accessToken: session.accessToken)
        for envelope in response["dispatches"] as? [[String: Any]] ?? [] {
            var dispatch = envelope["payload"] as? [String: Any] ?? envelope
            for key in ["dispatchId", "externalAgentId", "status", "timeoutAt", "expiresAt"] where dispatch[key] == nil {
                dispatch[key] = envelope[key]
            }
            _ = try await handle(dispatch: dispatch, session: session)
        }
    }

    @discardableResult
    public func handle(dispatch: [String: Any], session: CloudRuntimeDeviceSession) async throws -> RuntimeDispatchTerminalResult {
        guard let cloudDispatchId = (dispatch["dispatchId"] as? String) ?? (dispatch["id"] as? String),
              let remoteAgentId = (dispatch["agentId"] as? String) ?? (dispatch["externalAgentId"] as? String),
              let threadId = dispatch["threadId"] as? String,
              let runtimeSessionId = (dispatch["runtimeSessionId"] as? String) ?? (dispatch["threadSessionId"] as? String),
              let input = (dispatch["inputContent"] as? String) ?? (dispatch["content"] as? String) else { throw CloudRuntimeDeviceError.malformedDispatch }
        if let receipt = try database.get("SELECT state,terminal_event_json FROM cloud_dispatch_receipts WHERE cloud_dispatch_id=?", [.text(cloudDispatchId)]), ["completed", "failed", "cancelled"].contains(receipt["state"]?.string ?? "") {
            throw CloudRuntimeDeviceError.duplicateDispatch
        }
        guard let mapping = try database.get("SELECT * FROM cloud_runtime_bindings WHERE runtime_device_id=? AND remote_agent_id=? AND publication_state='published' AND owner_lease_state='active'", [.text(session.localDeviceId), .text(remoteAgentId)]),
            let localAgentId = mapping["local_agent_id"]?.string
        else { throw CloudRuntimeDeviceError.executionOwnerMissing }
        var agent = try data.getAgent(localAgentId)
        var binding = agent.binding
        if let requestedModel = dispatch["model"] as? String,
           !requestedModel.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines).isEmpty,
           let resolved = try? HarnessModelSelectionService.resolve(requestedModel, for: binding.runtimeType) {
            agent.model = resolved.selected
            binding.config["model"] = .string(resolved.selected)
            binding.config["modelFallbackApplied"] = .bool(resolved.fallbackApplied)
            agent.binding = binding
        }
        let harness = agent.harness
        let localThreadId = try localObjectId(syncLinkForDevice: session.localDeviceId, objectType: "thread", remoteId: threadId) ?? threadId
        let localMessageId = try localObjectId(syncLinkForDevice: session.localDeviceId, objectType: "message", remoteId: dispatch["messageId"] as? String ?? "") ?? createRelayId("cloudmsg")
        let localDispatchId = createRelayId("cloudrtd")
        let cloudMarketplaceTools = Self.jsonRecords(dispatch["marketplaceTools"])
        let attachmentPaths: [String] = (dispatch["attachments"] as? [[String: Any]] ?? []).compactMap { attachment -> String? in
            guard let localMediaRef = attachment["localMediaRef"] as? String,
                  let mimeType = attachment["mimeType"] as? String
            else { return nil }
            return attachmentStore.readableImagePath(
                localMediaRef: localMediaRef,
                mimeType: mimeType,
                bridgeDeviceId: attachment["bridgeDeviceId"] as? String,
                expectedBridgeDeviceId: session.remoteDeviceId
            )
        }
        let timestamp = nowIso()
        try database.run("""
        INSERT INTO cloud_dispatch_receipts(cloud_dispatch_id,runtime_device_id,local_dispatch_id,remote_agent_id,thread_id,runtime_session_id,state,received_at,updated_at)
        VALUES(?,?,?,?,?,?, 'accepted',?,?) ON CONFLICT(cloud_dispatch_id) DO NOTHING
        """, [.text(cloudDispatchId), .text(session.localDeviceId), .text(localDispatchId), .text(remoteAgentId), .text(threadId), .text(runtimeSessionId), .text(timestamp), .text(timestamp)])
        marketplaceToolProxy.register(
            localDispatchId: localDispatchId,
            cloudDispatchId: cloudDispatchId,
            workspaceId: agent.workspaceId,
            agentId: agent.id,
            tools: cloudMarketplaceTools,
            transport: transport,
            accessToken: session.accessToken
        )
        defer {
            marketplaceToolProxy.unregister(localDispatchId: localDispatchId)
        }
        let request = RuntimeDispatchRequest(
            dispatchId: localDispatchId, correlationId: "cloud:\(cloudDispatchId)", threadId: localThreadId, messageId: localMessageId, sessionId: runtimeSessionId, attempt: dispatch["attemptNumber"] as? Int ?? 1, agent: agent, runtimeBinding: binding, harness: harness, inputContent: input,
            inputFormat: .plain, recentMessages: [], timeoutMs: RuntimeDispatchTimeouts.chatTurnMs, createdAt: Self.text(dispatch["createdAt"], timestamp), cloudMarketplaceTools: cloudMarketplaceTools, attachmentPaths: attachmentPaths)
        let sink = CloudRuntimeEventPostbackSink(database: database, transport: transport, session: session, cloudDispatchId: cloudDispatchId)
        let result = await (try registry.get(binding.runtimeType)).dispatchTurn(request, sink: sink)
        let terminalType = result.status == "completed" ? "run.completed" : result.status == "cancelled" ? "run.cancelled" : "run.failed"
        await sink.emit(
            RuntimeBridgeEvent(
                id: createRelayId("evt"), type: result.status == "completed" ? .completed : result.status == "cancelled" ? .cancelled : .failed, dispatchId: localDispatchId, correlationId: request.correlationId, timestamp: nowIso(), text: result.finalText, status: result.status,
                detail: result.metadata))
        if binding.runtimeType == .openclaw, let finalText = result.finalText, result.status == "completed" {
            _ = try await transport.send(
                method: "POST", path: "bridge/messages",
                body: [
                    "threadId": threadId, "threadSessionId": dispatch["threadSessionId"] ?? NSNull(), "dispatchId": cloudDispatchId, "content": finalText, "senderId": remoteAgentId, "senderName": agent.name,
                    "metadata": ["relayConsoleDeviceId": session.remoteDeviceId, "nativeRuntime": binding.runtimeType.rawValue, "terminalType": terminalType],
                ], accessToken: session.accessToken)
        }
        let terminalJSON = (try? String(decoding: JSONSerialization.data(withJSONObject: ["type": terminalType, "status": result.status, "text": result.finalText as Any? ?? NSNull()]), as: UTF8.self)) ?? "{}"
        try database.run("UPDATE cloud_dispatch_receipts SET state=?,terminal_event_json=?,terminal_acknowledged_at=?,updated_at=? WHERE cloud_dispatch_id=?", [.text(result.status), .text(terminalJSON), .text(nowIso()), .text(nowIso()), .text(cloudDispatchId)])
        return result
    }

    public func cancel(cloudDispatchId: String, session: CloudRuntimeDeviceSession) async throws -> CancelRuntimeDispatchResult {
        guard
            let row = try database.get(
                "SELECT r.local_dispatch_id,b.local_agent_id FROM cloud_dispatch_receipts r JOIN cloud_runtime_bindings b ON b.runtime_device_id=r.runtime_device_id AND b.remote_agent_id=r.remote_agent_id WHERE r.cloud_dispatch_id=? AND r.runtime_device_id=?",
                [.text(cloudDispatchId), .text(session.localDeviceId)]),
              let localDispatchId = row["local_dispatch_id"]?.string,
              let localAgentId = row["local_agent_id"]?.string else { throw CloudRuntimeDeviceError.agentNotAssigned }
        let binding = try data.getAgent(localAgentId).binding
        let result = await (try registry.get(binding.runtimeType)).cancelDispatch(dispatchId: localDispatchId, correlationId: "cloud:\(cloudDispatchId)")
        if result.status == "not_supported" { throw CloudRuntimeDeviceError.unsupportedCancellation }
        return result
    }

    public func revoke(localDeviceId: String) throws {
        guard let row = try database.get("SELECT credential_secret_reference_id FROM cloud_runtime_devices WHERE id=?", [.text(localDeviceId)]) else { return }
        if let secretId = row["credential_secret_reference_id"]?.string { _ = try? secrets.delete(secretId) }
        try database.transaction {
            try database.run("UPDATE cloud_runtime_devices SET state='revoked',revoked_at=?,credential_secret_reference_id=NULL,updated_at=? WHERE id=?", [.text(nowIso()), .text(nowIso()), .text(localDeviceId)])
            try database.run("UPDATE cloud_runtime_bindings SET publication_state='revoked',owner_lease_state='revoked',updated_at=? WHERE runtime_device_id=?", [.text(nowIso()), .text(localDeviceId)])
        }
    }

    public func listDevices(syncLinkId: String) throws -> [CloudRuntimeDeviceSummary] {
        try database.all("SELECT * FROM cloud_runtime_devices WHERE sync_link_id=? ORDER BY updated_at DESC", [.text(syncLinkId)]).map { row in
            CloudRuntimeDeviceSummary(id: row["id"]?.string ?? "", remoteDeviceId: row["remote_device_id"]?.string, label: row["label"]?.string ?? "Mac", state: row["state"]?.string ?? "unknown", lastSeenAt: row["last_seen_at"]?.string, revokedAt: row["revoked_at"]?.string)
        }
    }

    private func synchronizeNativeInventory(session: CloudRuntimeDeviceSession) async throws {
        for runtimeType in [RuntimeType.hermes, RuntimeType.openclaw] {
            guard let discovered = await harnessInstall.nativeRuntimeInventorySnapshot(runtimeType) else {
                // A missing or failed scanner is not an authoritative empty
                // manifest and must never make healthy observations stale.
                continue
            }
            let inventory = try normalizedNativeInventory(
                discovered,
                session: session
            )
            let metadataAgents = try inventory.map {
                try nativeInventoryRequestBody(session: session, agent: $0)
            }
            let acknowledgements = try pendingNativeDocumentAcknowledgements(
                session: session,
                runtimeType: runtimeType
            )
            let first = try await exchangeNativeInventory(
                session: session,
                runtimeType: runtimeType,
                agents: metadataAgents,
                // This exchange intentionally contains metadata only. It is a
                // complete agent inventory, but it is not a document
                // manifest. Marking it complete would make the backend treat
                // every existing document as deleted before the document
                // exchange below runs.
                completeManifest: false,
                acknowledgements: acknowledgements
            )
            if !acknowledgements.isEmpty {
                try database.run(
                    "UPDATE native_document_sync_state SET acknowledgement_pending=0,updated_at=? WHERE runtime_device_id=? AND runtime_type=? AND acknowledgement_pending=1",
                    [.text(nowIso()), .text(session.localDeviceId), .text(runtimeType.rawValue)]
                )
            }
            let connected = first["agents"] as? [[String: Any]] ?? []
            try reconcileNativeMappings(
                session: session,
                inventory: inventory,
                connected: connected
            )
            let connectedIds = Set(connected.compactMap { $0["externalId"] as? String })
            guard !connectedIds.isEmpty else { continue }
            let connectedInventory = inventory.filter { connectedIds.contains($0.externalId) }
            let scans = connectedInventory.map {
                ($0, NativeRuntimeInventory.scanDocuments(root: $0.localRoot))
            }
            let complete = scans.allSatisfy(\.1.complete)
            let documentAgents = try scans.map { native, scan -> [String: Any] in
                var body = try nativeInventoryRequestBody(session: session, agent: native)
                body["documents"] = try nativeDocumentRequestBodies(
                    session: session,
                    agent: native,
                    documents: scan.documents,
                    includeTombstones: scan.complete
                )
                return body
            }
            let second = try await exchangeNativeInventory(
                session: session,
                runtimeType: runtimeType,
                agents: documentAgents,
                completeManifest: complete,
                acknowledgements: []
            )
            try applyNativeDocumentResponse(
                response: second,
                inventory: scans.compactMap { native, scan in
                    scan.complete ? native : nil
                },
                session: session
            )
        }
    }

    private func reconcileSyncedLocalAgentMappings(
        session: CloudRuntimeDeviceSession
    ) throws {
        guard let link = try database.get(
            """
            SELECT l.local_workspace_id,l.id AS sync_link_id
            FROM cloud_runtime_devices d
            JOIN workspace_sync_links l ON l.id=d.sync_link_id
            WHERE d.id=?
            """,
            [.text(session.localDeviceId)]
        ), let localWorkspaceId = link["local_workspace_id"]?.string,
           let syncLinkId = link["sync_link_id"]?.string
        else { return }
        let timestamp = nowIso()
        for agent in try data.listAgents(workspaceId: localWorkspaceId) {
            guard [.hermes, .openclaw].contains(agent.binding.runtimeType),
                  let externalId = agent.binding.externalAgentId?
                    .trimmingCharacters(in: .whitespacesAndNewlines),
                  !externalId.isEmpty,
                  let canonicalAgentId = try database.get(
                    """
                    SELECT canonical_object_id
                    FROM remote_object_versions
                    WHERE sync_link_id=? AND object_type='agent'
                      AND local_object_id=?
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    [.text(syncLinkId), .text(agent.id)]
                  )?["canonical_object_id"]?.string
            else { continue }
            let capabilityJSON = try String(
                decoding: JSONSerialization.data(
                    withJSONObject: [
                        "runtime": agent.binding.runtimeType.rawValue,
                        "syncedAgent": true,
                    ],
                    options: [.sortedKeys]
                ),
                as: UTF8.self
            )
            try database.run(
                """
                INSERT INTO cloud_runtime_bindings(
                  id,runtime_device_id,local_agent_id,remote_agent_id,remote_binding_id,
                  publication_state,owner_lease_state,capability_json,created_at,updated_at
                ) VALUES(?,?,?,?,?,'published','active',?,?,?)
                ON CONFLICT(runtime_device_id,local_agent_id) DO UPDATE SET
                  remote_agent_id=excluded.remote_agent_id,
                  remote_binding_id=excluded.remote_binding_id,
                  publication_state='published',
                  owner_lease_state='active',
                  capability_json=excluded.capability_json,
                  updated_at=excluded.updated_at
                """,
                [
                    .text(createRelayId("cloudbind")),
                    .text(session.localDeviceId),
                    .text(agent.id),
                    .text(canonicalAgentId),
                    .text(externalId),
                    .text(capabilityJSON),
                    .text(timestamp),
                    .text(timestamp),
                ]
            )
            marketplaceToolProxy.setRemoteAgentId(canonicalAgentId, for: agent.id)
        }
    }

    private func registerPublishedAgents(
        session: CloudRuntimeDeviceSession
    ) async throws {
        for row in try database.all(
            """
            SELECT b.remote_binding_id,a.runtime_type
            FROM cloud_runtime_bindings b
            JOIN runtime_bindings a ON a.agent_id=b.local_agent_id
            WHERE b.runtime_device_id=? AND b.publication_state='published'
            """,
            [.text(session.localDeviceId)]
        ) {
            guard let externalId = row["remote_binding_id"]?.string,
                  !externalId.isEmpty,
                  registeredExternalAgentIds.insert(externalId).inserted
            else { continue }
            let event = row["runtime_type"]?.string == RuntimeType.hermes.rawValue
                ? "register_hermes_agent"
                : "register_bridge_agent"
            try await sendSocket([
                "type": event,
                "externalAgentId": externalId,
                "capabilities": ["dispatch", "marketplace", "terminal_ack"],
            ])
        }
    }

    private func exchangeNativeInventory(
        session: CloudRuntimeDeviceSession,
        runtimeType: RuntimeType,
        agents: [[String: Any]],
        completeManifest: Bool,
        acknowledgements: [[String: Any]]
    ) async throws -> [String: Any] {
        let identity = agents.map { agent in
            [
                "externalId": agent["externalId"] as? String ?? "",
                "name": agent["name"] as? String ?? "",
            ]
        }
        let identityData = try JSONSerialization.data(
            withJSONObject: identity,
            options: [.sortedKeys]
        )
        let generation = SHA256.hash(data: identityData)
            .map { String(format: "%02x", $0) }.joined()
        return try await transport.send(
            method: "POST",
            path: "bridge/agent-sync/exchange",
            body: [
                "protocolVersion": "relay-connector.v3",
                "runtimeType": runtimeType.rawValue,
                "manifestHash": generation,
                "inventoryGeneration": generation,
                "completeInventory": true,
                "completeManifest": completeManifest,
                "host": [
                    "softwareVersion": "relay-console-swift/\(RelayConsoleReleaseMetadata.current.version)",
                    "protocolVersion": "3",
                    "capabilities": [
                        "connectorProtocol": "relay-connector.v3",
                        "metadataOnlyDiscovery": true,
                        "sameMacAdapter": true,
                        "completeInventory": true,
                        "completeManifest": completeManifest,
                    ],
                ],
                "agents": agents,
                "acknowledgements": acknowledgements,
            ],
            accessToken: session.accessToken
        )
    }

    private func reconcileNativeMappings(
        session: CloudRuntimeDeviceSession,
        inventory: [NativeRuntimeInventoryAgent],
        connected: [[String: Any]]
    ) throws {
        guard let localWorkspaceId = try database.get(
            """
            SELECT l.local_workspace_id
            FROM cloud_runtime_devices d
            JOIN workspace_sync_links l ON l.id=d.sync_link_id
            WHERE d.id=?
            """,
            [.text(session.localDeviceId)]
        )?["local_workspace_id"]?.string else {
            throw CloudRuntimeDeviceError.agentNotAssigned
        }
        for row in connected {
            guard let externalId = row["externalId"] as? String,
                  let canonicalAgentId = row["canonicalAgentId"] as? String,
                  let native = inventory.first(where: { $0.externalId == externalId }),
                  let harness = try data.getHarnessByRuntimeType(native.runtimeType)
            else { continue }
            let existing = try data.listAgents(workspaceId: localWorkspaceId).first {
                $0.binding.runtimeType == native.runtimeType
                    && $0.binding.externalAgentId == native.externalId
            }
            let localAgent = try existing ?? data.createAgent(
                workspaceId: localWorkspaceId,
                name: native.name,
                description: native.description,
                model: native.modelPrimary,
                harnessId: harness.id,
                externalAgentId: native.externalId,
                hermesProfileSlug: native.runtimeType == .hermes
                    ? native.nativeProfileName
                    : nil,
                hermesHomePath: native.runtimeType == .hermes
                    ? native.localRoot?.path
                    : nil,
                hermesIdentityFilePath: native.runtimeType == .hermes
                    ? native.localRoot?.appendingPathComponent("IDENTITY.md").path
                    : nil,
                workspaceFolderPath: native.runtimeType == .openclaw
                    ? native.localRoot?.path
                    : nil,
                config: [
                    "nativeImported": .bool(true),
                    "nativeConnectionOrigin": .string("customer_existing"),
                ]
            )
            let timestamp = nowIso()
            var capability: [String: Any] = [
                "runtime": native.runtimeType.rawValue,
                "nativeImported": true,
            ]
            if let bindingEpoch = row["bindingEpoch"] {
                capability["bindingEpoch"] = String(describing: bindingEpoch)
            }
            let capabilityData = try JSONSerialization.data(
                withJSONObject: capability,
                options: [.sortedKeys]
            )
            let capabilityJSON = String(decoding: capabilityData, as: UTF8.self)
            try database.run(
                """
                INSERT INTO cloud_runtime_bindings(
                  id,runtime_device_id,local_agent_id,remote_agent_id,remote_binding_id,
                  publication_state,owner_lease_state,capability_json,created_at,updated_at
                ) VALUES(?,?,?,?,?,'published','active',?,?,?)
                ON CONFLICT(runtime_device_id,local_agent_id) DO UPDATE SET
                  remote_agent_id=excluded.remote_agent_id,
                  remote_binding_id=excluded.remote_binding_id,
                  publication_state='published',
                  owner_lease_state='active',
                  capability_json=excluded.capability_json,
                  updated_at=excluded.updated_at
                """,
                [
                    .text(createRelayId("cloudbind")),
                    .text(session.localDeviceId),
                    .text(localAgent.id),
                    .text(canonicalAgentId),
                    .text(native.externalId),
                    .text(capabilityJSON),
                    .text(timestamp),
                    .text(timestamp),
                ]
            )
        }
    }

    private func normalizedNativeInventory(
        _ inventory: [NativeRuntimeInventoryAgent],
        session: CloudRuntimeDeviceSession
    ) throws -> [NativeRuntimeInventoryAgent] {
        guard let localWorkspaceId = try database.get(
            """
            SELECT l.local_workspace_id
            FROM cloud_runtime_devices d
            JOIN workspace_sync_links l ON l.id=d.sync_link_id
            WHERE d.id=?
            """,
            [.text(session.localDeviceId)]
        )?["local_workspace_id"]?.string else {
            return inventory
        }
        let localAgents = try data.listAgents(workspaceId: localWorkspaceId)
        return inventory.map { native in
            guard let existing = localAgents.first(where: { agent in
                guard agent.binding.runtimeType == native.runtimeType else {
                    return false
                }
                if agent.binding.externalAgentId == native.externalId {
                    return true
                }
                if native.runtimeType == .hermes {
                    if let homePath = agent.binding.hermesHomePath,
                       let localRoot = native.localRoot,
                       URL(fileURLWithPath: homePath, isDirectory: true)
                         .standardizedFileURL.resolvingSymlinksInPath()
                         == localRoot.standardizedFileURL.resolvingSymlinksInPath() {
                        return true
                    }
                    return agent.binding.hermesProfileSlug == native.nativeProfileName
                }
                return agent.binding.workspaceFolderPath.map {
                    URL(fileURLWithPath: $0, isDirectory: true)
                      .standardizedFileURL.resolvingSymlinksInPath()
                } == native.localRoot?.standardizedFileURL.resolvingSymlinksInPath()
            }) else { return native }
            let externalId = existing.binding.externalAgentId?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            guard !externalId.isEmpty else { return native }
            return native.replacingExternalId(externalId)
        }
    }

    private func nativeInventoryRequestBody(
        session: CloudRuntimeDeviceSession,
        agent: NativeRuntimeInventoryAgent
    ) throws -> [String: Any] {
        var body = agent.requestBody(includeDocuments: false)
        guard let row = try database.get(
            """
            SELECT capability_json
            FROM cloud_runtime_bindings
            WHERE runtime_device_id=? AND remote_binding_id=?
              AND owner_lease_state='active'
            ORDER BY updated_at DESC
            LIMIT 1
            """,
            [.text(session.localDeviceId), .text(agent.externalId)]
        ), let capabilityJSON = row["capability_json"]?.string,
           let data = capabilityJSON.data(using: .utf8),
           let capability = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let bindingEpoch = capability["bindingEpoch"] as? String,
           !bindingEpoch.isEmpty
        else { return body }
        body["bindingEpoch"] = bindingEpoch
        return body
    }

    private func applyNativeDocumentResponse(
        response: [String: Any],
        inventory: [NativeRuntimeInventoryAgent],
        session: CloudRuntimeDeviceSession
    ) throws {
        let conflicts = response["conflicts"] as? [[String: Any]] ?? []
        for agent in response["agents"] as? [[String: Any]] ?? [] {
            guard let externalId = agent["externalId"] as? String,
                  let native = inventory.first(where: { $0.externalId == externalId }),
                  let root = native.localRoot
            else { continue }
            for document in agent["documents"] as? [[String: Any]] ?? [] {
                guard let filename = document["filename"] as? String,
                      let objectId = document["objectId"] as? String
                else { continue }
                let folder = document["folder"] as? String ?? ""
                let conflicted = conflicts.contains {
                    $0["externalAgentId"] as? String == externalId
                        && ($0["folder"] as? String ?? "") == folder
                        && $0["filename"] as? String == filename
                }
                guard !conflicted else { continue }
                let deleted = document["deleted"] as? Bool ?? false
                if deleted {
                    try NativeRuntimeInventory.deleteDocument(
                        root: root,
                        folder: folder,
                        filename: filename
                    )
                } else {
                    guard let content = document["content"] as? String else { continue }
                    try NativeRuntimeInventory.writeDocumentAtomically(
                        root: root,
                        folder: folder,
                        filename: filename,
                        content: content
                    )
                }
                let serverVersion = String(
                    describing: document["serverVersion"] ?? "1"
                )
                let contentHash = deleted
                    ? nil
                    : document["contentHash"] as? String
                try database.run(
                    """
                    INSERT INTO native_document_sync_state(
                      runtime_device_id,runtime_type,external_agent_id,folder,filename,
                      object_id,server_version,content_hash,acknowledgement_pending,updated_at
                    ) VALUES(?,?,?,?,?,?,?,?,1,?)
                    ON CONFLICT(runtime_device_id,runtime_type,external_agent_id,folder,filename)
                    DO UPDATE SET object_id=excluded.object_id,
                      server_version=excluded.server_version,
                      content_hash=excluded.content_hash,
                      acknowledgement_pending=1,
                      updated_at=excluded.updated_at
                    """,
                    [
                        .text(session.localDeviceId),
                        .text(native.runtimeType.rawValue),
                        .text(externalId),
                        .text(folder),
                        .text(filename),
                        .text(objectId),
                        .text(serverVersion),
                        contentHash.map(SQLiteValue.text) ?? .null,
                        .text(nowIso()),
                    ]
                )
            }
        }
    }

    private func nativeDocumentRequestBodies(
        session: CloudRuntimeDeviceSession,
        agent: NativeRuntimeInventoryAgent,
        documents: [NativeRuntimeInventoryDocument],
        includeTombstones: Bool
    ) throws -> [[String: Any]] {
        var currentKeys = Set<String>()
        var bodies = try documents.map { document in
            currentKeys.insert("\(document.folder)\u{0}\(document.filename)")
            var body = document.requestBody
            if let state = try database.get(
                """
                SELECT object_id,server_version
                FROM native_document_sync_state
                WHERE runtime_device_id=? AND runtime_type=? AND external_agent_id=?
                  AND folder=? AND filename=?
                """,
                [
                    .text(session.localDeviceId),
                    .text(agent.runtimeType.rawValue),
                    .text(agent.externalId),
                    .text(document.folder),
                    .text(document.filename),
                ]
            ) {
                if let objectId = state["object_id"]?.string {
                    body["objectId"] = objectId
                }
                if let serverVersion = state["server_version"]?.string {
                    body["baseServerVersion"] = serverVersion
                }
            }
            return body
        }
        guard includeTombstones else { return bodies }
        let priorDocuments = try database.all(
            """
            SELECT folder,filename,object_id,server_version
            FROM native_document_sync_state
            WHERE runtime_device_id=? AND runtime_type=? AND external_agent_id=?
              AND content_hash IS NOT NULL
            """,
            [
                .text(session.localDeviceId),
                .text(agent.runtimeType.rawValue),
                .text(agent.externalId),
            ]
        )
        for row in priorDocuments {
            guard bodies.count < NativeRuntimeInventory.maximumDocuments else { break }
            guard let folder = row["folder"]?.string,
                  let filename = row["filename"]?.string,
                  let objectId = row["object_id"]?.string,
                  let serverVersion = row["server_version"]?.string,
                  !currentKeys.contains("\(folder)\u{0}\(filename)")
            else { continue }
            bodies.append([
                "folder": folder,
                "filename": filename,
                "objectId": objectId,
                "baseServerVersion": serverVersion,
                "deleted": true,
            ])
        }
        return bodies
    }

    private func pendingNativeDocumentAcknowledgements(
        session: CloudRuntimeDeviceSession,
        runtimeType: RuntimeType
    ) throws -> [[String: Any]] {
        try database.all(
            """
            SELECT object_id,server_version,content_hash
            FROM native_document_sync_state
            WHERE runtime_device_id=? AND runtime_type=?
              AND acknowledgement_pending=1
            ORDER BY external_agent_id,folder,filename
            LIMIT 2000
            """,
            [.text(session.localDeviceId), .text(runtimeType.rawValue)]
        ).compactMap { row in
            guard let objectId = row["object_id"]?.string,
                  let serverVersion = row["server_version"]?.string
            else { return nil }
            var acknowledgement: [String: Any] = [
                "objectId": objectId,
                "serverVersion": serverVersion,
                "status": "applied",
            ]
            if let contentHash = row["content_hash"]?.string {
                acknowledgement["contentHash"] = contentHash
            }
            return acknowledgement
        }
    }

    private func localObjectId(syncLinkForDevice deviceId: String, objectType: String, remoteId: String) throws -> String? {
        try database.get(
            "SELECT v.local_object_id FROM cloud_runtime_devices d JOIN remote_object_versions v ON v.sync_link_id=d.sync_link_id WHERE d.id=? AND v.object_type=? AND (v.canonical_object_id=? OR v.local_object_id=?)", [.text(deviceId), .text(objectType), .text(remoteId), .text(remoteId)])?[
                "local_object_id"]?.string
    }

    private func sendSocket(_ object: [String: Any]) async throws {
        guard let websocket else { throw RelayError(.internalError, "Runtime websocket is disconnected.") }
        let text = String(decoding: try JSONSerialization.data(withJSONObject: object), as: UTF8.self)
        try await websocket.send(.string(text))
    }

    private func receiveSocketLoop(session: CloudRuntimeDeviceSession, websocketBaseURL: URL) async {
        while !Task.isCancelled, let websocket {
            do {
                let frame = try await websocket.receive()
                let data: Data
                switch frame { case .string(let text): data = Data(text.utf8); case .data(let bytes): data = bytes; @unknown default: continue }
                guard let envelope = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { continue }
                let type = envelope["type"] as? String ?? ""
                let dispatch = (envelope["data"] as? [String: Any]) ?? (envelope["payload"] as? [String: Any]) ?? envelope
                if type == "clawchat.host.cron.list" {
                    await handleCronList(dispatch, session: session)
                    continue
                }
                if type == "agent.inventory.request" {
                    try? await synchronizeNativeInventory(session: session)
                    continue
                }
                if type == "marketplace.installHermesSkill" {
                    await handleMarketplaceHermesSkillInstall(dispatch, session: session)
                    continue
                }
                if type.hasPrefix("clawchat.attachment.upload.") {
                    await handleAttachmentControl(type: type, payload: dispatch, session: session)
                    continue
                }
                if type.contains("dispatch") || dispatch["dispatchId"] != nil { _ = try? await handle(dispatch: dispatch, session: session) }
                if type.contains("cancel"), let id = dispatch["dispatchId"] as? String { _ = try? await cancel(cloudDispatchId: id, session: session) }
                if type.contains("drain") || type.contains("revoked") { _ = try? database.run("UPDATE cloud_runtime_devices SET state=?,updated_at=? WHERE id=?", [.text(type.contains("revoked") ? "revoked" : "draining"), .text(nowIso()), .text(session.localDeviceId)]) }
            } catch {
                _ = try? database.run("UPDATE cloud_runtime_devices SET state='offline',updated_at=? WHERE id=?", [.text(nowIso()), .text(session.localDeviceId)])
                if Task.isCancelled { return }
                try? await Task.sleep(nanoseconds: 2_000_000_000)
                if let refreshed = try? await authenticate(localDeviceId: session.localDeviceId) { try? await connectWebSocket(session: refreshed, websocketBaseURL: websocketBaseURL) }
                return
            }
        }
    }

    private func handleAttachmentControl(
        type: String,
        payload: [String: Any],
        session: CloudRuntimeDeviceSession
    ) async {
        guard let requestId = payload["requestId"] as? String else { return }
        do {
            guard payload["workspaceId"] as? String == session.workspaceId else {
                throw RelayError(.permissionDenied, "Attachment workspace does not match this runtime host.")
            }
            switch type {
            case "clawchat.attachment.upload.init":
                let metadata = try attachmentStore.begin(payload)
                try await sendSocket([
                    "type": "clawchat.attachment.upload.init.result",
                    "data": [
                        "requestId": requestId,
                        "attachmentId": metadata.id,
                    ],
                ])
            case "clawchat.attachment.upload.chunk":
                let receivedBytes = try attachmentStore.appendChunk(payload)
                try await sendSocket([
                    "type": "clawchat.attachment.upload.chunk.result",
                    "data": [
                        "requestId": requestId,
                        "attachmentId": payload["attachmentId"] as? String ?? "",
                        "chunkIndex": payload["chunkIndex"] as? Int ?? 0,
                        "receivedBytes": receivedBytes,
                    ],
                ])
            case "clawchat.attachment.upload.complete":
                let completion = try attachmentStore.complete(payload)
                try await sendSocket([
                    "type": "clawchat.attachment.upload.complete.result",
                    "data": [
                        "requestId": requestId,
                        "id": completion.metadata.id,
                        "bridgeDeviceId": session.remoteDeviceId,
                        "filename": completion.metadata.filename,
                        "mimeType": completion.metadata.mimeType,
                        "sizeBytes": completion.metadata.sizeBytes,
                        "sha256": completion.sha256,
                        "kind": completion.metadata.kind,
                        "status": "uploaded",
                        "storage": "openclaw_local",
                        "localMediaRef": completion.localMediaRef,
                        "createdAt": completion.metadata.createdAt,
                    ],
                ])
            case "clawchat.attachment.upload.cancel":
                try attachmentStore.cancel(payload)
                try await sendSocket([
                    "type": "clawchat.attachment.upload.cancel.result",
                    "data": [
                        "requestId": requestId,
                        "attachmentId": payload["attachmentId"] as? String ?? "",
                    ],
                ])
            default:
                return
            }
        } catch {
            try? await sendSocket([
                "type": "clawchat.attachment.upload.error",
                "data": [
                    "requestId": requestId,
                    "error": error.localizedDescription,
                ],
            ])
        }
    }

    private func handleCronList(_ payload: [String: Any], session: CloudRuntimeDeviceSession) async {
        guard let requestId = payload["requestId"] as? String,
              let externalAgentId = payload["externalAgentId"] as? String
        else { return }
        do {
            guard let row = try database.get(
                "SELECT local_agent_id FROM cloud_runtime_bindings WHERE runtime_device_id=? AND remote_binding_id=? AND publication_state='published'",
                [.text(session.localDeviceId), .text(externalAgentId)]
            ), let localAgentId = row["local_agent_id"]?.string else {
                throw CloudRuntimeDeviceError.agentNotAssigned
            }
            if payload["scope"] as? String == "workspace" {
                let rows = try database.all(
                    "SELECT DISTINCT local_agent_id FROM cloud_runtime_bindings WHERE runtime_device_id=? AND publication_state='published'",
                    [.text(session.localDeviceId)]
                )
                var jobs: [[String: Any]] = []
                for row in rows {
                    guard let candidateId = row["local_agent_id"]?.string,
                          let candidate = try? data.getAgent(candidateId),
                          let inventory = try? await harnessInstall.nativeCronJobs(for: candidate),
                          let candidateJobs = inventory["jobs"] as? [[String: Any]]
                    else { continue }
                    jobs.append(contentsOf: candidateJobs.map { job in
                        job.merging([
                            "runtimeType": candidate.binding.runtimeType.rawValue,
                            "agentId": candidate.binding.externalAgentId ?? candidate.id,
                            "agentName": candidate.name
                        ]) { current, _ in current }
                    })
                }
                let result: [String: Any] = [
                    "runtimeType": "mixed",
                    "jobs": jobs,
                    "scheduler": ["available": true, "running": true, "message": "Workspace cron inventory"]
                ]
                try await sendSocket(["type": "clawchat.host.cron.list.result", "data": result.merging(["requestId": requestId]) { current, _ in current }])
                return
            }
            let result = try await harnessInstall.nativeCronJobs(for: data.getAgent(localAgentId))
            try await sendSocket(["type": "clawchat.host.cron.list.result", "data": result.merging(["requestId": requestId]) { current, _ in current }])
        } catch {
            try? await sendSocket(["type": "clawchat.host.cron.list.error", "data": ["requestId": requestId, "error": error.localizedDescription]])
        }
    }

    private func handleMarketplaceHermesSkillInstall(
        _ payload: [String: Any],
        session: CloudRuntimeDeviceSession
    ) async {
        guard let requestId = payload["requestId"] as? String,
              let agentId = payload["agentId"] as? String,
              let appSlug = payload["appSlug"] as? String
        else { return }
        do {
            guard payload["workspaceId"] as? String == session.workspaceId else {
                throw RelayError(.permissionDenied, "The Marketplace install workspace does not match this bridge.")
            }
            guard let discovered = await harnessInstall.nativeRuntimeInventorySnapshot(.hermes) else {
                throw RelayError(.notFound, "Hermes profiles are unavailable on this Mac.")
            }
            let inventory = try normalizedNativeInventory(
                discovered,
                session: session
            )
            guard
                  let agent = inventory.first(where: { $0.externalId == agentId }),
                  let profileRoot = agent.localRoot
            else {
                throw RelayError(.notFound, "The selected Hermes profile is not available on this Mac.")
            }
            let result = try MarketplaceHermesSkillInstaller.install(
                payload: payload,
                profileRoot: profileRoot
            )
            try await sendSocket([
                "type": "marketplace.installHermesSkill.result",
                "data": [
                    "requestId": requestId,
                    "status": "installed",
                    "agentId": result.agentId,
                    "appSlug": result.appSlug,
                    "installedFiles": result.installedFiles,
                    "skippedFiles": [],
                    "bridgeCapabilities": [MarketplaceHermesSkillInstaller.capability],
                ],
            ])
            try? await synchronizeNativeInventory(session: session)
        } catch {
            try? await sendSocket([
                "type": "marketplace.installHermesSkill.result",
                "data": [
                    "requestId": requestId,
                    "status": "failed",
                    "agentId": agentId,
                    "appSlug": appSlug,
                    "installedFiles": [],
                    "error": [
                        "code": "marketplace_hermes_skill_install_failed",
                        "message": error.localizedDescription,
                    ],
                ],
            ])
        }
    }

    private static func text(_ value: Any?, _ fallback: String = "") -> String { (value as? String).flatMap { $0.isEmpty ? nil : $0 } ?? fallback }

    private static func jsonRecords(_ value: Any?) -> [JSONRecord] {
        guard let rows = value as? [[String: Any]],
              let data = try? JSONSerialization.data(withJSONObject: rows),
              let records = try? jsonDecoder.decode([JSONRecord].self, from: data)
        else {
            return []
        }
        return records
    }
}

private final class CloudRuntimeEventPostbackSink: RuntimeEventSink, @unchecked Sendable {
    private let database: DatabaseService
    private let transport: RelayCloudTransport
    private let session: CloudRuntimeDeviceSession
    private let cloudDispatchId: String
    private let lock = NSLock()

    init(database: DatabaseService, transport: RelayCloudTransport, session: CloudRuntimeDeviceSession, cloudDispatchId: String) {
        self.database = database; self.transport = transport; self.session = session; self.cloudDispatchId = cloudDispatchId
    }

    func emit(_ event: RuntimeBridgeEvent) async {
        let sequence: Int = lock.withLock {
            let current = (try? database.get("SELECT last_event_sequence FROM cloud_dispatch_receipts WHERE cloud_dispatch_id=?", [.text(cloudDispatchId)])?["last_event_sequence"]?.int) ?? 0
            let next = current + 1
            _ = try? database.run("UPDATE cloud_dispatch_receipts SET last_event_sequence=?,state=?,updated_at=? WHERE cloud_dispatch_id=?", [.integer(Int64(next)), .text(event.type.rawValue), .text(nowIso()), .text(cloudDispatchId)])
            return next
        }
        let railwayType: String = switch event.type {
            case .queued: "dispatch.accepted";
            case .started: "run.started";
            case .status: "run.status";
            case .delta: "run.delta";
            case .thinking: "run.thinking";
            case .tool: "run.tool";
            case .context: "run.context";
            case .completed: "run.completed";
            case .failed: "run.failed";
            case .cancelled: "run.cancelled";
            case .healthChanged: "run.status"
        }
        var body: [String: Any] = ["type": railwayType, "seq": sequence, "timestamp": event.timestamp, "metadata": event.detail.mapValues(Self.foundation)]
        switch event.type {
        case .delta: body["text"] = event.text ?? ""
        case .thinking: body["thinking"] = event.text ?? ""; body["kind"] = "thinking"
        case .status, .healthChanged: body["code"] = event.status ?? "runtime_status"; body["message"] = event.text ?? event.status ?? "Runtime status changed"
        case .completed: body["finalText"] = event.text ?? ""
        case .failed: body["code"] = event.status ?? "runtime_failed"; body["message"] = event.text ?? "Runtime dispatch failed"; body["retryable"] = false
        case .queued, .started, .cancelled: break
        case .tool: body["toolName"] = event.detail["toolName"].map(Self.foundation) ?? "runtime_tool"; body["phase"] = event.status ?? "updated"; body["summary"] = event.text as Any? ?? NSNull()
        case .context: break
        }
        _ = try? await transport.send(method: "POST", path: "bridge/runtime-dispatches/\(cloudDispatchId)/events", body: body, accessToken: session.accessToken)
    }

    private static func foundation(_ value: JSONValue) -> Any {
        switch value { case .string(let value): value; case .number(let value): value; case .bool(let value): value; case .array(let values): values.map(foundation); case .object(let values): values.mapValues(foundation); case .null: NSNull() }
    }
}
