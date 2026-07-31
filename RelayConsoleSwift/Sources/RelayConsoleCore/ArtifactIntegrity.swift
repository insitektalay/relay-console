import CryptoKit
import Foundation

public enum RelayArtifactIntegrity {
    public static func sha256(of fileURL: URL) throws -> String {
        let handle = try FileHandle(forReadingFrom: fileURL)
        defer { try? handle.close() }
        var digest = SHA256()
        while true {
            let data = try handle.read(upToCount: 1_048_576) ?? Data()
            if data.isEmpty { break }
            digest.update(data: data)
        }
        return digest.finalize().map { String(format: "%02x", $0) }.joined()
    }

    public static func verify(_ fileURL: URL, expectedSHA256: String, label: String) throws {
        guard expectedSHA256.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil else {
            throw RelayError(.internalError, "The trusted checksum for \(label) is invalid.")
        }
        let actual = try sha256(of: fileURL)
        guard actual == expectedSHA256 else {
            try? FileManager.default.removeItem(at: fileURL)
            throw RelayError(.internalError, "\(label) failed SHA-256 verification. The download was deleted and was not executed or extracted.")
        }
    }
}
