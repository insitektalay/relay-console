import Foundation

public enum RelayBridgeInstallRuntime: String, Sendable, CaseIterable {
    case hermes
    case openclaw
}

public struct RelayBridgeInstallRequest: Sendable {
    public var runtime: RelayBridgeInstallRuntime
    public var runtimePath: URL?
    public var apiOrigin: String
    public var pairingCode: String
    public var deviceLabel: String
    public var externalAgentIds: [String]

    public init(
        runtime: RelayBridgeInstallRuntime,
        runtimePath: URL? = nil,
        apiOrigin: String,
        pairingCode: String,
        deviceLabel: String,
        externalAgentIds: [String] = []
    ) {
        self.runtime = runtime
        self.runtimePath = runtimePath
        self.apiOrigin = apiOrigin
        self.pairingCode = pairingCode
        self.deviceLabel = deviceLabel
        self.externalAgentIds = externalAgentIds
    }
}

public enum RelayBridgeInstallerError: LocalizedError {
    case checkoutFailed(String)
    case revisionMismatch
    case installFailed(String)
    case activationFailedAndRestored
    case invalidPairingCode

    public var errorDescription: String? {
        switch self {
        case .checkoutFailed(let detail): return "Relay could not download the pinned bridge installer. \(detail)"
        case .revisionMismatch: return "The downloaded bridge installer did not match Relay’s pinned source revision."
        case .installFailed(let detail): return "The Relay bridge could not be installed. \(detail)"
        case .activationFailedAndRestored:
            return "Relay could not replace the running bridge, so the previous bridge was restored and remains available. Wait a moment, then retry. Do not use sudo."
        case .invalidPairingCode: return "Generate a new one-time bridge pairing code and try again."
        }
    }
}

public final class RelayBridgeInstaller: @unchecked Sendable {
    public static let repositoryURL = "https://github.com/insitektalay/relay-console-bridge-plugins.git"
    public static let pinnedRevision = "c030b8ee6eb5b23f370b9086b61dc574179f7465"
    public static let apiContractVersion = "v2"
    public static let websocketContractVersion = "bridge.v1"

    public static func pluginVersion(for runtime: RelayBridgeInstallRuntime) -> String {
        switch runtime {
        case .hermes: return "0.3.0-rc.6"
        case .openclaw: return "2026.7.31-rc.1"
        }
    }

    public static func capabilities(for runtime: RelayBridgeInstallRuntime) -> [String] {
        let shared = [
            "clawchat.bridge.rotating_credentials.v1",
            "clawchat.agent_replica_sync",
            "clawchat.runtime.structured_jobs",
            "clawchat.runtime.structured_output"
        ]
        switch runtime {
        case .hermes:
            return [
                "clawchat.runtime.hermes",
                "clawchat.marketplace.tools",
                MarketplaceHermesSkillInstaller.capability
            ] + shared
        case .openclaw:
            return ["clawchat.runtime.openclaw", "clawchat.attachments.local_media"] + shared
        }
    }

    private let checkoutRoot: URL
    private let runner: CommandRunning
    private let fileManager: FileManager

    public init(
        cacheDirectory: URL,
        runner: CommandRunning = ProcessCommandRunner(),
        fileManager: FileManager = .default
    ) {
        self.checkoutRoot = cacheDirectory
            .appendingPathComponent("relay-bridge-installer", isDirectory: true)
            .appendingPathComponent(Self.pinnedRevision, isDirectory: true)
        self.runner = runner
        self.fileManager = fileManager
    }

    public static func terminalCommand(
        runtime: RelayBridgeInstallRuntime,
        apiOrigin: String,
        runtimePath: String? = nil,
        externalAgentIds: [String] = []
    ) -> String {
        let pathArgument = runtimePath.map { " --runtime-path \(shellQuote($0))" } ?? ""
        let agentArguments = runtime == .hermes
            ? normalizedExternalAgentIds(externalAgentIds).map { " --agent \(shellQuote($0))" }.joined()
            : ""
        return [
            "RELAY_BRIDGE_INSTALL=\"$(mktemp -d)\"",
            "git init \"$RELAY_BRIDGE_INSTALL\"",
            "git -C \"$RELAY_BRIDGE_INSTALL\" remote add origin \(shellQuote(repositoryURL))",
            "git -C \"$RELAY_BRIDGE_INSTALL\" fetch --depth 1 origin \(pinnedRevision)",
            "git -C \"$RELAY_BRIDGE_INSTALL\" checkout --detach FETCH_HEAD",
            "\"$RELAY_BRIDGE_INSTALL/install.sh\" --runtime \(runtime.rawValue) --api-url \(shellQuote(apiOrigin))\(pathArgument)\(agentArguments)"
        ].joined(separator: " && ")
    }

    public func install(_ request: RelayBridgeInstallRequest) async throws -> CommandResult {
        guard !request.pairingCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              request.pairingCode.utf8.count <= 4_096
        else { throw RelayBridgeInstallerError.invalidPairingCode }

        let checkout = try await preparePinnedCheckout()
        let installer = checkout.appendingPathComponent("install.sh")
        var args = [
            "--runtime", request.runtime.rawValue,
            "--api-url", request.apiOrigin,
            "--label", request.deviceLabel
        ]
        if let runtimePath = request.runtimePath {
            args += ["--runtime-path", runtimePath.standardizedFileURL.path]
        }
        if request.runtime == .hermes {
            for externalAgentId in Self.normalizedExternalAgentIds(request.externalAgentIds) {
                args += ["--agent", externalAgentId]
            }
        }
        var environment = CommandExecutionEnvironment.minimal
        environment["PATH"] = [
            "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"
        ].joined(separator: ":")
        let process = try await runner.spawn(
            installer.path,
            args,
            options: CommandOptions(
                cwd: checkout,
                env: environment,
                timeoutMs: 15 * 60 * 1_000,
                executableAuthorization: .beneath(checkout),
                maximumOutputBytes: 4 * 1_024 * 1_024,
                maximumCapturedBytesPerStream: 1 * 1_024 * 1_024
            ),
            stdin: request.pairingCode + "\n"
        )
        let result = await process.result.value
        guard result.code == 0 else {
            if result.diagnosticTail.contains("previous bridge was restored") {
                throw RelayBridgeInstallerError.activationFailedAndRestored
            }
            throw RelayBridgeInstallerError.installFailed(Self.conciseDiagnostic(result.diagnosticTail))
        }
        return result
    }

    private static func normalizedExternalAgentIds(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.compactMap { value in
            let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalized.isEmpty, normalized.utf8.count <= 512, seen.insert(normalized).inserted else {
                return nil
            }
            return normalized
        }.prefix(250).map { $0 }
    }

    private static func conciseDiagnostic(_ detail: String) -> String {
        let summary = detail.split(whereSeparator: \.isNewline)
            .map(String.init)
            .filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
            .suffix(4)
            .joined(separator: " ")
        return String(summary.prefix(800))
    }

    private func preparePinnedCheckout() async throws -> URL {
        if fileManager.fileExists(atPath: checkoutRoot.appendingPathComponent("install.sh").path),
           await isPinnedCheckoutValid(at: checkoutRoot) {
            return checkoutRoot
        }
        if fileManager.fileExists(atPath: checkoutRoot.path) {
            try fileManager.removeItem(at: checkoutRoot)
        }
        try fileManager.createDirectory(
            at: checkoutRoot,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        for args in [
            ["init", checkoutRoot.path],
            ["-C", checkoutRoot.path, "remote", "add", "origin", Self.repositoryURL],
            ["-C", checkoutRoot.path, "fetch", "--depth", "1", "origin", Self.pinnedRevision],
            ["-C", checkoutRoot.path, "checkout", "--detach", "FETCH_HEAD"]
        ] {
            let result = await runner.run(
                "/usr/bin/git",
                args,
                options: CommandOptions(timeoutMs: 120_000, executableAuthorization: .system)
            )
            guard result.code == 0 else {
                throw RelayBridgeInstallerError.checkoutFailed(result.diagnosticTail)
            }
        }
        guard await isPinnedCheckoutValid(at: checkoutRoot) else {
            throw RelayBridgeInstallerError.revisionMismatch
        }
        return checkoutRoot
    }

    private func isPinnedCheckoutValid(at checkout: URL) async -> Bool {
        guard await currentRevision(at: checkout) == Self.pinnedRevision else { return false }
        let diff = await runner.run(
            "/usr/bin/git",
            ["-C", checkout.path, "diff", "--quiet", "HEAD", "--"],
            options: CommandOptions(timeoutMs: 30_000, executableAuthorization: .system)
        )
        guard diff.code == 0 else { return false }
        let status = await runner.run(
            "/usr/bin/git",
            ["-C", checkout.path, "status", "--porcelain", "--untracked-files=all"],
            options: CommandOptions(timeoutMs: 30_000, executableAuthorization: .system)
        )
        return status.code == 0
            && status.stdout.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func currentRevision(at checkout: URL) async -> String? {
        let result = await runner.run(
            "/usr/bin/git",
            ["-C", checkout.path, "rev-parse", "HEAD"],
            options: CommandOptions(timeoutMs: 30_000, executableAuthorization: .system)
        )
        guard result.code == 0 else { return nil }
        return result.stdout.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func shellQuote(_ value: String) -> String {
        "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }
}
