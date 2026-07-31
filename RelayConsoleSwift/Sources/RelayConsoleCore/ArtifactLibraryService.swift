import Foundation

public enum AgentArtifactKind: String, Codable, CaseIterable, Sendable, Identifiable {
    case document
    case image
    case video
    case audio
    case data
    case folder
    case unknown

    public var id: String { rawValue }
}

public enum AgentArtifactSourceKind: String, Codable, Sendable {
    case relayManaged = "relay_managed"
    case workspace
    case cronOutput = "cron_output"
    case cronDocument = "cron_document"
    case external
}

public enum AgentArtifactPresentationState: String, Codable, Sendable {
    case available
    case unavailable
    case moved
    case expired
    case deleted
    case permissionDenied = "permission_denied"

    public var label: String {
        switch self {
        case .available: return "Available"
        case .unavailable: return "Unavailable"
        case .moved: return "Moved"
        case .expired: return "Expired"
        case .deleted: return "Deleted"
        case .permissionDenied: return "Permission denied"
        }
    }

    public var title: String {
        switch self {
        case .available: return "Available on source"
        case .unavailable: return "Artifact unavailable"
        case .moved: return "Artifact moved"
        case .expired: return "Artifact expired"
        case .deleted: return "Artifact deleted"
        case .permissionDenied: return "Permission denied"
        }
    }

    public var defaultReason: String {
        switch self {
        case .available:
            return "The source reports that this artifact is available."
        case .unavailable:
            return "The source device is offline or has stopped reporting."
        case .moved:
            return "The source reports this artifact at a new path."
        case .expired:
            return "The source link or retained artifact has expired."
        case .deleted:
            return "The source no longer reports this artifact."
        case .permissionDenied:
            return "Relay no longer has permission to reach this artifact."
        }
    }

    public var allowsOpen: Bool {
        self == .available || self == .moved
    }
}

public enum AgentCronJobSourceKind: String, Codable, Sendable {
    case hermesJobsFile = "hermes_jobs_file"
    case openClawNative = "openclaw_native"
    case systemCrontab = "system_crontab"
    case documentDeclared = "document_declared"
}

public struct AgentArtifactRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var title: String
    public var kind: AgentArtifactKind
    public var sourceKind: AgentArtifactSourceKind
    public var path: String
    public var relativePath: String?
    public var directoryPath: String?
    public var fileExtension: String?
    public var externalURL: String?
    public var externalProvider: String?
    public var byteCount: Int?
    public var updatedAt: IsoTimestamp?
    public var agentId: RelayId?
    public var agentName: String?
    public var agentAvatarURL: String?
    public var cronJobId: RelayId?
    public var cronJobName: String?
    public var content: String?
    public var preview: String?
    public var isReadableText: Bool
    public var harnessId: String?
    public var harnessType: String?
    public var harnessLabel: String?
    public var cloudArtifactId: RelayId?
    public var sourceMachineId: String?
    public var sourceMachineLabel: String?
    public var sourcePlatform: String?
    public var sourceHealth: String?
    public var sourceLastSeenAt: IsoTimestamp?
    public var presentationState: AgentArtifactPresentationState?
    public var presentationReason: String?
    public var storedLocally: Bool?

    public init(
        id: RelayId,
        title: String,
        kind: AgentArtifactKind,
        sourceKind: AgentArtifactSourceKind,
        path: String,
        relativePath: String? = nil,
        directoryPath: String? = nil,
        fileExtension: String? = nil,
        externalURL: String? = nil,
        externalProvider: String? = nil,
        byteCount: Int? = nil,
        updatedAt: IsoTimestamp? = nil,
        agentId: RelayId? = nil,
        agentName: String? = nil,
        agentAvatarURL: String? = nil,
        cronJobId: RelayId? = nil,
        cronJobName: String? = nil,
        content: String? = nil,
        preview: String? = nil,
        isReadableText: Bool,
        harnessId: String? = nil,
        harnessType: String? = nil,
        harnessLabel: String? = nil,
        cloudArtifactId: RelayId? = nil,
        sourceMachineId: String? = nil,
        sourceMachineLabel: String? = nil,
        sourcePlatform: String? = nil,
        sourceHealth: String? = nil,
        sourceLastSeenAt: IsoTimestamp? = nil,
        presentationState: AgentArtifactPresentationState? = .available,
        presentationReason: String? = nil,
        storedLocally: Bool? = nil
    ) {
        self.id = id
        self.title = title
        self.kind = kind
        self.sourceKind = sourceKind
        self.path = path
        self.relativePath = relativePath
        self.directoryPath = directoryPath
        self.fileExtension = fileExtension
        self.externalURL = externalURL
        self.externalProvider = externalProvider
        self.byteCount = byteCount
        self.updatedAt = updatedAt
        self.agentId = agentId
        self.agentName = agentName
        self.agentAvatarURL = agentAvatarURL
        self.cronJobId = cronJobId
        self.cronJobName = cronJobName
        self.content = content
        self.preview = preview
        self.isReadableText = isReadableText
        self.harnessId = harnessId
        self.harnessType = harnessType
        self.harnessLabel = harnessLabel
        self.cloudArtifactId = cloudArtifactId
        self.sourceMachineId = sourceMachineId
        self.sourceMachineLabel = sourceMachineLabel
        self.sourcePlatform = sourcePlatform
        self.sourceHealth = sourceHealth
        self.sourceLastSeenAt = sourceLastSeenAt
        self.presentationState = presentationState
        self.presentationReason = presentationReason
        self.storedLocally = storedLocally
    }

    public var effectivePresentationState: AgentArtifactPresentationState {
        presentationState ?? (storedLocally == false ? .unavailable : .available)
    }

    public var isAvailableHere: Bool {
        storedLocally != false && effectivePresentationState.allowsOpen
    }
}

public struct AgentArtifactsSnapshot: Codable, Equatable, Sendable {
    public var artifacts: [AgentArtifactRecord]
    public var selectedArtifactId: RelayId?
    public var refreshedAt: IsoTimestamp

    public init(artifacts: [AgentArtifactRecord], selectedArtifactId: RelayId?, refreshedAt: IsoTimestamp) {
        self.artifacts = artifacts
        self.selectedArtifactId = selectedArtifactId
        self.refreshedAt = refreshedAt
    }
}

private struct ArtifactOwnershipManifest: Decodable {
    var schemaVersion: String
    var agentId: RelayId?
    var agentName: String
    var cronJobId: RelayId?
    var cronJobName: String?
    var harnessId: String?
    var harnessType: String?
    var harnessLabel: String?
}

public struct AgentCronJobRecord: Identifiable, Codable, Equatable, Sendable {
    public var id: RelayId
    public var jobId: String
    public var name: String
    public var sourceKind: AgentCronJobSourceKind
    public var sourcePath: String?
    public var sourceLabel: String
    public var agentId: RelayId?
    public var agentName: String
    public var profileSlug: String?
    public var hermesHomePath: String?
    public var enabled: Bool
    public var state: String
    public var scheduleDisplay: String
    public var scheduleKind: String?
    public var scheduleMinutes: Int?
    public var scheduleExpression: String?
    public var nextRunAt: IsoTimestamp?
    public var lastRunAt: IsoTimestamp?
    public var lastStatus: String?
    public var lastError: String?
    public var lastDeliveryError: String?
    public var prompt: String?
    public var script: String?
    public var skills: [String]
    public var enabledToolsets: [String]
    public var contextFrom: [String]
    public var deliver: String?
    public var workdir: String?
    public var model: String?
    public var provider: String?
    public var baseURL: String?
    public var outputDirectoryPath: String?
    public var artifactIds: [RelayId]
    public var maintainedArtifactId: RelayId?
    public var schedulerStatus: HermesCronSchedulerStatus?
    public var rawJSON: String?
    public var transparencyNotes: [String]

    public init(
        id: RelayId,
        jobId: String,
        name: String,
        sourceKind: AgentCronJobSourceKind,
        sourcePath: String?,
        sourceLabel: String,
        agentId: RelayId?,
        agentName: String,
        profileSlug: String?,
        hermesHomePath: String?,
        enabled: Bool,
        state: String,
        scheduleDisplay: String,
        scheduleKind: String?,
        scheduleMinutes: Int?,
        scheduleExpression: String?,
        nextRunAt: IsoTimestamp?,
        lastRunAt: IsoTimestamp?,
        lastStatus: String?,
        lastError: String?,
        lastDeliveryError: String?,
        prompt: String?,
        script: String?,
        skills: [String],
        enabledToolsets: [String],
        contextFrom: [String],
        deliver: String?,
        workdir: String?,
        model: String?,
        provider: String?,
        baseURL: String?,
        outputDirectoryPath: String?,
        artifactIds: [RelayId],
        maintainedArtifactId: RelayId?,
        schedulerStatus: HermesCronSchedulerStatus?,
        rawJSON: String?,
        transparencyNotes: [String]
    ) {
        self.id = id
        self.jobId = jobId
        self.name = name
        self.sourceKind = sourceKind
        self.sourcePath = sourcePath
        self.sourceLabel = sourceLabel
        self.agentId = agentId
        self.agentName = agentName
        self.profileSlug = profileSlug
        self.hermesHomePath = hermesHomePath
        self.enabled = enabled
        self.state = state
        self.scheduleDisplay = scheduleDisplay
        self.scheduleKind = scheduleKind
        self.scheduleMinutes = scheduleMinutes
        self.scheduleExpression = scheduleExpression
        self.nextRunAt = nextRunAt
        self.lastRunAt = lastRunAt
        self.lastStatus = lastStatus
        self.lastError = lastError
        self.lastDeliveryError = lastDeliveryError
        self.prompt = prompt
        self.script = script
        self.skills = skills
        self.enabledToolsets = enabledToolsets
        self.contextFrom = contextFrom
        self.deliver = deliver
        self.workdir = workdir
        self.model = model
        self.provider = provider
        self.baseURL = baseURL
        self.outputDirectoryPath = outputDirectoryPath
        self.artifactIds = artifactIds
        self.maintainedArtifactId = maintainedArtifactId
        self.schedulerStatus = schedulerStatus
        self.rawJSON = rawJSON
        self.transparencyNotes = transparencyNotes
    }
}

public struct AgentCronJobsSnapshot: Codable, Equatable, Sendable {
    public var jobs: [AgentCronJobRecord]
    public var selectedJobId: RelayId?
    public var refreshedAt: IsoTimestamp

    public init(jobs: [AgentCronJobRecord], selectedJobId: RelayId?, refreshedAt: IsoTimestamp) {
        self.jobs = jobs
        self.selectedJobId = selectedJobId
        self.refreshedAt = refreshedAt
    }
}

public struct AgentCronJobUpdate: Sendable {
    public var name: String
    public var prompt: String
    public var schedule: String
    public var nextRunAt: String
    public var enabled: Bool

    public init(name: String, prompt: String, schedule: String, nextRunAt: String, enabled: Bool) {
        self.name = name
        self.prompt = prompt
        self.schedule = schedule
        self.nextRunAt = nextRunAt
        self.enabled = enabled
    }
}

public final class ArtifactLibraryService {
    private let paths: RelayConsolePaths
    private let workspaceRoots: [URL]
    private let hermesCronScheduler: HermesCronSchedulerService
    private let fileManager: FileManager
    private let cronArtifactDirectories: CronArtifactDirectoryAuthority

    public init(
        paths: RelayConsolePaths,
        workspaceRoot: URL? = nil,
        hermesCronScheduler: HermesCronSchedulerService? = nil,
        fileManager: FileManager = .default
    ) {
        self.paths = paths
        self.workspaceRoots = Self.resolveWorkspaceRoots(
            explicitRoot: workspaceRoot,
            fileManager: fileManager
        )
        self.hermesCronScheduler = hermesCronScheduler ?? HermesCronSchedulerService(paths: paths)
        self.fileManager = fileManager
        self.cronArtifactDirectories = CronArtifactDirectoryAuthority(
            paths: paths,
            fileManager: fileManager
        )
    }

    public func artifactsSnapshot(
        agents: [AgentWithBinding],
        selectedArtifactId: RelayId? = nil,
        includeUnownedLocalArtifacts: Bool = true
    ) throws -> AgentArtifactsSnapshot {
        var artifacts = try collectArtifacts(
            agents: agents,
            includeUnownedLocalArtifacts: includeUnownedLocalArtifacts
        )
        let jobs = try collectHermesCronJobs(agents: agents, artifacts: artifacts)
        artifacts = decorateArtifacts(artifacts, with: jobs)
        let selected = artifacts.contains { $0.id == selectedArtifactId } ? selectedArtifactId : nil
        return AgentArtifactsSnapshot(
            artifacts: artifacts,
            selectedArtifactId: selected,
            refreshedAt: ISO8601DateFormatter.relayConsole.string(from: Date())
        )
    }

    public func cronJobsSnapshot(
        agents: [AgentWithBinding],
        selectedJobId: RelayId? = nil,
        includeUnownedLocalArtifacts: Bool = true
    ) throws -> AgentCronJobsSnapshot {
        let artifacts = try collectArtifacts(
            agents: agents,
            includeUnownedLocalArtifacts: includeUnownedLocalArtifacts
        )
        var jobs = try collectHermesCronJobs(agents: agents, artifacts: artifacts)
        appendDocumentDeclaredJobsIfNeeded(to: &jobs, artifacts: artifacts)
        jobs.sort { lhs, rhs in
            if lhs.enabled != rhs.enabled { return lhs.enabled && !rhs.enabled }
            if lhs.nextRunAt != rhs.nextRunAt { return (lhs.nextRunAt ?? "9999") < (rhs.nextRunAt ?? "9999") }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
        let selected = jobs.contains { $0.id == selectedJobId } ? selectedJobId : jobs.first?.id
        return AgentCronJobsSnapshot(
            jobs: jobs,
            selectedJobId: selected,
            refreshedAt: ISO8601DateFormatter.relayConsole.string(from: Date())
        )
    }

    @discardableResult
    public func reconcileCronArtifactDirectories(
        agents: [AgentWithBinding]
    ) throws -> Int {
        try cronArtifactDirectories.reconcile(agents: agents)
    }

    public func openClawCronJobRecords(
        agent: AgentWithBinding,
        jobs: [[String: Any]]
    ) -> [AgentCronJobRecord] {
        jobs.map { job in
            let jobId = stringValue(job["id"]) ?? stableSuffix(String(describing: job))
            let payload = job["payload"] as? [String: Any] ?? [:]
            let state = job["state"] as? [String: Any] ?? [:]
            let prompt = stringValue(payload["message"]) ?? stringValue(payload["text"]) ?? ""
            let schedule = scheduleParts(job["schedule"])
            let enabled = boolValue(job["enabled"]) ?? true
            return AgentCronJobRecord(
                id: "cron-openclaw-\(agent.id)-\(jobId)",
                jobId: jobId,
                name: stringValue(job["name"]) ?? prompt.prefixString(50),
                sourceKind: stringValue(job["source"]) == "system_crontab" ? .systemCrontab : .openClawNative,
                sourcePath: nil,
                sourceLabel: stringValue(job["source"]) == "system_crontab" ? "System crontab" : "OpenClaw Gateway",
                agentId: agent.id,
                agentName: agent.name,
                profileSlug: agent.binding.externalAgentId,
                hermesHomePath: nil,
                enabled: enabled,
                state: stringValue(job["status"]) ?? (enabled ? "scheduled" : "paused"),
                scheduleDisplay: schedule.display ?? "Schedule unavailable",
                scheduleKind: schedule.kind,
                scheduleMinutes: schedule.minutes,
                scheduleExpression: schedule.expression,
                nextRunAt: stringValue(state["nextRunAt"]),
                lastRunAt: stringValue(state["lastRunAt"]),
                lastStatus: stringValue(state["lastRunStatus"]),
                lastError: stringValue(state["lastError"]),
                lastDeliveryError: nil,
                prompt: prompt,
                script: nil,
                skills: [],
                enabledToolsets: [],
                contextFrom: [],
                deliver: nil,
                workdir: nil,
                model: stringValue(payload["model"]),
                provider: nil,
                baseURL: nil,
                outputDirectoryPath: nil,
                artifactIds: [],
                maintainedArtifactId: nil,
                schedulerStatus: nil,
                rawJSON: prettyJSONString(job),
                transparencyNotes: ["This job is managed by the native OpenClaw Gateway scheduler."]
            )
        }
    }

    public func deleteArtifact(_ artifact: AgentArtifactRecord) throws {
        guard artifact.sourceKind != .external else {
            throw ArtifactLibraryError.notWritable("External artifacts cannot be deleted from Relay Console.")
        }
        let trimmedPath = artifact.path.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedPath.isEmpty else {
            throw ArtifactLibraryError.notFound("Artifact path is missing.")
        }
        let url = URL(fileURLWithPath: trimmedPath)
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: url.path, isDirectory: &isDirectory) else {
            throw ArtifactLibraryError.notFound("Artifact no longer exists on disk.")
        }
        try fileManager.removeItem(at: url)
    }

    public func updateCronJob(_ job: AgentCronJobRecord, updates: AgentCronJobUpdate) throws {
        guard job.sourceKind == .hermesJobsFile,
              let sourcePath = job.sourcePath,
              !sourcePath.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw ArtifactLibraryError.notWritable("This cron job is inferred from an artifact declaration, not a writable Hermes jobs.json record.")
        }
        let sourceURL = URL(fileURLWithPath: sourcePath)
        let data = try Data(contentsOf: sourceURL)
        let parsed = try JSONSerialization.jsonObject(with: data)
        var root = parsed
        var changed = false
        if var object = root as? [String: Any],
            var jobs = object["jobs"] as? [[String: Any]] {
            for index in jobs.indices where stringValue(jobs[index]["id"]) == job.jobId {
                jobs[index] = updatedJobDictionary(jobs[index], record: job, updates: updates)
                changed = true
                break
            }
            object["jobs"] = jobs
            object["updated_at"] = ISO8601DateFormatter.relayConsole.string(from: Date())
            root = object
        } else if var jobs = root as? [[String: Any]] {
            for index in jobs.indices where stringValue(jobs[index]["id"]) == job.jobId {
                jobs[index] = updatedJobDictionary(jobs[index], record: job, updates: updates)
                changed = true
                break
            }
            root = jobs
        }

        guard changed else {
            throw ArtifactLibraryError.notFound("Could not find cron job \(job.jobId) in \(sourcePath).")
        }

        let output = try JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys])
        let tempURL = sourceURL
            .deletingLastPathComponent()
            .appendingPathComponent(".\(sourceURL.lastPathComponent).relay-console.tmp")
        try output.write(to: tempURL, options: [.atomic])
        if fileManager.fileExists(atPath: sourceURL.path) {
            try fileManager.removeItem(at: sourceURL)
        }
        try fileManager.moveItem(at: tempURL, to: sourceURL)
    }

    private func collectHermesCronJobs(
        agents: [AgentWithBinding],
        artifacts: [AgentArtifactRecord]
    ) throws -> [AgentCronJobRecord] {
        var records: [AgentCronJobRecord] = []
        for agent in agents {
            guard agent.binding.runtimeType == .hermes,
                  let homePath = agent.binding.hermesHomePath?.trimmedNonEmpty
            else { continue }
            let home = URL(fileURLWithPath: homePath, isDirectory: true)
            let jobsURL = home.appendingPathComponent("cron", isDirectory: true).appendingPathComponent("jobs.json")
            for job in try cronJobDictionaries(at: jobsURL) {
                records.append(makeCronJobRecord(job: job, agent: agent, home: home, jobsURL: jobsURL, artifacts: artifacts))
            }
        }
        return records
    }

    private func cronJobDictionaries(at jobsURL: URL) throws -> [[String: Any]] {
        guard fileManager.fileExists(atPath: jobsURL.path) else { return [] }
        let data = try Data(contentsOf: jobsURL)
        // Runtime-owned cron files can briefly be empty while Hermes rewrites
        // them. An empty or malformed optional jobs file means there are no
        // jobs to index; it must not make the entire app refresh fail.
        guard !data.isEmpty,
              let root = try? JSONSerialization.jsonObject(with: data)
        else { return [] }
        if let object = root as? [String: Any], let jobs = object["jobs"] as? [[String: Any]] {
            return jobs
        }
        if let jobs = root as? [[String: Any]] {
            return jobs
        }
        return []
    }

    private func makeCronJobRecord(
        job: [String: Any],
        agent: AgentWithBinding,
        home: URL,
        jobsURL: URL,
        artifacts: [AgentArtifactRecord]
    ) -> AgentCronJobRecord {
        let jobId = stringValue(job["id"]) ?? stableSuffix(jobsURL.path + String(describing: job))
        let prompt = stringValue(job["prompt"]) ?? ""
        let workdir = stringValue(job["workdir"])
        let promptSummary = prompt.prefixString(50).trimmedNonEmpty ?? "Cron job"
        let name = stringValue(job["name"]) ?? promptSummary
        let schedule = scheduleParts(job["schedule"])
        let scheduleDisplay = stringValue(job["schedule_display"]) ?? schedule.display ?? "?"
        let outputDirectory = configuredOutputDirectory(for: job, prompt: prompt, workdir: workdir)
            ?? canonicalCronArtifactDirectory(for: jobId)
        let matchedArtifacts = relatedArtifacts(for: job, name: name, artifacts: artifacts)
        let maintainedArtifact = preferredMaintainedArtifact(from: matchedArtifacts)
        return AgentCronJobRecord(
            id: "cron-hermes-\(agent.id)-\(jobId)",
            jobId: jobId,
            name: name,
            sourceKind: .hermesJobsFile,
            sourcePath: jobsURL.path,
            sourceLabel: "Hermes jobs.json",
            agentId: agent.id,
            agentName: agent.name,
            profileSlug: agent.binding.hermesProfileSlug,
            hermesHomePath: home.path,
            enabled: boolValue(job["enabled"]) ?? true,
            state: stringValue(job["state"]) ?? ((boolValue(job["enabled"]) ?? true) ? "scheduled" : "paused"),
            scheduleDisplay: scheduleDisplay,
            scheduleKind: schedule.kind,
            scheduleMinutes: schedule.minutes,
            scheduleExpression: schedule.expression,
            nextRunAt: stringValue(job["next_run_at"]),
            lastRunAt: stringValue(job["last_run_at"]),
            lastStatus: stringValue(job["last_status"]),
            lastError: stringValue(job["last_error"]),
            lastDeliveryError: stringValue(job["last_delivery_error"]),
            prompt: prompt,
            script: stringValue(job["script"]),
            skills: stringArray(job["skills"]),
            enabledToolsets: stringArray(job["enabled_toolsets"]),
            contextFrom: stringArray(job["context_from"]),
            deliver: stringValue(job["deliver"]),
            workdir: stringValue(job["workdir"]),
            model: stringValue(job["model"]),
            provider: stringValue(job["provider"]),
            baseURL: stringValue(job["base_url"]),
            outputDirectoryPath: outputDirectory.path,
            artifactIds: matchedArtifacts.map(\.id),
            maintainedArtifactId: maintainedArtifact?.id,
            schedulerStatus: hermesCronScheduler.status(forHermesHome: home),
            rawJSON: prettyJSONString(job),
            transparencyNotes: transparencyNotes(for: job, artifacts: matchedArtifacts, jobsURL: jobsURL)
        )
    }

    private func collectArtifacts(
        agents: [AgentWithBinding],
        includeUnownedLocalArtifacts: Bool
    ) throws -> [AgentArtifactRecord] {
        var artifactsByPath: [String: AgentArtifactRecord] = [:]
        if includeUnownedLocalArtifacts,
           fileManager.fileExists(atPath: paths.artifactsDir.path) {
            for artifact in collectArtifacts(in: paths.artifactsDir, sourceKind: .relayManaged, root: paths.artifactsDir, agent: nil, cronJobId: nil, cronJobName: nil) {
                artifactsByPath[artifact.path] = artifact
            }
        }

        for workspaceRoot in includeUnownedLocalArtifacts ? workspaceRoots : [] {
            let workspaceDocs = workspaceRoot.appendingPathComponent("docs", isDirectory: true)
            let competitiveResearch = workspaceDocs.appendingPathComponent("competitive-research", isDirectory: true)
            if fileManager.fileExists(atPath: competitiveResearch.path) {
                let discovered = collectArtifacts(
                    in: competitiveResearch,
                    sourceKind: .cronDocument,
                    root: workspaceRoot,
                    agent: nil,
                    cronJobId: nil,
                    cronJobName: nil
                )
                for artifact in applyingOwnershipManifest(discovered, from: competitiveResearch) {
                    artifactsByPath[artifact.path] = artifact
                }
            }
        }

        for artifact in collectCronDeclaredOutputArtifacts(agents: agents) {
            artifactsByPath[artifact.path] = artifact
        }

        for agent in agents {
            guard let homePath = agent.binding.hermesHomePath?.trimmedNonEmpty else { continue }
            let outputRoot = URL(fileURLWithPath: homePath, isDirectory: true)
                .appendingPathComponent("cron", isDirectory: true)
                .appendingPathComponent("output", isDirectory: true)
            guard fileManager.fileExists(atPath: outputRoot.path) else { continue }
            for artifact in collectArtifacts(in: outputRoot, sourceKind: .cronOutput, root: outputRoot, agent: agent, cronJobId: nil, cronJobName: nil) {
                artifactsByPath[artifact.path] = artifact
            }
        }

        return artifactsByPath.values.sorted { lhs, rhs in
            if lhs.updatedAt != rhs.updatedAt { return (lhs.updatedAt ?? "") > (rhs.updatedAt ?? "") }
            return lhs.title.localizedCaseInsensitiveCompare(rhs.title) == .orderedAscending
        }
    }

    private func applyingOwnershipManifest(
        _ artifacts: [AgentArtifactRecord],
        from directory: URL
    ) -> [AgentArtifactRecord] {
        let manifestURL = directory.appendingPathComponent(".relay-artifacts.json", isDirectory: false)
        guard let data = try? Data(contentsOf: manifestURL),
              let manifest = try? JSONDecoder().decode(ArtifactOwnershipManifest.self, from: data),
              manifest.schemaVersion == "relay-artifact-owner.v1",
              manifest.agentName.trimmedNonEmpty != nil
        else { return artifacts }

        return artifacts.map { artifact in
            var owned = artifact
            if owned.agentId == nil { owned.agentId = manifest.agentId?.trimmedNonEmpty }
            if owned.agentName?.trimmedNonEmpty == nil { owned.agentName = manifest.agentName.trimmedNonEmpty }
            if owned.cronJobId == nil { owned.cronJobId = manifest.cronJobId?.trimmedNonEmpty }
            if owned.cronJobName?.trimmedNonEmpty == nil { owned.cronJobName = manifest.cronJobName?.trimmedNonEmpty }
            if owned.harnessId?.trimmedNonEmpty == nil { owned.harnessId = manifest.harnessId?.trimmedNonEmpty }
            if owned.harnessType?.trimmedNonEmpty == nil { owned.harnessType = manifest.harnessType?.trimmedNonEmpty }
            if owned.harnessLabel?.trimmedNonEmpty == nil { owned.harnessLabel = manifest.harnessLabel?.trimmedNonEmpty }
            return owned
        }
    }

    private static func resolveWorkspaceRoots(
        explicitRoot: URL?,
        fileManager: FileManager
    ) -> [URL] {
        var candidates: [URL] = []
        if let explicitRoot {
            candidates.append(explicitRoot)
        }
        if let configured = ProcessInfo.processInfo.environment["RELAY_CONSOLE_WORKSPACE_ROOT"]?.trimmedNonEmpty {
            candidates.append(URL(fileURLWithPath: configured, isDirectory: true))
        }

        let current = URL(
            fileURLWithPath: fileManager.currentDirectoryPath,
            isDirectory: true
        )
        candidates.append(current)
        candidates.append(current.appendingPathComponent("RelayConsoleSwift", isDirectory: true))

        // Xcode and `swift run` do not guarantee the launched app's working
        // directory. During a source build, #filePath gives us the package
        // root that previously supplied the checked-in competitive-research
        // artifacts. Installed builds simply ignore this candidate when the
        // source tree is not present.
        let sourcePackageRoot = URL(fileURLWithPath: #filePath, isDirectory: false)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        candidates.append(sourcePackageRoot)

        var seen = Set<String>()
        return candidates.compactMap { candidate in
            let standardized = candidate.standardizedFileURL
            guard seen.insert(standardized.path).inserted,
                  fileManager.fileExists(atPath: standardized.path)
            else { return nil }
            return standardized
        }
    }

    private func collectCronDeclaredOutputArtifacts(agents: [AgentWithBinding]) -> [AgentArtifactRecord] {
        var artifactsByPath: [String: AgentArtifactRecord] = [:]
        for agent in agents {
            guard agent.binding.runtimeType == .hermes,
                  let homePath = agent.binding.hermesHomePath?.trimmedNonEmpty
            else { continue }
            let jobsURL = URL(fileURLWithPath: homePath, isDirectory: true)
                .appendingPathComponent("cron", isDirectory: true)
                .appendingPathComponent("jobs.json")
            guard let jobs = try? cronJobDictionaries(at: jobsURL) else { continue }
            for job in jobs {
                let prompt = stringValue(job["prompt"]) ?? ""
                let workdir = stringValue(job["workdir"])
                guard let outputDirectory = configuredOutputDirectory(for: job, prompt: prompt, workdir: workdir),
                      fileManager.fileExists(atPath: outputDirectory.path)
                else { continue }
                let root = outputDirectory.deletingLastPathComponent()
                for artifact in collectArtifacts(
                    in: outputDirectory,
                    sourceKind: .cronDocument,
                    root: root,
                    agent: agent,
                    cronJobId: nil,
                    cronJobName: stringValue(job["name"])
                ) {
                    artifactsByPath[artifact.path] = artifact
                }
            }
        }
        return Array(artifactsByPath.values)
    }

    private func decorateArtifacts(_ artifacts: [AgentArtifactRecord], with jobs: [AgentCronJobRecord]) -> [AgentArtifactRecord] {
        artifacts.map { artifact in
            guard let job = jobs.first(where: { $0.artifactIds.contains(artifact.id) }) else {
                return artifact
            }
            var decorated = artifact
            if decorated.agentId == nil { decorated.agentId = job.agentId }
            if decorated.agentName?.trimmedNonEmpty == nil { decorated.agentName = job.agentName }
            if decorated.cronJobId == nil { decorated.cronJobId = job.id }
            if decorated.cronJobName?.trimmedNonEmpty == nil { decorated.cronJobName = job.name }
            switch job.sourceKind {
            case .hermesJobsFile:
                if decorated.harnessType?.trimmedNonEmpty == nil { decorated.harnessType = "hermes" }
                if decorated.harnessLabel?.trimmedNonEmpty == nil { decorated.harnessLabel = "Hermes" }
            case .openClawNative:
                if decorated.harnessType?.trimmedNonEmpty == nil { decorated.harnessType = "openclaw" }
                if decorated.harnessLabel?.trimmedNonEmpty == nil { decorated.harnessLabel = "OpenClaw" }
            default:
                break
            }
            return decorated
        }
    }

    private func collectArtifacts(
        in directory: URL,
        sourceKind: AgentArtifactSourceKind,
        root: URL,
        agent: AgentWithBinding?,
        cronJobId: RelayId?,
        cronJobName: String?
    ) -> [AgentArtifactRecord] {
        guard let enumerator = fileManager.enumerator(
            at: directory,
            includingPropertiesForKeys: [.isRegularFileKey, .isDirectoryKey, .fileSizeKey, .contentModificationDateKey],
            options: [.skipsHiddenFiles, .skipsPackageDescendants]
        ) else {
            return []
        }

        var artifacts: [AgentArtifactRecord] = []
        var visitedEntryCount = 0
        let rootDepth = directory.standardizedFileURL.pathComponents.count
        let skippedDirectoryNames: Set<String> = [
            ".git", ".hg", ".svn", ".venv", "node_modules", "Library", "DerivedData"
        ]
        for case let url as URL in enumerator {
            visitedEntryCount += 1
            // A malformed or overly broad cron output path must never turn an
            // app refresh into an unbounded filesystem crawl. The artifact view
            // is a bounded snapshot and can be refreshed again on demand.
            if visitedEntryCount > 5_000 { break }
            let values = try? url.resourceValues(forKeys: [.isRegularFileKey, .isDirectoryKey, .fileSizeKey, .contentModificationDateKey])
            if values?.isDirectory == true {
                let depth = url.standardizedFileURL.pathComponents.count - rootDepth
                if depth >= 8 || skippedDirectoryNames.contains(url.lastPathComponent) {
                    enumerator.skipDescendants()
                }
                continue
            }
            guard values?.isRegularFile == true else { continue }
            if isArtifactPointerManifest(url), let artifact = makeExternalArtifactRecord(
                manifestURL: url,
                sourceKind: .external,
                root: root,
                agent: agent,
                cronJobId: cronJobId,
                cronJobName: cronJobName,
                fileSize: values?.fileSize,
                updatedAt: values?.contentModificationDate
            ) {
                artifacts.append(artifact)
                if artifacts.count >= 500 {
                    break
                }
                continue
            }
            if shouldSkipArtifactFile(url, sourceKind: sourceKind, fileSize: values?.fileSize) {
                continue
            }
            let artifact = makeArtifactRecord(
                url: url,
                sourceKind: sourceKind,
                root: root,
                agent: agent,
                cronJobId: cronJobId,
                cronJobName: cronJobName,
                fileSize: values?.fileSize,
                updatedAt: values?.contentModificationDate
            )
            artifacts.append(artifact)
            if artifacts.count >= 500 {
                break
            }
        }
        return artifacts
    }

    private func makeArtifactRecord(
        url: URL,
        sourceKind: AgentArtifactSourceKind,
        root: URL,
        agent: AgentWithBinding?,
        cronJobId: RelayId?,
        cronJobName: String?,
        fileSize: Int?,
        updatedAt: Date?
    ) -> AgentArtifactRecord {
        let ext = url.pathExtension.lowercased().trimmedNonEmpty
        let kind = artifactKind(forExtension: ext)
        let text = readableText(url: url, extension: ext, fileSize: fileSize)
        let relative = relativePath(url, root: root)
        let title = artifactTitle(url: url, relativePath: relative)
        return AgentArtifactRecord(
            id: "artifact-\(stableSuffix(url.standardizedFileURL.path))",
            title: title,
            kind: kind,
            sourceKind: sourceKind,
            path: url.path,
            relativePath: relative,
            directoryPath: url.deletingLastPathComponent().path,
            fileExtension: ext,
            byteCount: fileSize,
            updatedAt: updatedAt.map { ISO8601DateFormatter.relayConsole.string(from: $0) },
            agentId: agent?.id,
            agentName: agent?.name,
            cronJobId: cronJobId,
            cronJobName: cronJobName,
            content: text,
            preview: text?.prefixString(1000),
            isReadableText: text != nil,
            harnessId: agent?.binding.harnessId,
            harnessType: agent?.binding.runtimeType.rawValue,
            harnessLabel: agent.map { harnessDisplayLabel($0.binding.runtimeType) }
        )
    }

    private func makeExternalArtifactRecord(
        manifestURL: URL,
        sourceKind: AgentArtifactSourceKind,
        root: URL,
        agent: AgentWithBinding?,
        cronJobId: RelayId?,
        cronJobName: String?,
        fileSize: Int?,
        updatedAt: Date?
    ) -> AgentArtifactRecord? {
        guard let data = try? Data(contentsOf: manifestURL),
              let rootObject = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let rawExternalURL = (stringValue(rootObject["external_url"]) ?? stringValue(rootObject["url"]))?.trimmedNonEmpty
        else {
            return nil
        }
        let destination = ExternalArtifactURLPolicy.destination(rawExternalURL)
        let kind = stringValue(rootObject["kind"]).flatMap(AgentArtifactKind.init(rawValue:)) ?? .unknown
        let relative = relativePath(manifestURL, root: root)
        let title = stringValue(rootObject["title"])?.trimmedNonEmpty
            ?? manifestURL.deletingPathExtension().lastPathComponent
        let provider = stringValue(rootObject["provider"])?.trimmedNonEmpty
        let description = stringValue(rootObject["description"])?.trimmedNonEmpty
        let preview = [description, destination?.host].compactMap { $0 }.joined(separator: "\n")
        return AgentArtifactRecord(
            id: "artifact-external-\(stableSuffix(manifestURL.standardizedFileURL.path + "|" + (destination?.normalizedURL ?? "blocked")))",
            title: title,
            kind: kind,
            sourceKind: sourceKind,
            path: manifestURL.path,
            relativePath: relative,
            directoryPath: manifestURL.deletingLastPathComponent().path,
            fileExtension: manifestURL.pathExtension.lowercased().trimmedNonEmpty,
            externalURL: destination?.normalizedURL,
            externalProvider: provider,
            byteCount: fileSize,
            updatedAt: updatedAt.map { ISO8601DateFormatter.relayConsole.string(from: $0) },
            agentId: agent?.id,
            agentName: agent?.name,
            cronJobId: cronJobId,
            cronJobName: cronJobName,
            content: nil,
            preview: preview.trimmedNonEmpty,
            isReadableText: false,
            harnessId: agent?.binding.harnessId,
            harnessType: agent?.binding.runtimeType.rawValue,
            harnessLabel: agent.map { harnessDisplayLabel($0.binding.runtimeType) },
            presentationState: destination == nil ? .unavailable : .available,
            presentationReason: destination == nil ? ExternalArtifactURLPolicy.blockedReason : nil
        )
    }

    private func harnessDisplayLabel(_ runtimeType: RuntimeType) -> String {
        switch runtimeType {
        case .hermes: return "Hermes"
        case .openclaw: return "OpenClaw"
        default: return runtimeType.rawValue.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private func isArtifactPointerManifest(_ url: URL) -> Bool {
        url.lastPathComponent.lowercased().hasSuffix(RuntimeArtifactContract.pointerManifestSuffix)
    }

    private func shouldSkipArtifactFile(_ url: URL, sourceKind: AgentArtifactSourceKind, fileSize: Int?) -> Bool {
        if isArtifactPointerManifest(url) {
            return true
        }
        if looksLikeHermesCronRunRecord(url, fileSize: fileSize) {
            return true
        }
        return false
    }

    private func looksLikeHermesCronRunRecord(_ url: URL, fileSize: Int?) -> Bool {
        let ext = url.pathExtension.lowercased()
        guard ["md", "markdown", "txt"].contains(ext) else { return false }
        if let fileSize, fileSize > 256_000 { return false }
        guard let data = try? Data(contentsOf: url), data.count <= 256_000,
              let content = String(data: data, encoding: .utf8)
        else { return false }
        let head = String(content.prefix(4_000))
        return head.contains("# Cron Job:")
            && head.contains("**Job ID:**")
            && head.contains("## Prompt")
            && head.contains("## Response")
    }

    private func appendDocumentDeclaredJobsIfNeeded(
        to jobs: inout [AgentCronJobRecord],
        artifacts: [AgentArtifactRecord]
    ) {
        let declaredDocs = artifacts.filter { artifact in
            artifact.sourceKind == .cronDocument
                && (artifact.content ?? "").localizedCaseInsensitiveContains("maintained by a Hermes cron job")
        }
        for artifact in declaredDocs {
            let alreadyRepresented = jobs.contains { job in
                job.artifactIds.contains(artifact.id)
            }
            guard !alreadyRepresented else { continue }
            let directoryArtifacts = artifacts.filter { $0.directoryPath == artifact.directoryPath || $0.path.hasPrefix((artifact.directoryPath ?? "") + "/") }
            let id = "cron-declared-\(stableSuffix(artifact.path))"
            jobs.append(AgentCronJobRecord(
                id: id,
                jobId: "declared-\(stableSuffix(artifact.path))",
                name: artifact.title.replacingOccurrences(of: ".md", with: ""),
                sourceKind: .documentDeclared,
                sourcePath: artifact.path,
                sourceLabel: "Artifact declaration",
                agentId: artifact.agentId,
                agentName: artifact.agentName ?? "Hermes cron job",
                profileSlug: nil,
                hermesHomePath: nil,
                enabled: true,
                state: "declared",
                scheduleDisplay: declaredSchedule(in: artifact.content) ?? "every four hours",
                scheduleKind: "declared",
                scheduleMinutes: 240,
                scheduleExpression: nil,
                nextRunAt: nil,
                lastRunAt: nil,
                lastStatus: nil,
                lastError: nil,
                lastDeliveryError: nil,
                prompt: artifact.content,
                script: nil,
                skills: [],
                enabledToolsets: [],
                contextFrom: [],
                deliver: nil,
                workdir: workspaceRoots.first?.path ?? paths.root.path,
                model: nil,
                provider: nil,
                baseURL: nil,
                outputDirectoryPath: artifact.directoryPath,
                artifactIds: directoryArtifacts.map(\.id),
                maintainedArtifactId: artifact.id,
                schedulerStatus: nil,
                rawJSON: nil,
                transparencyNotes: [
                    "This row was inferred from the artifact text because no matching Hermes jobs.json record was found.",
                    "It is visible for review but cannot be edited as a scheduler record until a Hermes cron record exists."
                ]
            ))
        }
    }

    private func updatedJobDictionary(_ original: [String: Any], record: AgentCronJobRecord, updates: AgentCronJobUpdate) -> [String: Any] {
        var job = original
        job["name"] = updates.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let outputDirectory = record.outputDirectoryPath?.trimmedNonEmpty
            ?? canonicalCronArtifactDirectory(for: record.jobId).path
        job["prompt"] = cronPromptWithArtifactContract(updates.prompt, outputDirectory: outputDirectory)
        job["output_directory"] = outputDirectory
        let scheduleText = updates.schedule.trimmingCharacters(in: .whitespacesAndNewlines)
        if !scheduleText.isEmpty {
            let parsed = parseScheduleForHermes(scheduleText)
            job["schedule"] = parsed.schedule
            job["schedule_display"] = parsed.display
            if updates.nextRunAt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
               let nextRunAt = parsed.nextRunAt {
                job["next_run_at"] = nextRunAt
            }
        }
        let nextRunAt = updates.nextRunAt.trimmingCharacters(in: .whitespacesAndNewlines)
        if !nextRunAt.isEmpty {
            job["next_run_at"] = nextRunAt
        }
        job["enabled"] = updates.enabled
        if updates.enabled {
            if stringValue(job["state"]) == "paused" || stringValue(job["state"])?.trimmedNonEmpty == nil {
                job["state"] = "scheduled"
            }
            job["paused_at"] = NSNull()
            job["paused_reason"] = NSNull()
        } else {
            job["state"] = "paused"
            job["paused_at"] = ISO8601DateFormatter.relayConsole.string(from: Date())
            job["paused_reason"] = "Paused from Relay Console"
        }
        return job
    }

    private func relatedArtifacts(for job: [String: Any], name: String, artifacts: [AgentArtifactRecord]) -> [AgentArtifactRecord] {
        let prompt = stringValue(job["prompt"]) ?? ""
        let workdir = stringValue(job["workdir"])
        let jobId = stringValue(job["id"]) ?? stableSuffix(String(describing: job))
        let outputDirectory = configuredOutputDirectory(for: job, prompt: prompt, workdir: workdir)?.path
            ?? canonicalCronArtifactDirectory(for: jobId).path
        let normalized = URL(fileURLWithPath: outputDirectory, isDirectory: true).standardizedFileURL.path
        let matched = artifacts.filter { artifact in
            artifact.path == normalized || artifact.path.hasPrefix(normalized + "/")
        }
        if !matched.isEmpty { return matched }
        let haystack = [name, prompt, workdir ?? ""].joined(separator: " ").lowercased()
        if haystack.contains("competitive") || haystack.contains("comparable-products") {
            return artifacts.filter { artifact in
                artifact.path.lowercased().contains("/docs/competitive-research/")
            }
        }
        return []
    }

    private func configuredOutputDirectory(for job: [String: Any], prompt: String, workdir: String?) -> URL? {
        cronArtifactDirectories.configuredDirectory(
            for: job,
            prompt: prompt,
            workdir: workdir
        )
    }

    private func canonicalCronArtifactDirectory(for jobId: String) -> URL {
        paths.artifactsDir
            .appendingPathComponent("cron", isDirectory: true)
            .appendingPathComponent(safePathComponent(jobId, fallback: "job"), isDirectory: true)
    }

    private func cronPromptWithArtifactContract(_ prompt: String, outputDirectory: String) -> String {
        let marker = "[Relay Console cron artifact contract]"
        let stripped: String
        if let range = prompt.range(
            of: #"\n?\[Relay Console cron artifact contract\][\s\S]*?\[End Relay Console cron artifact contract\]\n?"#,
            options: .regularExpression
        ) {
            stripped = String(prompt[..<range.lowerBound] + prompt[range.upperBound...])
                .trimmingCharacters(in: .whitespacesAndNewlines)
        } else {
            stripped = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        let block = """

        \(marker)
        \(RuntimeArtifactContract.cronOutputMarker)
        Directory: \(outputDirectory)
        \(RuntimeArtifactContract.cronOutputEndMarker)

        Put maintained documents, images, video, audio, data exports, and external pointer manifests there. Keep scheduler/debug run records out of that directory.
        [End Relay Console cron artifact contract]
        """
        return [stripped, block.trimmingCharacters(in: .whitespacesAndNewlines)]
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }

    private func preferredMaintainedArtifact(from artifacts: [AgentArtifactRecord]) -> AgentArtifactRecord? {
        artifacts.first { $0.path.hasSuffix("/README.md") }
            ?? artifacts.first { $0.kind == .document }
            ?? artifacts.first
    }

    private func transparencyNotes(for job: [String: Any], artifacts: [AgentArtifactRecord], jobsURL: URL) -> [String] {
        var notes: [String] = [
            "Stored in \(jobsURL.path).",
            "Hermes checks next_run_at from this record and starts a scheduled agent run when due."
        ]
        if stringValue(job["script"])?.trimmedNonEmpty != nil {
            notes.append("A script is configured; Hermes can run the script as part of the scheduled job.")
        } else {
            notes.append("No script is configured; the stored prompt is the main work instruction for the scheduled agent run.")
        }
        if !artifacts.isEmpty {
            notes.append("Linked artifacts are matched from the job prompt/workdir and visible in Artifacts.")
        }
        return notes
    }

    private func artifactKind(forExtension ext: String?) -> AgentArtifactKind {
        switch ext {
        case "md", "markdown", "txt", "rtf", "html", "htm", "pdf", "doc", "docx":
            return .document
        case "png", "jpg", "jpeg", "gif", "webp", "heic", "svg":
            return .image
        case "mp4", "mov", "webm", "m4v":
            return .video
        case "mp3", "wav", "m4a", "aac", "flac":
            return .audio
        case "json", "jsonl", "csv", "tsv", "xml", "yaml", "yml", "sqlite", "db":
            return .data
        case nil:
            return .unknown
        default:
            return readableTextExtensions.contains(ext ?? "") ? .document : .unknown
        }
    }

    private func readableText(url: URL, extension ext: String?, fileSize: Int?) -> String? {
        guard let ext, readableTextExtensions.contains(ext) else { return nil }
        if let fileSize, fileSize > 512_000 { return nil }
        guard let data = try? Data(contentsOf: url), data.count <= 512_000 else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func artifactTitle(url: URL, relativePath: String?) -> String {
        if let relativePath, relativePath.hasPrefix("docs/competitive-research/") {
            return relativePath.replacingOccurrences(of: "docs/competitive-research/", with: "")
        }
        return url.lastPathComponent
    }

    private func relativePath(_ url: URL, root: URL) -> String? {
        let rootPath = root.standardizedFileURL.path
        let path = url.standardizedFileURL.path
        guard path.hasPrefix(rootPath + "/") else { return nil }
        return String(path.dropFirst(rootPath.count + 1))
    }

    private func scheduleParts(_ value: Any?) -> (kind: String?, minutes: Int?, expression: String?, display: String?) {
        guard let object = value as? [String: Any] else {
            let text = stringValue(value)
            return (nil, nil, text, text)
        }
        let kind = stringValue(object["kind"])
        let minutes = intValue(object["minutes"])
        let expression = stringValue(object["expr"]) ?? stringValue(object["run_at"])
        let display = stringValue(object["display"]) ?? expression
        return (kind, minutes, expression, display)
    }

    private func parseScheduleForHermes(_ text: String) -> (schedule: [String: Any], display: String, nextRunAt: String?) {
        if let minutes = durationMinutes(text) {
            let display = "every \(minutes)m"
            return (
                ["kind": "interval", "minutes": minutes, "display": display],
                display,
                ISO8601DateFormatter.relayConsole.string(from: Date().addingTimeInterval(TimeInterval(minutes * 60)))
            )
        }
        if text.split(separator: " ").count == 5 {
            return (["kind": "cron", "expr": text, "display": text], text, nil)
        }
        if text.contains("T") || text.range(of: #"^\d{4}-\d{2}-\d{2}"#, options: .regularExpression) != nil {
            return (["kind": "once", "run_at": text, "display": text], text, text)
        }
        return (["kind": "cron", "expr": text, "display": text], text, nil)
    }

    private func durationMinutes(_ text: String) -> Int? {
        let lower = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let patterns = [
            #"^every\s+(\d+)\s*(m|min|mins|minute|minutes)$"#,
            #"^every\s+(\d+)\s*(h|hr|hrs|hour|hours)$"#,
            #"^every\s+(\d+)\s*(d|day|days)$"#,
            #"^(\d+)\s*(m|min|mins|minute|minutes)$"#,
            #"^(\d+)\s*(h|hr|hrs|hour|hours)$"#,
            #"^(\d+)\s*(d|day|days)$"#
        ]
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern) else { continue }
            let range = NSRange(lower.startIndex..<lower.endIndex, in: lower)
            guard let match = regex.firstMatch(in: lower, range: range),
                  match.numberOfRanges > 2,
                  let numberRange = Range(match.range(at: 1), in: lower),
                  let unitRange = Range(match.range(at: 2), in: lower),
                  let number = Int(lower[numberRange])
            else { continue }
            let unit = String(lower[unitRange])
            if unit.hasPrefix("h") { return number * 60 }
            if unit.hasPrefix("d") { return number * 24 * 60 }
            return number
        }
        return nil
    }

    private func declaredSchedule(in content: String?) -> String? {
        guard let content else { return nil }
        if content.localizedCaseInsensitiveContains("every four hours") {
            return "every four hours"
        }
        return nil
    }

    private func prettyJSONString(_ object: Any) -> String? {
        guard JSONSerialization.isValidJSONObject(object),
              let data = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys])
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func stringValue(_ value: Any?) -> String? {
        switch value {
        case let value as String:
            return value.trimmedNonEmpty
        case let value as NSNumber:
            return value.stringValue
        default:
            return nil
        }
    }

    private func boolValue(_ value: Any?) -> Bool? {
        switch value {
        case let value as Bool:
            return value
        case let value as NSNumber:
            return value.boolValue
        case let value as String:
            return ["1", "true", "yes", "on", "scheduled"].contains(value.lowercased())
        default:
            return nil
        }
    }

    private func intValue(_ value: Any?) -> Int? {
        switch value {
        case let value as Int:
            return value
        case let value as NSNumber:
            return value.intValue
        case let value as String:
            return Int(value)
        default:
            return nil
        }
    }

    private func stringArray(_ value: Any?) -> [String] {
        if let values = value as? [String] {
            return values.compactMap(\.trimmedNonEmpty)
        }
        if let values = value as? [Any] {
            return values.compactMap { stringValue($0) }
        }
        if let value = stringValue(value) {
            return value
                .split(separator: ",")
                .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        }
        return []
    }

    private func safePathComponent(_ value: String, fallback: String) -> String {
        let safe = value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"[^A-Za-z0-9_.-]+"#, with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: ".-"))
        return String((safe.isEmpty ? fallback : safe).prefix(160))
    }

    private func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        return String(hash, radix: 16)
    }
}

public enum ArtifactLibraryError: LocalizedError, Sendable {
    case notWritable(String)
    case notFound(String)

    public var errorDescription: String? {
        switch self {
        case .notWritable(let message), .notFound(let message):
            return message
        }
    }
}

private let readableTextExtensions: Set<String> = [
    "md", "markdown", "txt", "json", "jsonl", "csv", "tsv", "yaml", "yml",
    "xml", "html", "htm", "log", "swift", "py", "js", "ts", "tsx", "jsx",
    "css", "scss", "sh", "rb", "go", "rs", "java", "kt", "sql"
]

private extension String {
    var trimmedNonEmpty: String? {
        let trimmed = trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    func prefixString(_ count: Int) -> String {
        String(prefix(count))
    }
}
