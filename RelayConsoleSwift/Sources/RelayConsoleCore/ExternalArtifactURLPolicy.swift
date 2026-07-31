import Foundation

public struct ExternalArtifactDestination: Equatable, Sendable {
    public let url: URL
    public let normalizedURL: String
    public let host: String
}

public enum ExternalArtifactURLPolicy {
    public static let blockedReason =
        "External artifact link blocked because it does not use an approved HTTPS URL."

    private static let disallowedScalars: Set<UInt32> = {
        var values = Set<UInt32>()
        values.formUnion(0x00...0x1F)
        values.formUnion(0x7F...0x9F)
        values.formUnion(0x200B...0x200F)
        values.formUnion(0x202A...0x202E)
        values.formUnion(0x2060...0x206F)
        values.insert(0xFEFF)
        return values
    }()

    public static func destination(_ value: String?) -> ExternalArtifactDestination? {
        guard let value,
              !value.isEmpty,
              value.utf16.count <= 2_000,
              value == value.trimmingCharacters(in: .whitespacesAndNewlines),
              value.lowercased().hasPrefix("https://"),
              !value.contains("\\"),
              !value.unicodeScalars.contains(where: { disallowedScalars.contains($0.value) }),
              var components = URLComponents(string: value),
              components.scheme?.lowercased() == "https",
              let hostname = components.host?.lowercased(),
              !hostname.isEmpty,
              components.user == nil,
              components.password == nil
        else {
            return nil
        }

        components.scheme = "https"
        components.host = hostname
        if components.port == 443 {
            components.port = nil
        }
        guard let url = components.url, url.scheme == "https" else {
            return nil
        }
        let host = components.port.map { "\(hostname):\($0)" } ?? hostname
        return ExternalArtifactDestination(
            url: url,
            normalizedURL: url.absoluteString,
            host: host
        )
    }
}
