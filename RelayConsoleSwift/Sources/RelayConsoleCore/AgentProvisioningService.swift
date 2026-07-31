import Foundation

public struct CreateProvisionedAgentRequest: Sendable, Equatable {
    public var workspaceId: RelayId
    public var requestedByProfileId: RelayId?
    public var harnessId: RelayId?
    public var runtimeType: RuntimeType
    public var name: String
    public var role: String?
    public var externalAgentId: String?
    public var workspaceFolderPath: String?
    public var model: String?
    public var avatarReference: String?
    public var avatarState: AgentAvatarState?
    public var config: JSONRecord
    public var filesMetadata: JSONRecord

    public init(
        workspaceId: RelayId,
        requestedByProfileId: RelayId? = nil,
        harnessId: RelayId?,
        runtimeType: RuntimeType,
        name: String,
        role: String? = nil,
        externalAgentId: String? = nil,
        workspaceFolderPath: String? = nil,
        model: String? = nil,
        avatarReference: String? = nil,
        avatarState: AgentAvatarState? = nil,
        config: JSONRecord = [:],
        filesMetadata: JSONRecord = [:]
    ) {
        self.workspaceId = workspaceId
        self.requestedByProfileId = requestedByProfileId
        self.harnessId = harnessId
        self.runtimeType = runtimeType
        self.name = name
        self.role = role
        self.externalAgentId = externalAgentId
        self.workspaceFolderPath = workspaceFolderPath
        self.model = model
        self.avatarReference = avatarReference
        self.avatarState = avatarState
        self.config = config
        self.filesMetadata = filesMetadata
    }
}

public struct AgentProvisioningResult: Sendable, Equatable {
    public var job: AgentProvisioningJob
    public var agent: AgentWithBinding
}

public final class AgentProvisioningService {
    private let data: LocalDataService
    private let harnessInstall: HarnessInstallManager

    public init(data: LocalDataService, harnessInstall: HarnessInstallManager) {
        self.data = data
        self.harnessInstall = harnessInstall
    }

    public func createProvisionedAgent(_ request: CreateProvisionedAgentRequest) async throws -> AgentProvisioningResult {
        let name = try requireNonEmptyString(request.name, field: "Agent name", maxLength: 120)
        let role = try optionalTrimmedString(request.role, field: "Role", maxLength: 1000)
        let externalAgentId = try normalizedExternalAgentId(request.externalAgentId, fallbackName: name)
        let workspaceFolderPath = try optionalTrimmedString(request.workspaceFolderPath, field: "Workspace folder", maxLength: 2000)
        let resolvedModel = try HarnessModelSelectionService.resolve(request.model, for: request.runtimeType)
        let job = try data.createAgentProvisioningJob(
            workspaceId: request.workspaceId,
            requestedByProfileId: request.requestedByProfileId,
            harnessId: request.harnessId,
            runtimeType: request.runtimeType,
            externalAgentId: externalAgentId,
            payload: queuedPayload(request: request, name: name, role: role, externalAgentId: externalAgentId, workspaceFolderPath: workspaceFolderPath),
            filesMetadata: request.filesMetadata
        )
        var createdAgent: AgentWithBinding?

        do {
            guard let harnessId = request.harnessId else {
                let relay = RelayError(.harnessMissing, runtimeMissingMessage(request.runtimeType))
                try failJob(job, status: .missingHarness, stage: "awaiting_harness", relay: relay, createdAgent: nil)
                throw relay
            }

            let harness = try data.getHarness(harnessId)
            guard harness.runtimeType == request.runtimeType else {
                let relay = RelayError(.invalidInput, "Selected harness does not match the requested runtime.")
                try failJob(job, status: .failed, stage: "validate_harness", relay: relay, createdAgent: nil)
                throw relay
            }

            let health = await harnessInstall.getHealthFromHarnessConfig(harnessId: harness.id, config: harness.config)
            guard health.status == .healthy else {
                let status = provisioningStatus(for: health.status)
                let relay = RelayError(
                    health.status == .missing ? .harnessMissing : .harnessUnhealthy,
                    health.message
                )
                try failJob(job, status: status, stage: healthStage(for: health.status), relay: relay, createdAgent: nil)
                throw relay
            }

            if try data.runtimeBindingExists(harnessId: harness.id, externalAgentId: externalAgentId) {
                let relay = RelayError(.invalidInput, "An agent with this external id already exists for \(harness.displayName).")
                try failJob(job, status: .duplicateId, stage: "duplicate_id", relay: relay, createdAgent: nil, extraError: [
                    "externalAgentId": .string(externalAgentId),
                    "harnessId": .string(harness.id)
                ])
                throw relay
            }

            _ = try data.updateAgentProvisioningJob(
                jobId: job.id,
                status: .running,
                stage: "creating_relay_agent",
                message: "Creating Relay agent identity.",
                error: nil
            )

            let agent = try data.createAgent(
                workspaceId: request.workspaceId,
                name: name,
                description: role,
                model: resolvedModel.selected,
                harnessId: harness.id,
                externalAgentId: externalAgentId,
                workspaceFolderPath: workspaceFolderPath,
                config: request.config.merging([
                    "provisioningJobId": .string(job.id),
                    "runtimeType": .string(request.runtimeType.rawValue),
                    "model": .string(resolvedModel.selected),
                    "modelFallbackApplied": .bool(resolvedModel.fallbackApplied)
                ]) { current, _ in current }
            )
            createdAgent = try data.setAgentProvisioningStatus(agentId: agent.id, status: .running)
            if let avatarReference = request.avatarReference,
               let avatarState = request.avatarState {
                _ = try data.saveAgentAvatarPreference(
                    agentId: agent.id,
                    avatarReference: avatarReference,
                    avatarState: avatarState
                )
            }
            _ = try data.updateAgentProvisioningJob(
                jobId: job.id,
                status: .running,
                stage: request.runtimeType == .hermes ? "preparing_hermes_profile" : "preparing_openclaw_workspace",
                message: request.runtimeType == .hermes ? "Preparing Hermes profile identity." : "Preparing OpenClaw agent workspace.",
                error: nil,
                createdAgentId: agent.id,
                runtimeBindingId: agent.binding.id,
                externalAgentId: externalAgentId
            )

            let provisioned = request.runtimeType == .hermes
                ? try await harnessInstall.ensureHermesAgentProfile(agent)
                : try await harnessInstall.ensureOpenClawAgentProvisioned(agent)
            let completedAgent = try data.setAgentProvisioningStatus(agentId: provisioned.id, status: .completed)
            let completedPayload = completionPayload(requestPayload: job.payload, agent: completedAgent)
            let completedJob = try data.updateAgentProvisioningJob(
                jobId: job.id,
                status: .completed,
                stage: "completed",
                message: "Provisioning completed.",
                error: nil,
                createdAgentId: completedAgent.id,
                runtimeBindingId: completedAgent.binding.id,
                externalAgentId: completedAgent.binding.externalAgentId ?? externalAgentId,
                payload: completedPayload,
                filesMetadata: request.filesMetadata
            )
            _ = try? data.log(severity: "info", category: "agents", message: "Agent provisioning completed.", harnessId: harness.id, detail: [
                "jobId": .string(completedJob.id),
                "agentId": .string(completedAgent.id),
                "runtimeBindingId": .string(completedAgent.binding.id),
                "runtimeType": .string(completedAgent.binding.runtimeType.rawValue)
            ])
            return AgentProvisioningResult(job: completedJob, agent: completedAgent)
        } catch {
            let relay = relayError(error)
            if let createdAgent, !isTerminalStatus(try? data.getAgentProvisioningJob(job.id).status) {
                _ = try? failJob(job, status: provisioningStatus(for: relay), stage: failureStage(for: relay), relay: relay, createdAgent: createdAgent)
            }
            throw relay
        }
    }

    @discardableResult
    private func failJob(
        _ job: AgentProvisioningJob,
        status: AgentProvisioningStatus,
        stage: String,
        relay: RelayError,
        createdAgent: AgentWithBinding?,
        extraError: JSONRecord = [:]
    ) throws -> AgentProvisioningJob {
        if let createdAgent {
            _ = try? data.setAgentProvisioningStatus(agentId: createdAgent.id, status: status)
        }
        var error: JSONRecord = [
            "code": .string(relay.code.rawValue),
            "message": .string(relay.message),
            "recoverable": .bool(status != .duplicateId)
        ]
        for (key, value) in extraError {
            error[key] = value
        }
        let updated = try data.updateAgentProvisioningJob(
            jobId: job.id,
            status: status,
            stage: stage,
            message: relay.message,
            error: error,
            createdAgentId: createdAgent?.id,
            runtimeBindingId: createdAgent?.binding.id,
            externalAgentId: createdAgent?.binding.externalAgentId ?? job.externalAgentId
        )
        _ = try? data.log(severity: "error", category: "agents", message: "Agent provisioning failed.", harnessId: job.harnessId, detail: [
            "jobId": .string(job.id),
            "status": .string(updated.status.rawValue),
            "errorCode": .string(relay.code.rawValue)
        ])
        return updated
    }

    private func normalizedExternalAgentId(_ externalAgentId: String?, fallbackName: String) throws -> String {
        let explicit = try optionalTrimmedString(externalAgentId, field: "External agent ID", maxLength: 160)
        let slug = slugifyAgentId(explicit ?? fallbackName)
        return slug.isEmpty ? "relay_agent" : slug
    }

    private func queuedPayload(
        request: CreateProvisionedAgentRequest,
        name: String,
        role: String?,
        externalAgentId: String,
        workspaceFolderPath: String?
    ) -> JSONRecord {
        [
            "requestedName": .string(name),
            "roleProvided": .bool(role != nil),
            "requestedExternalAgentId": .string(externalAgentId),
            "runtimeType": .string(request.runtimeType.rawValue),
            "workspaceFolderProvided": .bool(workspaceFolderPath != nil),
            "requestedModel": request.model.map(JSONValue.string) ?? .null,
            "config": .object(request.config)
        ]
    }

    private func completionPayload(requestPayload: JSONRecord, agent: AgentWithBinding) -> JSONRecord {
        var payload = requestPayload
        payload["relayAgentId"] = .string(agent.id)
        payload["runtimeBindingId"] = .string(agent.binding.id)
        payload["runtimeExternalAgentId"] = agent.binding.externalAgentId.map(JSONValue.string) ?? .null
        switch agent.binding.runtimeType {
        case .hermes:
            payload["hermesProfileSlug"] = agent.binding.hermesProfileSlug.map(JSONValue.string) ?? .null
            payload["hermesHomeRecorded"] = .bool(agent.binding.hermesHomePath != nil)
            payload["hermesIdentityFileRecorded"] = .bool(agent.binding.hermesIdentityFilePath != nil)
        case .openclaw:
            payload["openclawAgentId"] = agent.binding.externalAgentId.map(JSONValue.string) ?? .null
            payload["openclawWorkspaceRecorded"] = .bool(agent.binding.workspaceFolderPath != nil)
            payload["openclawStateDirRecorded"] = boolMetadata(agent.binding.config["openclawStateDir"])
            payload["openclawAgentDirRecorded"] = boolMetadata(agent.binding.config["openclawAgentDir"])
        default:
            break
        }
        return payload
    }

    private func boolMetadata(_ value: JSONValue?) -> JSONValue {
        stringValue(value)?.isEmpty == false ? .bool(true) : .bool(false)
    }

    private func provisioningStatus(for healthStatus: HarnessHealthStatus) -> AgentProvisioningStatus {
        switch healthStatus {
        case .missing:
            return .missingHarness
        case .authRequired:
            return .authRequired
        default:
            return .failed
        }
    }

    private func provisioningStatus(for relay: RelayError) -> AgentProvisioningStatus {
        switch relay.code {
        case .harnessMissing:
            return .missingHarness
        case .harnessUnhealthy where relay.message.localizedCaseInsensitiveContains("connect openai"):
            return .authRequired
        case .invalidInput where relay.message.localizedCaseInsensitiveContains("external id"):
            return .duplicateId
        default:
            return .failed
        }
    }

    private func healthStage(for healthStatus: HarnessHealthStatus) -> String {
        switch healthStatus {
        case .missing:
            return "awaiting_harness"
        case .authRequired:
            return "auth_required"
        default:
            return "harness_unhealthy"
        }
    }

    private func failureStage(for relay: RelayError) -> String {
        switch provisioningStatus(for: relay) {
        case .missingHarness:
            return "awaiting_harness"
        case .authRequired:
            return "auth_required"
        case .duplicateId:
            return "duplicate_id"
        default:
            return "failed"
        }
    }

    private func runtimeMissingMessage(_ runtimeType: RuntimeType) -> String {
        runtimeType == .openclaw ? "OpenClaw is not installed." : "Hermes Agent is not installed."
    }

    private func isTerminalStatus(_ status: AgentProvisioningStatus?) -> Bool {
        guard let status else { return false }
        switch status {
        case .completed, .failed, .cancelled, .authRequired, .missingHarness, .duplicateId:
            return true
        case .queued, .running:
            return false
        }
    }
}
