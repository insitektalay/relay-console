import Foundation

final class DeviceAuthCapture: @unchecked Sendable {
    private let lock = NSLock()
    private var capturedURL: String?
    private var capturedCode: String?
    private var capturedError: String?
    private var capturedOutput = ""

    func update(url: String, code: String) {
        lock.lock()
        if !url.isEmpty {
            capturedURL = url
        }
        if !code.isEmpty {
            capturedCode = code
        }
        lock.unlock()
    }

    func updateError(_ message: String) {
        lock.lock()
        capturedError = trimForStorage(message)
        lock.unlock()
    }

    func appendOutput(_ message: String) {
        lock.lock()
        capturedOutput = trimForStorage(
            capturedOutput + "\n" + CommandOutputRedactor.redact(message)
        )
        lock.unlock()
    }

    func snapshot() -> (url: String?, code: String?, error: String?) {
        lock.lock()
        defer { lock.unlock() }
        return (
            capturedURL,
            capturedCode,
            capturedError ?? (capturedOutput.isEmpty ? nil : capturedOutput)
        )
    }
}
