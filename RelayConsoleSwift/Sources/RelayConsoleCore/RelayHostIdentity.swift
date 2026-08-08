import Foundation

/// Stable identity for one Relay Host installation. Runtime adapter
/// credentials can rotate or be replaced without creating another host.
public enum RelayHostIdentity {
    public static let settingKey = "relay.host.installation-id"

    public static func resolve(using data: LocalDataService) throws -> String {
        let existing: String = try data.getAppSetting(settingKey, fallback: "")
        if existing.range(
            of: #"^relayhost_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"#,
            options: [.regularExpression, .caseInsensitive]
        ) != nil {
            return existing.lowercased()
        }
        let created = "relayhost_\(UUID().uuidString.lowercased())"
        try data.setAppSetting(settingKey, value: created)
        return created
    }
}
