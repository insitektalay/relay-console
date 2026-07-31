import Foundation

public func nowIso() -> String {
    ISO8601DateFormatter.relayConsole.string(from: Date())
}

public func createRelayId(_ prefix: String) -> String {
    "\(prefix)_\(UUID().uuidString.lowercased())"
}

extension ISO8601DateFormatter {
    public static let relayConsole: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
