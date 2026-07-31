import Darwin
import Foundation

public enum MarketplaceRuntimeBrokerEndpoint {
    public static let socketPathEnvironmentKey = "RELAY_MARKETPLACE_BROKER_SOCKET_PATH"
    public static let tokenPathEnvironmentKey = "RELAY_MARKETPLACE_BROKER_TOKEN_PATH"

    public static func socketPath(forRoot root: URL) -> String {
        let suffix = stableSuffix(root.standardizedFileURL.path)
        return FileManager.default.temporaryDirectory
            .appendingPathComponent("relay-console-\(getuid())-\(suffix).sock")
            .path
    }

    public static func tokenPath(forRoot root: URL) -> URL {
        root
            .appendingPathComponent("marketplace-runtime", isDirectory: true)
            .appendingPathComponent("broker.token")
    }

    @discardableResult
    public static func ensureTokenFile(forRoot root: URL) throws -> URL {
        let url = tokenPath(forRoot: root)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        if let existing = try? String(contentsOf: url, encoding: .utf8),
           !existing.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
            return url
        }
        let token = "\(UUID().uuidString)-\(UUID().uuidString)"
        try token.write(to: url, atomically: true, encoding: .utf8)
        try? FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
        return url
    }

    private static func stableSuffix(_ value: String) -> String {
        var hash: UInt64 = 1469598103934665603
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 1099511628211
        }
        return String(String(hash, radix: 16).suffix(12))
    }
}

public struct MarketplaceRuntimeBrokerIPCRequest: Codable, Equatable, Sendable {
    public var token: String
    public var toolName: String
    public var arguments: JSONRecord
    public var runtime: MarketplaceRuntimeToolExecutionContext

    public init(
        token: String,
        toolName: String,
        arguments: JSONRecord,
        runtime: MarketplaceRuntimeToolExecutionContext
    ) {
        self.token = token
        self.toolName = toolName
        self.arguments = arguments
        self.runtime = runtime
    }
}

public final class MarketplaceRuntimeBrokerServer {
    private let root: URL
    private let bridge: MarketplaceRuntimeToolBridgeService
    private let queue = DispatchQueue(label: "relay.marketplace.runtime-broker.server")
    private let clientQueue = DispatchQueue(label: "relay.marketplace.runtime-broker.clients", attributes: .concurrent)
    private let lock = NSLock()
    private var listenFileDescriptor: Int32 = -1
    private var running = false
    private var token = ""

    public init(root: URL, bridge: MarketplaceRuntimeToolBridgeService) {
        self.root = root
        self.bridge = bridge
    }

    deinit {
        stop()
    }

    public var socketPath: String {
        MarketplaceRuntimeBrokerEndpoint.socketPath(forRoot: root)
    }

    public var tokenPath: URL {
        MarketplaceRuntimeBrokerEndpoint.tokenPath(forRoot: root)
    }

    public func start() throws {
        lock.lock()
        let alreadyRunning = running
        lock.unlock()
        guard !alreadyRunning else { return }

        let tokenURL = try MarketplaceRuntimeBrokerEndpoint.ensureTokenFile(forRoot: root)
        let loadedToken = try Self.readToken(from: tokenURL)
        let path = socketPath
        try? FileManager.default.removeItem(atPath: path)

        let fd = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard fd >= 0 else {
            throw RelayError(.dispatchFailed, "Relay Marketplace runtime broker socket could not be created.")
        }
        do {
            try Self.withSockaddr(path: path) { address, length in
                guard Darwin.bind(fd, address, length) == 0 else {
                    throw RelayError(.dispatchFailed, "Relay Marketplace runtime broker socket could not bind.")
                }
            }
            Darwin.chmod(path, S_IRUSR | S_IWUSR)
            guard Darwin.listen(fd, 16) == 0 else {
                throw RelayError(.dispatchFailed, "Relay Marketplace runtime broker socket could not listen.")
            }
        } catch {
            Darwin.close(fd)
            try? FileManager.default.removeItem(atPath: path)
            throw error
        }

        lock.lock()
        listenFileDescriptor = fd
        token = loadedToken
        running = true
        lock.unlock()

        queue.async { [weak self] in
            self?.acceptLoop()
        }
    }

    public func stop() {
        lock.lock()
        let fd = listenFileDescriptor
        listenFileDescriptor = -1
        running = false
        lock.unlock()
        if fd >= 0 {
            Darwin.shutdown(fd, SHUT_RDWR)
            Darwin.close(fd)
        }
        try? FileManager.default.removeItem(atPath: socketPath)
    }

    private func acceptLoop() {
        while isRunning {
            let fd = currentFileDescriptor
            guard fd >= 0 else { break }
            let client = Darwin.accept(fd, nil, nil)
            if client >= 0 {
                clientQueue.async { [weak self] in
                    self?.handleClient(client)
                }
                continue
            }
            if errno == EINTR {
                continue
            }
            if !isRunning {
                break
            }
        }
    }

    private var isRunning: Bool {
        lock.lock()
        defer { lock.unlock() }
        return running
    }

    private var currentFileDescriptor: Int32 {
        lock.lock()
        defer { lock.unlock() }
        return listenFileDescriptor
    }

    private func handleClient(_ fd: Int32) {
        defer { Darwin.close(fd) }
        do {
            let requestData = try Self.readAll(from: fd, maxBytes: 1_000_000)
            let request = try jsonDecoder.decode(MarketplaceRuntimeBrokerIPCRequest.self, from: requestData)
            guard request.token == token else {
                throw RelayError(.permissionDenied, "Relay Marketplace runtime broker token was invalid.")
            }
            let result = try bridge.execute(
                toolName: request.toolName,
                payload: request.arguments,
                runtime: request.runtime
            )
            try Self.writeAll(jsonEncoder.encode(result), to: fd)
        } catch {
            let record = Self.errorRecord(error)
            if let data = try? jsonEncoder.encode(record) {
                try? Self.writeAll(data, to: fd)
            }
        }
    }

    private static func errorRecord(_ error: Error) -> JSONRecord {
        if let guardResult = error as? ServiceGuardResult {
            var record: JSONRecord = [
                "ok": .bool(false),
                "error": .string(guardResult.message),
                "stateKind": .string(guardResult.stateKind.rawValue),
                "reasonCode": .string(guardResult.reasonCode.rawValue),
                "correlationId": .string(guardResult.correlationId),
                "auditRequired": .bool(guardResult.auditRequired),
                "retryable": .bool(guardResult.retryable),
                "redactionStatus": .string("private-state-excluded")
            ]
            if let recovery = guardResult.recovery {
                record["recovery"] = .string(recovery)
            }
            if let decisionId = guardResult.decisionId {
                record["decisionId"] = .string(decisionId)
            }
            return record
        }
        return [
            "ok": .bool(false),
            "error": .string(error.localizedDescription),
            "redactionStatus": .string("private-state-excluded")
        ]
    }

    private static func readToken(from url: URL) throws -> String {
        let token = try String(contentsOf: url, encoding: .utf8)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty else {
            throw RelayError(.dispatchFailed, "Relay Marketplace runtime broker token is missing.")
        }
        return token
    }

    fileprivate static func readAll(from fd: Int32, maxBytes: Int) throws -> Data {
        var output = Data()
        var buffer = [UInt8](repeating: 0, count: 8192)
        while true {
            let capacity = buffer.count
            let count = buffer.withUnsafeMutableBytes { pointer in
                Darwin.read(fd, pointer.baseAddress, capacity)
            }
            if count > 0 {
                output.append(buffer, count: count)
                if output.count > maxBytes {
                    throw RelayError(.invalidInput, "Relay Marketplace runtime broker request was too large.")
                }
                continue
            }
            if count == 0 {
                return output
            }
            if errno == EINTR {
                continue
            }
            throw RelayError(.dispatchFailed, "Relay Marketplace runtime broker socket read failed.")
        }
    }

    fileprivate static func writeAll(_ data: Data, to fd: Int32) throws {
        try data.withUnsafeBytes { (rawBuffer: UnsafeRawBufferPointer) in
            guard let base = rawBuffer.baseAddress else { return }
            var written = 0
            while written < rawBuffer.count {
                let count = Darwin.write(fd, base.advanced(by: written), rawBuffer.count - written)
                if count > 0 {
                    written += count
                    continue
                }
                if count < 0, errno == EINTR {
                    continue
                }
                throw RelayError(.dispatchFailed, "Relay Marketplace runtime broker socket write failed.")
            }
        }
    }

    fileprivate static func withSockaddr<T>(path: String, _ body: (UnsafePointer<sockaddr>, socklen_t) throws -> T) throws -> T {
        var address = sockaddr_un()
        #if os(macOS)
        address.sun_len = UInt8(MemoryLayout<sockaddr_un>.size)
        #endif
        address.sun_family = sa_family_t(AF_UNIX)
        let maxPathLength = MemoryLayout.size(ofValue: address.sun_path)
        let bytes = Array(path.utf8)
        guard bytes.count < maxPathLength else {
            throw RelayError(.invalidInput, "Relay Marketplace runtime broker socket path is too long.")
        }
        withUnsafeMutablePointer(to: &address.sun_path) { pointer in
            pointer.withMemoryRebound(to: CChar.self, capacity: maxPathLength) { rebound in
                for index in 0..<maxPathLength {
                    rebound[index] = 0
                }
                for (index, byte) in bytes.enumerated() {
                    rebound[index] = CChar(bitPattern: byte)
                }
            }
        }
        return try withUnsafePointer(to: &address) { pointer in
            try pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) { rebound in
                try body(rebound, socklen_t(MemoryLayout<sockaddr_un>.size))
            }
        }
    }
}

public enum MarketplaceRuntimeBrokerClient {
    public static func executeIfConfigured(
        toolName: String,
        arguments: JSONRecord,
        runtime: MarketplaceRuntimeToolExecutionContext,
        environment: [String: String]
    ) throws -> JSONRecord? {
        guard let socketPath = nonEmpty(environment[MarketplaceRuntimeBrokerEndpoint.socketPathEnvironmentKey]),
              let tokenPath = nonEmpty(environment[MarketplaceRuntimeBrokerEndpoint.tokenPathEnvironmentKey])
        else {
            return nil
        }
        let token = try String(contentsOf: URL(fileURLWithPath: tokenPath), encoding: .utf8)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !token.isEmpty else {
            throw RelayError(.dispatchFailed, "Relay Marketplace runtime broker token is missing.")
        }
        let request = MarketplaceRuntimeBrokerIPCRequest(
            token: token,
            toolName: toolName,
            arguments: arguments,
            runtime: runtime
        )
        let requestData = try jsonEncoder.encode(request)
        let fd = Darwin.socket(AF_UNIX, SOCK_STREAM, 0)
        guard fd >= 0 else {
            throw RelayError(.dispatchFailed, "Relay Marketplace runtime broker client socket could not be created.")
        }
        defer { Darwin.close(fd) }
        try MarketplaceRuntimeBrokerServer.withSockaddr(path: socketPath) { address, length in
            guard Darwin.connect(fd, address, length) == 0 else {
                throw RelayError(.dispatchFailed, "Relay Marketplace runtime broker is not available.")
            }
        }
        try MarketplaceRuntimeBrokerServer.writeAll(requestData, to: fd)
        Darwin.shutdown(fd, SHUT_WR)
        let responseData = try MarketplaceRuntimeBrokerServer.readAll(from: fd, maxBytes: 2_000_000)
        return try jsonDecoder.decode(JSONRecord.self, from: responseData)
    }
    private static func nonEmpty(_ value: String?) -> String? {
        guard let value else {
            return nil
        }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }
}
