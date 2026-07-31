// AppRuntimeConfig.swift
// ClawChat

import Foundation

@MainActor
enum AppRuntimeConfig {
    private static let savedConnectionKey = "relayconsole.savedCloudConnection"
    private static let legacySavedConnectionKey = "clawchat.savedCloudConnection"

    static var apiBaseURL: URL {
        if let connection = savedConnection { return connection.apiOrigin }
        return configuredOrigins.api
    }

    static var webSocketBaseURL: URL {
        if let connection = savedConnection { return connection.websocketOrigin }
        return configuredOrigins.websocket
    }

    static var webAssetBaseURL: URL {
        if let connection = savedConnection { return connection.webOrigin }
        return configuredOrigins.web
    }

    static var avatarAssetBaseURL: URL? {
        guard
            let configured = cleanBuildSetting(
                Bundle.main.object(forInfoDictionaryKey: "RelayConsoleAvatarAssetBaseURL") as? String
            ),
            let url = URL(string: configured),
            url.scheme == "https",
            url.host != nil
        else {
            return nil
        }
        return url
    }

    static var savedConnection: MobileCloudConnection? {
        if let data = UserDefaults.standard.data(forKey: savedConnectionKey),
           let connection = try? JSONDecoder().decode(MobileCloudConnection.self, from: data) {
            guard isSupported(connection) else {
                retireUnsupportedSavedConnection()
                return nil
            }
            return connection
        }

        guard
            let legacyData = UserDefaults.standard.data(forKey: legacySavedConnectionKey),
            let connection = try? JSONDecoder().decode(MobileCloudConnection.self, from: legacyData)
        else {
            return nil
        }

        guard isSupported(connection) else {
            retireUnsupportedSavedConnection()
            return nil
        }
        UserDefaults.standard.set(legacyData, forKey: savedConnectionKey)
        UserDefaults.standard.removeObject(forKey: legacySavedConnectionKey)
        return connection
    }

    static func save(connection: MobileCloudConnection) throws {
        guard isSupported(connection) else {
            throw CloudConnectionOnboardingError.unsupportedDeployment
        }
        if let existing = savedConnection,
           existing.apiOrigin.host == connection.apiOrigin.host,
           existing.deploymentId != connection.deploymentId {
            throw CloudConnectionOnboardingError.manifestMismatch
        }
        UserDefaults.standard.set(try JSONEncoder().encode(connection), forKey: savedConnectionKey)
        UserDefaults.standard.removeObject(forKey: legacySavedConnectionKey)
    }

    private static func isSupported(_ connection: MobileCloudConnection) -> Bool {
        guard case .success = RelayDeploymentOriginPolicy.validate(
            api: connection.apiOrigin.absoluteString,
            websocket: connection.websocketOrigin.absoluteString,
            web: connection.webOrigin.absoluteString
        ) else {
            return false
        }
        return connection.manifestURL == connection.apiOrigin.appendingPathComponent("deployment/manifest")
    }

    private static func retireUnsupportedSavedConnection() {
        UserDefaults.standard.removeObject(forKey: savedConnectionKey)
        UserDefaults.standard.removeObject(forKey: legacySavedConnectionKey)
        AuthTokenStore.delete()
        Telemetry.shared.capture(
            message: "Unsafe legacy cloud deployment retired",
            level: .warning
        )
    }

    static var sentryDSN: String? {
        cleanBuildSetting(Bundle.main.object(forInfoDictionaryKey: "SentryDSN") as? String)
    }

    static var postHogProjectToken: String? {
        cleanBuildSetting(
            Bundle.main.object(forInfoDictionaryKey: "RelayPostHogProjectToken") as? String
        )
    }

    static var postHogHost: URL {
        let configured = cleanBuildSetting(
            Bundle.main.object(forInfoDictionaryKey: "RelayPostHogHost") as? String
        ) ?? "https://eu.i.posthog.com"
        guard
            let url = URL(string: configured),
            url.scheme == "https",
            url.host != nil
        else {
            return URL(string: "https://eu.i.posthog.com")!
        }
        return url
    }

    static var sentryEnvironment: String {
        cleanBuildSetting(Bundle.main.object(forInfoDictionaryKey: "SentryEnvironment") as? String)
            ?? "development"
    }

    static var sentryRelease: String {
        if let configured = cleanBuildSetting(Bundle.main.object(forInfoDictionaryKey: "SentryRelease") as? String) {
            return configured
        }

        let bundleId = Bundle.main.bundleIdentifier ?? "com.relayconsole.app"
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
        return "\(bundleId)@\(version)+\(build)"
    }

    private static let configuredOrigins: RelayDeploymentOrigins = {
        let rawAPI = cleanBuildSetting(
            Bundle.main.object(forInfoDictionaryKey: "RelayConsoleAPIBaseURL") as? String
        ) ?? "https://your-backend.up.railway.app/api/v1"
        let rawWebSocket = cleanBuildSetting(
            Bundle.main.object(forInfoDictionaryKey: "RelayConsoleWebSocketBaseURL") as? String
        ) ?? "wss://your-backend.up.railway.app"
        let rawWeb = cleanBuildSetting(
            Bundle.main.object(forInfoDictionaryKey: "RelayConsoleWebAssetBaseURL") as? String
        ) ?? "https://your-web-app.example.com"

        switch RelayDeploymentOriginPolicy.validate(
            api: rawAPI,
            websocket: rawWebSocket,
            web: rawWeb
        ) {
        case .success(let origins):
            return origins
        case .failure(let rejection):
            Telemetry.shared.capture(
                message: "Rejected iOS deployment origin configuration",
                level: .fatal,
                attributes: [
                    "source": "bundle_info",
                    "errorKind": rejection.rawValue
                ]
            )
            preconditionFailure(
                "Invalid Relay Console deployment origins (\(rejection.rawValue)). Configure the RELAY_CONSOLE_* build settings."
            )
        }
    }()

    private static func cleanBuildSetting(_ value: String?) -> String? {
        guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return nil
        }

        if trimmed.hasPrefix("$("), trimmed.hasSuffix(")") {
            return nil
        }

        return trimmed
    }
}
