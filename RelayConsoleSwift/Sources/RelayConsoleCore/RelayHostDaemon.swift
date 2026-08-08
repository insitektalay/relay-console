import Darwin
import CryptoKit
import Foundation

public struct RelayHostDaemonStatus: Codable, Sendable {
    public var state: String
    public var pid: Int32
    public var connectedWorkspaceCount: Int
    public var updatedAt: String
    public var lastError: String?
    public var executableIdentity: String?

    public init(
        state: String,
        pid: Int32,
        connectedWorkspaceCount: Int,
        updatedAt: String,
        lastError: String?,
        executableIdentity: String? = nil
    ) {
        self.state = state
        self.pid = pid
        self.connectedWorkspaceCount = connectedWorkspaceCount
        self.updatedAt = updatedAt
        self.lastError = lastError
        self.executableIdentity = executableIdentity
    }
}

/// Owns the Railway runtime connection outside the Relay Console UI process.
/// The existing CloudRuntimeDeviceTransport remains the protocol engine, so
/// token refresh, registration acknowledgement, reconnect, and automatic link
/// repair keep the behaviour that was already integrated.
public final class RelayHostDaemon: @unchecked Sendable {
    private let services: RelayConsoleServices
    private var bridges: [String: CloudRuntimeDeviceTransport] = [:]
    private let statusURL: URL
    private let executableIdentity: String?

    public init(services: RelayConsoleServices) {
        self.services = services
        self.statusURL = RelayHostServiceManager.statusURL(paths: services.paths)
        self.executableIdentity = Bundle.main.executableURL.flatMap {
            RelayHostServiceManager.executableIdentity(at: $0)
        }
    }

    public func run() async throws {
        try writeStatus(state: "starting", lastError: nil)
        while !Task.isCancelled {
            var lastError: String?
            do {
                try await recoverConnections()
            } catch {
                lastError = error.localizedDescription
            }
            try writeStatus(
                state: lastError == nil ? "ready" : "recovering",
                lastError: lastError
            )
            try await Task.sleep(for: .seconds(10))
        }
    }

    private func recoverConnections() async throws {
        let deployments = Dictionary(
            uniqueKeysWithValues: try services.cloudConnections.listDeployments()
                .filter(\.active)
                .map { ($0.id, $0) }
        )
        let accounts = Dictionary(
            uniqueKeysWithValues: try services.cloudConnections.listAccounts()
                .map { ($0.id, $0) }
        )
        let links = try services.cloudSync.listLinks().filter {
            ![CloudSyncLinkState.unlinked, .revoked].contains($0.state)
        }

        let activeLinkIds = Set(links.map(\.id))
        for staleId in Array(bridges.keys) where !activeLinkIds.contains(staleId) {
            bridges[staleId]?.disconnectWebSocket()
            bridges[staleId] = nil
        }

        for link in links {
            if bridges[link.id] != nil,
               try localDeviceState(syncLinkId: link.id) == "online" {
                continue
            }
            bridges[link.id]?.disconnectWebSocket()
            bridges[link.id] = nil

            guard let account = accounts[link.accountId],
                  let deployment = deployments[account.deploymentId],
                  let apiURL = URL(string: deployment.apiBaseURL),
                  let websocketURL = URL(string: deployment.websocketBaseURL)
            else { continue }

            let transport = try URLSessionRelayCloudTransport(apiBaseURL: apiURL)
            let token = try await services.cloudConnections.validAccessToken(
                accountId: account.id,
                transport: transport
            )
            let bridge = services.cloudRuntimeDeviceTransport(using: transport)
            try await bridge.ensureConnected(
                syncLinkId: link.id,
                workspaceId: link.remoteWorkspaceId,
                userAccessToken: token,
                websocketBaseURL: websocketURL,
                deviceLabel: Host.current().localizedName ?? "Mac"
            )
            bridges[link.id] = bridge
            _ = try await services.cloudSync.repairAutomaticConnectAgentLinks(
                localWorkspaceId: link.localWorkspaceId
            )
        }
    }

    private func localDeviceState(syncLinkId: String) throws -> String? {
        try services.database.get(
            "SELECT state FROM cloud_runtime_devices WHERE sync_link_id=? AND revoked_at IS NULL ORDER BY updated_at DESC LIMIT 1",
            [.text(syncLinkId)]
        )?["state"]?.string
    }

    private func writeStatus(state: String, lastError: String?) throws {
        let status = RelayHostDaemonStatus(
            state: state,
            pid: getpid(),
            connectedWorkspaceCount: bridges.count,
            updatedAt: nowIso(),
            lastError: lastError,
            executableIdentity: executableIdentity
        )
        try FileManager.default.createDirectory(
            at: statusURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try JSONEncoder().encode(status).write(to: statusURL, options: [.atomic])
    }
}

public final class RelayHostServiceManager: @unchecked Sendable {
    public static let launchdLabel = "work.relayconsole.host"

    private let paths: RelayConsolePaths
    private let runner: CommandRunning
    private let fileManager: FileManager
    private let executableURL: URL?

    public init(
        paths: RelayConsolePaths,
        runner: CommandRunning = ProcessCommandRunner(),
        fileManager: FileManager = .default,
        executableURL: URL? = nil
    ) {
        self.paths = paths
        self.runner = runner
        self.fileManager = fileManager
        self.executableURL = executableURL
    }

    public static func statusURL(paths: RelayConsolePaths) -> URL {
        paths.root.appendingPathComponent("relay-host/status.json")
    }

    public static func executableIdentity(at executable: URL) -> String? {
        guard let handle = try? FileHandle(forReadingFrom: executable) else { return nil }
        defer { try? handle.close() }
        var hasher = SHA256()
        do {
            while let chunk = try handle.read(upToCount: 1_048_576), !chunk.isEmpty {
                hasher.update(data: chunk)
            }
        } catch {
            return nil
        }
        return hasher.finalize().map { String(format: "%02x", $0) }.joined()
    }

    public func ensureRunning() async -> Bool {
        guard ProcessInfo.processInfo.environment["RELAY_HOST_DISABLE_SERVICE"] != "1",
              let executable = bundledExecutable(),
              fileManager.isExecutableFile(atPath: executable.path),
              let executableIdentity = Self.executableIdentity(at: executable)
        else { return false }
        let activeOwner = isHealthy() || isActiveOwner()
        if activeOwner && isCurrentOwner(executableIdentity: executableIdentity) { return true }
        let replaceActiveOwner = activeOwner
            && !isCurrentOwner(executableIdentity: executableIdentity)

        do {
            let plist = try launchAgentData(executable: executable)
            let plistURL = launchAgentURL()
            try fileManager.createDirectory(
                at: plistURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try plist.write(to: plistURL, options: [.atomic])
            let domain = "gui/\(getuid())"
            let bootstrap = await runner.run(
                "/bin/launchctl",
                ["bootstrap", domain, plistURL.path],
                options: CommandOptions(
                    timeoutMs: 15_000,
                    executableAuthorization: .system
                )
            )
            let kickstart = await runner.run(
                "/bin/launchctl",
                replaceActiveOwner
                    ? ["kickstart", "-k", "\(domain)/\(Self.launchdLabel)"]
                    : ["kickstart", "\(domain)/\(Self.launchdLabel)"],
                options: CommandOptions(
                    timeoutMs: 15_000,
                    executableAuthorization: .system
                )
            )
            guard bootstrap.code == 0 || kickstart.code == 0 else { return false }
            for _ in 0..<300 {
                if isCurrentOwner(executableIdentity: executableIdentity),
                   isHealthy() || isActiveOwner() {
                    return true
                }
                try? await Task.sleep(for: .milliseconds(100))
            }
            return false
        } catch {
            return false
        }
    }

    public func isHealthy(now: Date = Date()) -> Bool {
        guard let data = try? Data(contentsOf: Self.statusURL(paths: paths)),
              let status = try? JSONDecoder().decode(RelayHostDaemonStatus.self, from: data),
              status.state == "ready",
              status.connectedWorkspaceCount > 0,
              let updatedAt = ISO8601DateFormatter.relayConsole.date(from: status.updatedAt),
              now.timeIntervalSince(updatedAt) < 45,
              kill(status.pid, 0) == 0
        else { return false }
        return true
    }

    public func isActiveOwner(now: Date = Date()) -> Bool {
        guard let data = try? Data(contentsOf: Self.statusURL(paths: paths)),
              let status = try? JSONDecoder().decode(RelayHostDaemonStatus.self, from: data),
              ["starting", "recovering", "ready"].contains(status.state),
              let updatedAt = ISO8601DateFormatter.relayConsole.date(from: status.updatedAt),
              now.timeIntervalSince(updatedAt) < 45,
              kill(status.pid, 0) == 0
        else { return false }
        return true
    }

    public func isCurrentOwner(executable: URL) -> Bool {
        guard let executableIdentity = Self.executableIdentity(at: executable)
        else { return false }
        return isCurrentOwner(executableIdentity: executableIdentity)
    }

    private func isCurrentOwner(executableIdentity: String) -> Bool {
        guard let data = try? Data(contentsOf: Self.statusURL(paths: paths)),
              let status = try? JSONDecoder().decode(RelayHostDaemonStatus.self, from: data),
              status.executableIdentity == executableIdentity,
              ["starting", "recovering", "ready"].contains(status.state),
              kill(status.pid, 0) == 0
        else { return false }
        return true
    }

    public func uninstall() async {
        let domain = "gui/\(getuid())"
        _ = await runner.run(
            "/bin/launchctl",
            ["bootout", "\(domain)/\(Self.launchdLabel)"],
            options: CommandOptions(
                timeoutMs: 15_000,
                executableAuthorization: .system
            )
        )
        try? fileManager.removeItem(at: launchAgentURL())
        try? fileManager.removeItem(at: Self.statusURL(paths: paths))
    }

    private func bundledExecutable() -> URL? {
        if let executableURL { return executableURL }
        let candidate = Bundle.main.bundleURL
            .appendingPathComponent("Contents/MacOS/RelayHostService")
        return fileManager.fileExists(atPath: candidate.path) ? candidate : nil
    }

    private func launchAgentURL() -> URL {
        fileManager.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/LaunchAgents", isDirectory: true)
            .appendingPathComponent("\(Self.launchdLabel).plist")
    }

    private func launchAgentData(executable: URL) throws -> Data {
        let logDirectory = paths.root.appendingPathComponent("logs", isDirectory: true)
        try fileManager.createDirectory(at: logDirectory, withIntermediateDirectories: true)
        let plist: [String: Any] = [
            "Label": Self.launchdLabel,
            "ProgramArguments": [executable.path],
            "RunAtLoad": true,
            "KeepAlive": true,
            "ProcessType": "Background",
            "StandardOutPath": logDirectory.appendingPathComponent("relay-host.log").path,
            "StandardErrorPath": logDirectory.appendingPathComponent("relay-host-error.log").path,
        ]
        return try PropertyListSerialization.data(
            fromPropertyList: plist,
            format: .xml,
            options: 0
        )
    }
}
