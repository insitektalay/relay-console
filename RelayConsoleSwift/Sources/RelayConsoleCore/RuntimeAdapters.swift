import Foundation

public final class HermesAgentAdapter: DesktopRuntimeBridge {
    public let runtimeType: RuntimeType = .hermes
    public let adapterId = "hermes-agent-external"
    public let displayName = "Hermes Agent"
    private let installManager: HarnessInstallManager

    public init(installManager: HarnessInstallManager) {
        self.installManager = installManager
    }

    public func getHealth(harnessId: String, config: JSONRecord) async -> HarnessHealth {
        await installManager.getHealthFromHarnessConfig(harnessId: harnessId, config: config)
    }

    public func getCapabilities(harnessId: String, config: JSONRecord) async -> RuntimeCapabilities {
        RuntimeCapabilities(
            runtimeType: .hermes,
            supportsStreaming: true,
            supportsCancellation: true,
            supportsSessions: true,
            supportsTools: true,
            requiresWorkspaceFolder: false,
            requiresSecret: false,
            maxConcurrentDispatches: 1,
            eventTypes: [.queued, .started, .status, .delta, .tool, .completed, .failed, .cancelled]
        )
    }

    public func dispatchTurn(_ request: RuntimeDispatchRequest, sink: RuntimeEventSink) async -> RuntimeDispatchTerminalResult {
        await sink.emit(bridgeEvent(request, .status, status: "Connecting to Hermes Agent"))
        return await installManager.dispatchHermes(request, sink: sink)
    }

    public func cancelDispatch(dispatchId: String, correlationId: String) async -> CancelRuntimeDispatchResult {
        await installManager.cancelHermes(dispatchId: dispatchId)
            ? CancelRuntimeDispatchResult(status: "cancelled", message: "Cancel requested.")
            : CancelRuntimeDispatchResult(status: "already_terminal", message: "No active Hermes Agent run found.")
    }

    public func resolveApproval(
        dispatchId: String,
        correlationId: String,
        decision: RuntimeApprovalDecision
    ) async -> Bool {
        await installManager.resolveHermesApproval(
            dispatchId: dispatchId,
            decision: decision
        )
    }
}

public final class OpenClawAdapter: DesktopRuntimeBridge {
    public let runtimeType: RuntimeType = .openclaw
    public let adapterId = "openclaw-external"
    public let displayName = "OpenClaw"
    private let installManager: HarnessInstallManager

    public init(installManager: HarnessInstallManager) {
        self.installManager = installManager
    }

    public func getHealth(harnessId: String, config: JSONRecord) async -> HarnessHealth {
        await installManager.getHealthFromHarnessConfig(harnessId: harnessId, config: config)
    }

    public func getCapabilities(harnessId: String, config: JSONRecord) async -> RuntimeCapabilities {
        RuntimeCapabilities(
            runtimeType: .openclaw,
            supportsStreaming: false,
            supportsCancellation: true,
            supportsSessions: true,
            supportsTools: true,
            requiresWorkspaceFolder: false,
            requiresSecret: false,
            maxConcurrentDispatches: 1,
            eventTypes: [.queued, .started, .status, .completed, .failed]
        )
    }

    public func dispatchTurn(_ request: RuntimeDispatchRequest, sink: RuntimeEventSink) async -> RuntimeDispatchTerminalResult {
        await installManager.dispatchOpenClaw(request, sink: sink)
    }

    public func cancelDispatch(dispatchId: String, correlationId: String) async -> CancelRuntimeDispatchResult {
        installManager.cancelOpenClaw(dispatchId: dispatchId)
            ? CancelRuntimeDispatchResult(status: "cancelled", message: "Cancel requested.")
            : CancelRuntimeDispatchResult(status: "already_terminal", message: "No active OpenClaw run found.")
    }
}
