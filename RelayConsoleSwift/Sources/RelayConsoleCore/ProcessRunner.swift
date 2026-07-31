import Foundation
#if canImport(Darwin)
import Darwin
#endif

public enum CommandTerminationReason: String, Sendable, Equatable {
    case timeout
    case outputLimit
    case lineLimit
}

public struct CommandResult: Sendable, Equatable {
    public var code: Int32
    public var stdout: String
    public var stderr: String
    public var diagnosticTail: String
    public var totalOutputBytes: Int
    public var outputTruncated: Bool
    public var terminationReason: CommandTerminationReason?

    public init(
        code: Int32,
        stdout: String,
        stderr: String,
        diagnosticTail: String? = nil,
        totalOutputBytes: Int? = nil,
        outputTruncated: Bool = false,
        terminationReason: CommandTerminationReason? = nil
    ) {
        self.code = code
        self.stdout = stdout
        self.stderr = stderr
        self.diagnosticTail = diagnosticTail ?? CommandOutputRedactor.redact(
            [stdout, stderr].filter { !$0.isEmpty }.joined(separator: "\n")
        )
        self.totalOutputBytes = totalOutputBytes ?? Data(stdout.utf8).count + Data(stderr.utf8).count
        self.outputTruncated = outputTruncated
        self.terminationReason = terminationReason
    }
}

public enum CommandExecutableAuthorization: Sendable {
    case system
    case exact(URL)
    case beneath(URL)
    case pythonVirtualEnvironment(harnessRoot: URL)
}

public enum CommandExecutionEnvironment {
    public static var minimal: [String: String] {
        let username = NSUserName()
        return [
            "HOME": FileManager.default.homeDirectoryForCurrentUser.path,
            "LANG": "en_US.UTF-8",
            "LC_ALL": "en_US.UTF-8",
            "LOGNAME": username,
            "PATH": "/usr/bin:/bin:/usr/sbin:/sbin",
            "USER": username
        ]
    }

    static func sanitized(_ supplied: [String: String]) -> [String: String] {
        var result = minimal
        for (key, value) in supplied {
            guard isValidKey(key), !isForbiddenKey(key), value.utf8.count <= 32_768 else {
                continue
            }
            if key == "PATH" {
                result[key] = sanitizedPath(value)
            } else {
                result[key] = value
            }
        }
        return result
    }

    private static func isValidKey(_ key: String) -> Bool {
        guard key.utf8.count <= 128,
              let first = key.unicodeScalars.first,
              CharacterSet.letters.union(CharacterSet(charactersIn: "_")).contains(first)
        else {
            return false
        }
        return key.unicodeScalars.allSatisfy {
            CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "_")).contains($0)
        }
    }

    private static func isForbiddenKey(_ key: String) -> Bool {
        let upper = key.uppercased()
        let exact = Set([
            "BASH_ENV", "CDPATH", "ENV", "GLOBIGNORE", "IFS", "NODE_OPTIONS",
            "NODE_PATH", "PERL5OPT", "PERL5LIB", "PYTHONHOME", "PYTHONINSPECT",
            "PYTHONSTARTUP", "RUBYOPT", "SHELLOPTS"
        ])
        return exact.contains(upper)
            || upper.hasPrefix("DYLD_")
            || upper.hasPrefix("LD_")
            || upper.hasPrefix("__XPC_")
    }

    private static func sanitizedPath(_ value: String) -> String {
        var seen = Set<String>()
        var directories: [String] = []
        for raw in value.split(separator: ":", omittingEmptySubsequences: true).prefix(32) {
            let path = String(raw)
            guard path.hasPrefix("/"),
                  !path.contains("\0"),
                  URL(fileURLWithPath: path, isDirectory: true).standardizedFileURL.path == path,
                  seen.insert(path).inserted
            else {
                continue
            }
            directories.append(path)
        }
        for required in ["/usr/bin", "/bin", "/usr/sbin", "/sbin"] where seen.insert(required).inserted {
            directories.append(required)
        }
        return directories.joined(separator: ":")
    }
}

public struct CommandOptions: Sendable {
    public var cwd: URL?
    public var env: [String: String]
    public var timeoutMs: Int
    public var executableAuthorization: CommandExecutableAuthorization
    public var maximumOutputBytes: Int
    public var maximumCapturedBytesPerStream: Int
    public var maximumLineBytes: Int
    public var maximumStdinBytes: Int
    public var onStdoutLine: (@Sendable (String) -> Void)?
    public var onStderrLine: (@Sendable (String) -> Void)?

    public init(
        cwd: URL? = nil,
        env: [String: String] = CommandExecutionEnvironment.minimal,
        timeoutMs: Int = 60_000,
        executableAuthorization: CommandExecutableAuthorization = .system,
        maximumOutputBytes: Int = 2 * 1_024 * 1_024,
        maximumCapturedBytesPerStream: Int = 512 * 1_024,
        maximumLineBytes: Int = 64 * 1_024,
        maximumStdinBytes: Int = 1_024 * 1_024,
        onStdoutLine: (@Sendable (String) -> Void)? = nil,
        onStderrLine: (@Sendable (String) -> Void)? = nil
    ) {
        self.cwd = cwd
        self.env = env
        self.timeoutMs = timeoutMs
        self.executableAuthorization = executableAuthorization
        self.maximumOutputBytes = maximumOutputBytes
        self.maximumCapturedBytesPerStream = maximumCapturedBytesPerStream
        self.maximumLineBytes = maximumLineBytes
        self.maximumStdinBytes = maximumStdinBytes
        self.onStdoutLine = onStdoutLine
        self.onStderrLine = onStderrLine
    }
}

public protocol CommandRunning {
    func run(_ command: String, _ args: [String], options: CommandOptions) async -> CommandResult
    func spawn(_ command: String, _ args: [String], options: CommandOptions, stdin: String?) async throws -> (process: Process, result: Task<CommandResult, Never>)
}

public enum CommandOutputRedactor {
    private static let patterns: [(NSRegularExpression, String)] = [
        (
            try! NSRegularExpression(
                pattern: #"(?i)(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s"',;]+"#
            ),
            "$1[REDACTED]"
        ),
        (
            try! NSRegularExpression(
                pattern: #"(?i)((?:access[_-]?token|refresh[_-]?token|api[_-]?key|secret|password|credential|user[_-]?code)\s*["']?\s*[:=]\s*["']?)[^\s"',}&]+"#
            ),
            "$1[REDACTED]"
        ),
        (
            try! NSRegularExpression(
                pattern: #"(?i)([?&](?:token|code|secret|key)=)[^&\s]+"#
            ),
            "$1[REDACTED]"
        ),
        (
            try! NSRegularExpression(pattern: #"\b(?:sk|relay)_[A-Za-z0-9._-]{8,}\b"#),
            "[REDACTED]"
        ),
        (
            try! NSRegularExpression(
                pattern: #"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b"#
            ),
            "[REDACTED]"
        ),
        (
            try! NSRegularExpression(
                pattern: #"(?i)\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b"#
            ),
            "[REDACTED]"
        )
    ]

    public static func redact(_ value: String) -> String {
        patterns.reduce(value) { current, pattern in
            pattern.0.stringByReplacingMatches(
                in: current,
                range: NSRange(current.startIndex..., in: current),
                withTemplate: pattern.1
            )
        }
    }
}

enum ProcessExecutionPolicy {
    private static let systemExecutables = Set([
        "/bin/launchctl",
        "/usr/bin/crontab",
        "/usr/bin/curl",
        "/usr/bin/git",
        "/usr/bin/tar"
    ])

    static func validateExecutable(
        _ command: String,
        authorization: CommandExecutableAuthorization,
        fileManager: FileManager = .default
    ) throws -> URL {
        guard command.hasPrefix("/"), !command.contains("\0") else {
            throw ProcessRunnerError.relativeExecutable
        }
        let candidate = URL(fileURLWithPath: command).standardizedFileURL
        guard candidate.path == command,
              fileManager.isExecutableFile(atPath: candidate.path)
        else {
            throw ProcessRunnerError.invalidExecutable
        }
        let canonicalCandidate = candidate.resolvingSymlinksInPath().standardizedFileURL
        guard fileManager.isExecutableFile(atPath: canonicalCandidate.path) else {
            throw ProcessRunnerError.invalidExecutable
        }

        let authorized: Bool
        switch authorization {
        case .system:
            authorized = systemExecutables.contains(candidate.path)
                && canonicalCandidate.path == candidate.path
        case .exact(let expected):
            let standardizedExpected = expected.standardizedFileURL
            authorized = standardizedExpected.path == candidate.path
                && standardizedExpected.resolvingSymlinksInPath().standardizedFileURL.path
                    == canonicalCandidate.path
        case .beneath(let root):
            let rootPath = root.resolvingSymlinksInPath().standardizedFileURL.path
            authorized = canonicalCandidate.path.hasPrefix(rootPath + "/")
        case .pythonVirtualEnvironment(let harnessRoot):
            authorized = isAuthorizedPythonVirtualEnvironmentExecutable(
                candidate: candidate,
                canonicalCandidate: canonicalCandidate,
                harnessRoot: harnessRoot,
                fileManager: fileManager
            )
        }
        guard authorized else {
            throw ProcessRunnerError.unauthorizedExecutable
        }
        return candidate
    }

    private static func isAuthorizedPythonVirtualEnvironmentExecutable(
        candidate: URL,
        canonicalCandidate: URL,
        harnessRoot: URL,
        fileManager: FileManager
    ) -> Bool {
        let root = harnessRoot.standardizedFileURL
        let allowedLaunchers = [
            root.appendingPathComponent(".venv/bin/python").standardizedFileURL.path,
            root.appendingPathComponent("venv/bin/python").standardizedFileURL.path
        ]
        guard allowedLaunchers.contains(candidate.path),
              isSafeExecutableFile(canonicalCandidate, fileManager: fileManager),
              canonicalCandidate.lastPathComponent.hasPrefix("python")
        else {
            return false
        }

        let virtualEnvironment = candidate
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let canonicalVirtualEnvironment = virtualEnvironment
            .resolvingSymlinksInPath()
            .standardizedFileURL
        if canonicalCandidate.path.hasPrefix(canonicalVirtualEnvironment.path + "/") {
            return true
        }

        let configuration = virtualEnvironment.appendingPathComponent("pyvenv.cfg")
        guard let data = fileManager.contents(atPath: configuration.path),
              data.count <= 64 * 1_024,
              let contents = String(data: data, encoding: .utf8),
              let configuredHome = pythonVirtualEnvironmentHome(from: contents)
        else {
            return false
        }
        let canonicalHome = configuredHome.resolvingSymlinksInPath().standardizedFileURL
        return canonicalCandidate.deletingLastPathComponent().path == canonicalHome.path
    }

    private static func pythonVirtualEnvironmentHome(from contents: String) -> URL? {
        for line in contents.split(whereSeparator: \.isNewline) {
            let parts = line.split(separator: "=", maxSplits: 1, omittingEmptySubsequences: false)
            guard parts.count == 2,
                  parts[0].trimmingCharacters(in: .whitespacesAndNewlines) == "home"
            else {
                continue
            }
            let value = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
            guard value.hasPrefix("/"), !value.contains("\0") else { return nil }
            return URL(fileURLWithPath: value, isDirectory: true).standardizedFileURL
        }
        return nil
    }

    private static func isSafeExecutableFile(
        _ executable: URL,
        fileManager: FileManager
    ) -> Bool {
        guard let attributes = try? fileManager.attributesOfItem(atPath: executable.path),
              attributes[.type] as? FileAttributeType == .typeRegular,
              let owner = attributes[.ownerAccountID] as? NSNumber,
              owner.uint32Value == 0 || owner.uint32Value == getuid(),
              let permissions = attributes[.posixPermissions] as? NSNumber,
              permissions.intValue & 0o022 == 0
        else {
            return false
        }
        return true
    }

    static func terminate(_ process: Process) {
        guard process.isRunning else { return }
        process.terminate()
        let pid = process.processIdentifier
        DispatchQueue.global().asyncAfter(deadline: .now() + 2) {
            guard process.isRunning else { return }
            #if canImport(Darwin)
            _ = kill(pid, SIGKILL)
            #else
            process.interrupt()
            #endif
        }
    }
}

private enum ProcessRunnerError: LocalizedError {
    case relativeExecutable
    case invalidExecutable
    case unauthorizedExecutable
    case invalidLimits
    case stdinLimit

    var errorDescription: String? {
        switch self {
        case .relativeExecutable:
            "Relative executable names are forbidden."
        case .invalidExecutable:
            "The executable is missing or invalid."
        case .unauthorizedExecutable:
            "The executable is not authorized for this operation."
        case .invalidLimits:
            "The command resource limits are invalid."
        case .stdinLimit:
            "The command input exceeds its byte limit."
        }
    }
}

public final class ProcessCommandRunner: CommandRunning {
    public init() {}

    public func run(_ command: String, _ args: [String], options: CommandOptions) async -> CommandResult {
        do {
            let spawned = try await spawn(command, args, options: options, stdin: nil)
            return await spawned.result.value
        } catch {
            return CommandResult(
                code: 127,
                stdout: "",
                stderr: CommandOutputRedactor.redact(error.localizedDescription)
            )
        }
    }

    public func spawn(
        _ command: String,
        _ args: [String],
        options: CommandOptions,
        stdin: String? = nil
    ) async throws -> (process: Process, result: Task<CommandResult, Never>) {
        try validate(options)
        let stdinData = stdin.map { Data($0.utf8) }
        guard (stdinData?.count ?? 0) <= options.maximumStdinBytes else {
            throw ProcessRunnerError.stdinLimit
        }
        let executable = try ProcessExecutionPolicy.validateExecutable(
            command,
            authorization: options.executableAuthorization
        )

        let process = Process()
        process.executableURL = executable
        process.arguments = args
        process.currentDirectoryURL = options.cwd
        process.environment = CommandExecutionEnvironment.sanitized(options.env)

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        let stdinPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe
        process.standardInput = stdinPipe

        let accumulator = ProcessAccumulator(
            maximumOutputBytes: options.maximumOutputBytes,
            maximumCapturedBytesPerStream: options.maximumCapturedBytesPerStream,
            maximumLineBytes: options.maximumLineBytes,
            stdoutLine: options.onStdoutLine,
            stderrLine: options.onStderrLine
        )
        accumulator.setTerminationHandler {
            ProcessExecutionPolicy.terminate(process)
        }

        stdoutPipe.fileHandleForReading.readabilityHandler = { handle in
            accumulator.appendStdout(handle.availableData)
        }
        stderrPipe.fileHandleForReading.readabilityHandler = { handle in
            accumulator.appendStderr(handle.availableData)
        }

        let timeout = ProcessTimeoutController {
            accumulator.requestTermination(.timeout)
        }
        let stream = AsyncStream<CommandResult> { continuation in
            process.terminationHandler = { finished in
                timeout.cancel()
                stdoutPipe.fileHandleForReading.readabilityHandler = nil
                stderrPipe.fileHandleForReading.readabilityHandler = nil
                accumulator.appendStdout(stdoutPipe.fileHandleForReading.readDataToEndOfFile())
                accumulator.appendStderr(stderrPipe.fileHandleForReading.readDataToEndOfFile())
                accumulator.flushLines()
                continuation.yield(accumulator.result(processStatus: finished.terminationStatus))
                continuation.finish()
                accumulator.setTerminationHandler(nil)
                finished.terminationHandler = nil
            }
        }
        let result = Task<CommandResult, Never> {
            for await value in stream {
                return value
            }
            return CommandResult(code: 127, stdout: "", stderr: "The process did not return a result.")
        }

        do {
            try process.run()
        } catch {
            timeout.cancel()
            stdoutPipe.fileHandleForReading.readabilityHandler = nil
            stderrPipe.fileHandleForReading.readabilityHandler = nil
            process.terminationHandler = nil
            accumulator.setTerminationHandler(nil)
            throw error
        }
        timeout.schedule(afterMilliseconds: options.timeoutMs)
        if let stdinData {
            stdinPipe.fileHandleForWriting.write(stdinData)
        }
        try? stdinPipe.fileHandleForWriting.close()
        return (process, result)
    }

    private func validate(_ options: CommandOptions) throws {
        guard (100...3_600_000).contains(options.timeoutMs),
              (1_024...64 * 1_024 * 1_024).contains(options.maximumOutputBytes),
              (1_024...options.maximumOutputBytes).contains(options.maximumCapturedBytesPerStream),
              (256...options.maximumOutputBytes).contains(options.maximumLineBytes),
              (0...16 * 1_024 * 1_024).contains(options.maximumStdinBytes)
        else {
            throw ProcessRunnerError.invalidLimits
        }
    }
}

private final class ProcessTimeoutController: @unchecked Sendable {
    private let lock = NSLock()
    private let action: @Sendable () -> Void
    private var workItem: DispatchWorkItem?
    private var cancelled = false

    init(action: @escaping @Sendable () -> Void) {
        self.action = action
    }

    func schedule(afterMilliseconds delay: Int) {
        let item = DispatchWorkItem { [action] in action() }
        lock.lock()
        guard !cancelled else {
            lock.unlock()
            return
        }
        workItem = item
        lock.unlock()
        DispatchQueue.global().asyncAfter(
            deadline: .now() + .milliseconds(delay),
            execute: item
        )
    }

    func cancel() {
        lock.lock()
        cancelled = true
        let item = workItem
        workItem = nil
        lock.unlock()
        item?.cancel()
    }
}

private final class ProcessAccumulator: @unchecked Sendable {
    private enum Stream {
        case stdout
        case stderr
    }

    private let lock = NSLock()
    private let maximumOutputBytes: Int
    private let maximumCapturedBytesPerStream: Int
    private let maximumLineBytes: Int
    private let stdoutLine: (@Sendable (String) -> Void)?
    private let stderrLine: (@Sendable (String) -> Void)?

    private var stdoutTail = Data()
    private var stderrTail = Data()
    private var stdoutRemainder = Data()
    private var stderrRemainder = Data()
    private var outputBytes = 0
    private var terminationReason: CommandTerminationReason?
    private var terminationHandler: (@Sendable () -> Void)?

    init(
        maximumOutputBytes: Int,
        maximumCapturedBytesPerStream: Int,
        maximumLineBytes: Int,
        stdoutLine: (@Sendable (String) -> Void)?,
        stderrLine: (@Sendable (String) -> Void)?
    ) {
        self.maximumOutputBytes = maximumOutputBytes
        self.maximumCapturedBytesPerStream = maximumCapturedBytesPerStream
        self.maximumLineBytes = maximumLineBytes
        self.stdoutLine = stdoutLine
        self.stderrLine = stderrLine
    }

    func setTerminationHandler(_ handler: (@Sendable () -> Void)?) {
        lock.lock()
        terminationHandler = handler
        lock.unlock()
    }

    func appendStdout(_ data: Data) {
        append(data, stream: .stdout)
    }

    func appendStderr(_ data: Data) {
        append(data, stream: .stderr)
    }

    func requestTermination(_ reason: CommandTerminationReason) {
        let handler: (@Sendable () -> Void)?
        lock.lock()
        if terminationReason == nil {
            terminationReason = reason
            handler = terminationHandler
        } else {
            handler = nil
        }
        lock.unlock()
        handler?()
    }

    func flushLines() {
        let stdout: String?
        let stderr: String?
        lock.lock()
        stdout = stdoutRemainder.isEmpty
            ? nil
            : String(decoding: stdoutRemainder.prefix(maximumLineBytes), as: UTF8.self)
        stderr = stderrRemainder.isEmpty
            ? nil
            : String(decoding: stderrRemainder.prefix(maximumLineBytes), as: UTF8.self)
        stdoutRemainder.removeAll(keepingCapacity: false)
        stderrRemainder.removeAll(keepingCapacity: false)
        lock.unlock()
        if let stdout { stdoutLine?(stdout) }
        if let stderr { stderrLine?(stderr) }
    }

    func result(processStatus: Int32) -> CommandResult {
        lock.lock()
        let stdout = String(decoding: stdoutTail, as: UTF8.self)
        let stderr = CommandOutputRedactor.redact(String(decoding: stderrTail, as: UTF8.self))
        let diagnostic = CommandOutputRedactor.redact(
            [stdout, String(decoding: stderrTail, as: UTF8.self)]
                .filter { !$0.isEmpty }
                .joined(separator: "\n")
        )
        let reason = terminationReason
        let total = outputBytes
        let captured = stdoutTail.count + stderrTail.count
        lock.unlock()

        let code: Int32
        switch reason {
        case .timeout:
            code = 124
        case .outputLimit, .lineLimit:
            code = 125
        case nil:
            code = processStatus
        }
        return CommandResult(
            code: code,
            stdout: stdout,
            stderr: stderr,
            diagnosticTail: diagnostic,
            totalOutputBytes: total,
            outputTruncated: total > captured || reason != nil,
            terminationReason: reason
        )
    }

    private func append(_ data: Data, stream: Stream) {
        guard !data.isEmpty else { return }
        var completedLines: [String] = []
        var reasonToRequest: CommandTerminationReason?
        var handler: (@Sendable () -> Void)?

        lock.lock()
        outputBytes = outputBytes > Int.max - data.count ? Int.max : outputBytes + data.count
        switch stream {
        case .stdout:
            appendTail(data, to: &stdoutTail)
            if appendLines(data, to: &stdoutRemainder, completed: &completedLines)
                || stdoutRemainder.count > maximumLineBytes
            {
                reasonToRequest = .lineLimit
                stdoutRemainder = Data(stdoutRemainder.suffix(maximumLineBytes))
            }
        case .stderr:
            appendTail(data, to: &stderrTail)
            if appendLines(data, to: &stderrRemainder, completed: &completedLines)
                || stderrRemainder.count > maximumLineBytes
            {
                reasonToRequest = .lineLimit
                stderrRemainder = Data(stderrRemainder.suffix(maximumLineBytes))
            }
        }
        if outputBytes > maximumOutputBytes {
            reasonToRequest = .outputLimit
        }
        if let reasonToRequest, terminationReason == nil {
            terminationReason = reasonToRequest
            handler = terminationHandler
        }
        lock.unlock()

        let callback = stream == .stdout ? stdoutLine : stderrLine
        for line in completedLines {
            callback?(line)
        }
        handler?()
    }

    private func appendTail(_ data: Data, to tail: inout Data) {
        tail.append(data)
        if tail.count > maximumCapturedBytesPerStream {
            tail = Data(tail.suffix(maximumCapturedBytesPerStream))
        }
    }

    private func appendLines(
        _ data: Data,
        to remainder: inout Data,
        completed: inout [String]
    ) -> Bool {
        var exceededLimit = false
        remainder.append(data)
        while let newline = remainder.firstIndex(of: 0x0A) {
            var line = Data(remainder[..<newline])
            remainder.removeSubrange(...newline)
            if line.last == 0x0D {
                line.removeLast()
            }
            if line.count > maximumLineBytes {
                exceededLimit = true
                line = Data(line.prefix(maximumLineBytes))
            }
            completed.append(String(decoding: line, as: UTF8.self))
        }
        return exceededLimit
    }
}
