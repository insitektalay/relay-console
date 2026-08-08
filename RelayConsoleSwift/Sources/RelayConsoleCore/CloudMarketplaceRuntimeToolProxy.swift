import Foundation

public struct CloudMarketplaceLocalDispatchSession: Sendable {
    public var transport: RelayCloudTransport
    public var accessToken: String
    public var remoteWorkspaceId: String
    public var remoteAgentIds: [String: String]

    public init(
        transport: RelayCloudTransport,
        accessToken: String,
        remoteWorkspaceId: String,
        remoteAgentIds: [String: String]
    ) {
        self.transport = transport
        self.accessToken = accessToken
        self.remoteWorkspaceId = remoteWorkspaceId
        self.remoteAgentIds = remoteAgentIds
    }
}

public final class CloudMarketplaceRuntimeToolProxy: @unchecked Sendable {
    private final class ResultBox<Value>: @unchecked Sendable {
        private let lock = NSLock()
        private var storage: Result<Value, Error>?

        func set(_ value: Result<Value, Error>) {
            lock.lock()
            storage = value
            lock.unlock()
        }

        func get() -> Result<Value, Error>? {
            lock.lock()
            defer { lock.unlock() }
            return storage
        }
    }

    private struct Context {
        var executionTargetId: String
        var endpointPlaceholder: String
        var wrapsLocalDispatch: Bool
        var workspaceId: String
        var agentId: String
        var tools: [String: JSONRecord]
        var transport: RelayCloudTransport
        var accessToken: String
        var expectedEndpointPrefix: String
        var expectedTransport: String
        var requiredAccessTokenFlag: String
    }

    private struct BridgeSession {
        var transport: RelayCloudTransport
        var accessToken: String
        var remoteAgentIds: [String: String]
    }

    private let lock = NSLock()
    private var contexts: [String: Context] = [:]
    private var bridgeSession: BridgeSession?
    private var localDispatchSessionLoader:
        (@Sendable (String) async throws -> CloudMarketplaceLocalDispatchSession)?

    public init() {}

    public func register(
        localDispatchId: String,
        cloudDispatchId: String,
        workspaceId: String,
        agentId: String,
        tools: [JSONRecord],
        transport: RelayCloudTransport,
        accessToken: String
    ) {
        let indexed = tools.reduce(into: [String: JSONRecord]()) { result, tool in
            for name in Self.toolNames(tool) {
                result[name] = tool
            }
        }
        guard !indexed.isEmpty else { return }
        lock.lock()
        contexts[localDispatchId] = Context(
            executionTargetId: cloudDispatchId,
            endpointPlaceholder: "{dispatchId}",
            wrapsLocalDispatch: false,
            workspaceId: workspaceId,
            agentId: agentId,
            tools: indexed,
            transport: transport,
            accessToken: accessToken,
            expectedEndpointPrefix:
                "/api/v1/bridge/runtime-dispatches/{dispatchId}/marketplace-tools/",
            expectedTransport: "clawchat_bridge_marketplace_tool",
            requiredAccessTokenFlag: "requiresBridgeAccessToken"
        )
        lock.unlock()
    }

    public func configureBridgeSession(
        transport: RelayCloudTransport,
        accessToken: String,
        remoteAgentIds: [String: String]
    ) {
        lock.lock()
        bridgeSession = BridgeSession(
            transport: transport,
            accessToken: accessToken,
            remoteAgentIds: remoteAgentIds
        )
        lock.unlock()
    }

    public func setRemoteAgentId(_ remoteAgentId: String, for localAgentId: String) {
        lock.lock()
        bridgeSession?.remoteAgentIds[localAgentId] = remoteAgentId
        lock.unlock()
    }

    public func clearBridgeSession() {
        lock.lock()
        bridgeSession = nil
        lock.unlock()
    }

    public func setLocalDispatchSessionLoader(
        _ loader: @escaping @Sendable (String) async throws
            -> CloudMarketplaceLocalDispatchSession
    ) {
        lock.withLock {
            localDispatchSessionLoader = loader
        }
    }

    public func prepareLocalDispatch(
        localDispatchId: String,
        workspaceId: String,
        localAgentId: String
    ) async throws -> [JSONRecord] {
        let loader = lock.withLock { localDispatchSessionLoader }
        let currentBridgeSession = lock.withLock { bridgeSession }
        let localSession: CloudMarketplaceLocalDispatchSession?
        if let loader {
            do {
                localSession = try await loader(workspaceId)
            } catch {
                guard currentBridgeSession != nil else { throw error }
                localSession = nil
            }
        } else {
            localSession = nil
        }
        guard localSession != nil || currentBridgeSession != nil else {
            throw RelayError(
                .dispatchFailed,
                "RAILWAY_TOOL_DELIVERY_FAILED: No authenticated Railway session is available."
            )
        }
        let remoteAgentIds = localSession?.remoteAgentIds
            ?? currentBridgeSession?.remoteAgentIds
            ?? [:]
        guard let remoteAgentId = remoteAgentIds[localAgentId],
              !remoteAgentId.isEmpty else {
            throw RelayError(
                .dispatchFailed,
                "RAILWAY_ASSIGNMENT_MISSING: This local agent has no active Railway agent mapping."
            )
        }
        guard let encodedAgentId = remoteAgentId.addingPercentEncoding(
            withAllowedCharacters: .urlPathAllowed
        ) else {
            throw RelayError(.invalidInput, "The Railway runtime agent identifier is invalid.")
        }
        let transport: RelayCloudTransport
        let accessToken: String
        let path: String
        let expectedEndpointPrefix: String
        let expectedTransport: String
        let requiredAccessTokenFlag: String
        if let localSession {
            guard let encodedWorkspaceId = localSession.remoteWorkspaceId.addingPercentEncoding(
                withAllowedCharacters: .urlPathAllowed
            ) else {
                throw RelayError(.invalidInput, "The Railway workspace identifier is invalid.")
            }
            transport = localSession.transport
            accessToken = localSession.accessToken
            path =
                "workspaces/\(encodedWorkspaceId)/marketplace/agents/\(encodedAgentId)/runtime-tools"
            expectedEndpointPrefix =
                "/api/v1/workspaces/\(encodedWorkspaceId)/marketplace/agents/{agentId}/runtime-tools/"
            expectedTransport = "clawchat_control_plane_marketplace_tool"
            requiredAccessTokenFlag = "requiresUserAccessToken"
        } else if let currentBridgeSession {
            transport = currentBridgeSession.transport
            accessToken = currentBridgeSession.accessToken
            path = "bridge/agents/\(encodedAgentId)/marketplace-tools"
            expectedEndpointPrefix = "/api/v1/bridge/agents/{agentId}/marketplace-tools/"
            expectedTransport = "clawchat_bridge_marketplace_tool"
            requiredAccessTokenFlag = "requiresBridgeAccessToken"
        } else {
            throw RelayError(
                .dispatchFailed,
                "RAILWAY_TOOL_DELIVERY_FAILED: No authenticated Railway session is available."
            )
        }
        let response = try await transport.send(
            method: "GET",
            path: path,
            body: nil,
            accessToken: accessToken
        )
        let tools = try (response["tools"] as? [[String: Any]] ?? []).map(Self.jsonRecord)
        let indexed = tools.reduce(into: [String: JSONRecord]()) { result, tool in
            for name in Self.toolNames(tool) {
                result[name] = tool
            }
        }
        guard !indexed.isEmpty else { return tools }
        lock.withLock {
            contexts[localDispatchId] = Context(
                executionTargetId: remoteAgentId,
                endpointPlaceholder: "{agentId}",
                wrapsLocalDispatch: true,
                workspaceId: workspaceId,
                agentId: localAgentId,
                tools: indexed,
                transport: transport,
                accessToken: accessToken,
                expectedEndpointPrefix: expectedEndpointPrefix,
                expectedTransport: expectedTransport,
                requiredAccessTokenFlag: requiredAccessTokenFlag
            )
        }
        return tools
    }

    public func unregister(localDispatchId: String) {
        lock.lock()
        contexts.removeValue(forKey: localDispatchId)
        lock.unlock()
    }

    public func hasTool(
        localDispatchId: String?,
        toolName: String,
        runtime: MarketplaceRuntimeToolExecutionContext
    ) -> Bool {
        guard let localDispatchId else { return false }
        return resolvedContext(
            localDispatchId: localDispatchId,
            toolName: toolName,
            runtime: runtime
        ) != nil
    }

    public func execute(
        localDispatchId: String,
        toolName: String,
        payload: JSONRecord,
        runtime: MarketplaceRuntimeToolExecutionContext
    ) throws -> JSONRecord {
        guard let resolved = resolvedContext(
            localDispatchId: localDispatchId,
            toolName: toolName,
            runtime: runtime
        ) else {
            throw RelayError(.notFound, "The Railway Marketplace tool is not mounted for this dispatch.")
        }
        let context = resolved.context
        let tool = resolved.tool
        guard runtime.workspaceId == context.workspaceId,
              runtime.agentId == context.agentId
        else {
            throw RelayError(.permissionDenied, "The Railway Marketplace tool context does not match this runtime.")
        }
        guard case .object(let execution)? = tool["execution"],
              execution["transport"]?.string == context.expectedTransport,
              execution[context.requiredAccessTokenFlag]?.bool == true,
              let endpointTemplate = execution["endpointBasePath"]?.string,
              endpointTemplate.hasPrefix(context.expectedEndpointPrefix)
        else {
            throw RelayError(.permissionDenied, "The Railway Marketplace tool endpoint is not allowlisted.")
        }
        let absoluteEndpointBase = endpointTemplate.replacingOccurrences(
            of: context.endpointPlaceholder,
            with: context.executionTargetId
        )
        let endpointBase = absoluteEndpointBase.hasPrefix("/api/v1/")
            ? String(absoluteEndpointBase.dropFirst("/api/v1/".count))
            : absoluteEndpointBase
        let executableName = tool["functionName"]?.string ?? toolName
        guard let encodedName = executableName.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed),
              !encodedName.isEmpty
        else {
            throw RelayError(.invalidInput, "The Railway Marketplace tool name is invalid.")
        }
        let arguments = try Self.foundationObject(payload)
        let body: [String: Any] = context.wrapsLocalDispatch
            ? [
                "arguments": arguments,
                "localDispatchId": resolved.localDispatchId,
            ]
            : arguments
        do {
            return try Self.executeRequest(
                context: context,
                endpointBase: endpointBase,
                encodedName: encodedName,
                body: body
            )
        } catch let error as RelayError
            where error.code == .permissionDenied
                && context.expectedTransport == "clawchat_control_plane_marketplace_tool"
        {
            guard let loader = lock.withLock({ localDispatchSessionLoader }) else {
                throw error
            }
            let refreshed = try Self.waitForResult {
                try await loader(context.workspaceId)
            }
            guard refreshed.remoteAgentIds[context.agentId] == context.executionTargetId,
                  let encodedWorkspaceId = refreshed.remoteWorkspaceId.addingPercentEncoding(
                    withAllowedCharacters: .urlPathAllowed
                  ),
                  context.expectedEndpointPrefix
                    == "/api/v1/workspaces/\(encodedWorkspaceId)/marketplace/agents/{agentId}/runtime-tools/"
            else {
                throw RelayError(
                    .permissionDenied,
                    "The refreshed Railway session does not match this runtime dispatch."
                )
            }
            var refreshedContext = context
            refreshedContext.transport = refreshed.transport
            refreshedContext.accessToken = refreshed.accessToken
            lock.withLock {
                contexts[resolved.localDispatchId] = refreshedContext
            }
            return try Self.executeRequest(
                context: refreshedContext,
                endpointBase: endpointBase,
                encodedName: encodedName,
                body: body
            )
        }
    }

    private func resolvedContext(
        localDispatchId: String,
        toolName: String,
        runtime: MarketplaceRuntimeToolExecutionContext
    ) -> (localDispatchId: String, context: Context, tool: JSONRecord)? {
        lock.withLock {
            if let context = contexts[localDispatchId],
               let tool = context.tools[toolName] {
                return (localDispatchId, context, tool)
            }

            let activeMatches = contexts.compactMap {
                (candidateDispatchId, context)
                -> (localDispatchId: String, context: Context, tool: JSONRecord)? in
                guard context.workspaceId == runtime.workspaceId,
                      context.agentId == runtime.agentId,
                      let tool = context.tools[toolName]
                else {
                    return nil
                }
                return (candidateDispatchId, context, tool)
            }
            guard activeMatches.count == 1 else {
                return nil
            }
            return activeMatches[0]
        }
    }

    private static func toolNames(_ tool: JSONRecord) -> [String] {
        var names = [
            tool["name"]?.string,
            tool["functionName"]?.string,
        ].compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        if case .array(let aliases)? = tool["aliases"] {
            names.append(contentsOf: aliases.compactMap(\.string))
        }
        return Array(Set(names))
    }

    private static func executeRequest(
        context: Context,
        endpointBase: String,
        encodedName: String,
        body: [String: Any]
    ) throws -> JSONRecord {
        try waitForResult {
            let response = try await context.transport.send(
                method: "POST",
                path: "\(endpointBase)/\(encodedName)",
                body: body,
                accessToken: context.accessToken
            )
            return try jsonRecord(response)
        }
    }

    private static func waitForResult<Value>(
        _ operation: @escaping @Sendable () async throws -> Value
    ) throws -> Value {
        let semaphore = DispatchSemaphore(value: 0)
        let result = ResultBox<Value>()
        Task {
            let completed: Result<Value, Error>
            do {
                completed = .success(try await operation())
            } catch {
                completed = .failure(error)
            }
            result.set(completed)
            semaphore.signal()
        }
        guard semaphore.wait(timeout: .now() + 125) == .success else {
            throw RelayError(.dispatchFailed, "The Railway Marketplace tool request timed out.")
        }
        let completed = result.get()
        guard let completed else {
            throw RelayError(.internalError, "The Railway Marketplace tool returned no result.")
        }
        return try completed.get()
    }

    private static func foundationObject(_ record: JSONRecord) throws -> [String: Any] {
        let data = try jsonEncoder.encode(record)
        guard let object = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw RelayError(.invalidInput, "The Railway Marketplace tool payload is invalid.")
        }
        return object
    }

    private static func jsonRecord(_ object: [String: Any]) throws -> JSONRecord {
        let data = try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys])
        return try jsonDecoder.decode(JSONRecord.self, from: data)
    }
}
