import CryptoKit
import Foundation
import PostHog
import RelayConsoleCore
import Sentry

/// The only boundary through which Relay Console sends product analytics or diagnostics.
///
/// Callers provide event names and values from a closed vocabulary. User-authored text,
/// URLs, paths, IDs, credentials, provider payloads, and error descriptions are never accepted.
@MainActor
final class RelayTelemetry {
    enum ProductEvent: String, CaseIterable {
        case appLaunched = "app_launched"
        case screenViewed = "screen_viewed"
        case actionSucceeded = "action_succeeded"
        case actionFailed = "action_failed"
        case telemetryPreferencesUpdated = "telemetry_preferences_updated"
    }

    struct Consent: Equatable {
        var productAnalytics: Bool
        var crashReporting: Bool
    }

    struct Configuration: Equatable {
        var postHogProjectToken: String?
        var postHogHost: String
        var sentryDSN: String?
        var environment: String
        var release: String
        var distribution: String
        var releaseChannel: String

        static func current(
            environment: [String: String] = ProcessInfo.processInfo.environment,
            bundle: Bundle = .main
        ) -> Configuration {
            let metadata = RelayConsoleReleaseMetadata.current
            let info = bundle.infoDictionary ?? [:]

            func value(environmentKey: String, bundleKey: String) -> String? {
                let raw = environment[environmentKey] ?? info[bundleKey] as? String
                return raw?.trimmingCharacters(in: .whitespacesAndNewlines).nilIfEmpty
            }

            let configuredEnvironment =
                value(
                    environmentKey: "RELAY_TELEMETRY_ENVIRONMENT",
                    bundleKey: "RelayTelemetryEnvironment"
                ) ?? metadata.releaseChannel
            return Configuration(
                postHogProjectToken: value(
                    environmentKey: "RELAY_POSTHOG_PROJECT_TOKEN",
                    bundleKey: "RelayPostHogProjectToken"
                ),
                postHogHost: value(
                    environmentKey: "RELAY_POSTHOG_HOST",
                    bundleKey: "RelayPostHogHost"
                ) ?? "https://eu.i.posthog.com",
                sentryDSN: value(
                    environmentKey: "RELAY_SENTRY_DSN",
                    bundleKey: "RelaySentryDSN"
                ),
                environment: Self.safeSlug(configuredEnvironment, fallback: "production"),
                release:
                    "\(metadata.bundleIdentifier)@\(metadata.version)+\(metadata.build)",
                distribution: metadata.build,
                releaseChannel: Self.safeSlug(metadata.releaseChannel, fallback: "unknown")
            )
        }

        var analyticsConfigured: Bool {
            guard postHogProjectToken != nil, let url = URL(string: postHogHost) else {
                return false
            }
            return url.scheme == "https" && url.host != nil
        }

        var crashReportingConfigured: Bool {
            guard let sentryDSN, let url = URL(string: sentryDSN) else { return false }
            return url.scheme == "https" && url.host != nil && url.user != nil
        }

        private static func safeSlug(_ value: String, fallback: String) -> String {
            let result = value.lowercased()
                .replacingOccurrences(
                    of: "[^a-z0-9._-]+",
                    with: "-",
                    options: .regularExpression
                )
                .trimmingCharacters(in: CharacterSet(charactersIn: "-._"))
            return String(result.prefix(48)).nilIfEmpty ?? fallback
        }
    }

    private enum Property: String {
        case action
        case outcome
        case durationBucket = "duration_bucket"
        case screen
        case analyticsEnabled = "analytics_enabled"
        case crashReportingEnabled = "crash_reporting_enabled"
        case releaseChannel = "release_channel"
    }

    static let shared = RelayTelemetry()

    let configuration: Configuration
    private(set) var consent = Consent(productAnalytics: false, crashReporting: false)
    private var postHogStarted = false
    private var sentryStarted = false
    private var identifiedUser: String?
    private var didCaptureLaunch = false

    init(configuration: Configuration = .current()) {
        self.configuration = configuration
    }

    var analyticsStatus: String {
        configuration.analyticsConfigured
            ? "PostHog is configured; events are sent only after you opt in."
            : "PostHog is not configured in this build; no analytics can be sent."
    }

    var analyticsConfigured: Bool {
        configuration.analyticsConfigured
    }

    var crashReportingStatus: String {
        configuration.crashReportingConfigured
            ? "Sentry is configured; reports are sent only after you opt in."
            : "Sentry is not configured in this build; no reports can be sent."
    }

    var crashReportingConfigured: Bool {
        configuration.crashReportingConfigured
    }

    func applyConsent(_ consent: Consent, profileId: String) {
        let opaqueUser = Self.opaqueUserId(profileId)
        if self.consent == consent, identifiedUser == opaqueUser {
            return
        }
        let previous = self.consent
        let profileChanged = identifiedUser != nil && identifiedUser != opaqueUser
        self.consent = consent
        identifiedUser = opaqueUser

        if consent.productAnalytics, configuration.analyticsConfigured {
            startPostHogIfNeeded()
            if profileChanged {
                PostHogSDK.shared.reset()
            }
            PostHogSDK.shared.optIn()
            PostHogSDK.shared.identify(
                opaqueUser,
                userProperties: [
                    Property.releaseChannel.rawValue: configuration.releaseChannel
                ]
            )
            captureLaunchIfNeeded()
        } else if postHogStarted {
            PostHogSDK.shared.optOut()
            PostHogSDK.shared.reset()
        }

        if consent.crashReporting, configuration.crashReportingConfigured {
            startSentryIfNeeded()
            SentrySDK.setUser(User(userId: opaqueUser))
        } else if sentryStarted {
            SentrySDK.setUser(nil)
            SentrySDK.close()
            sentryStarted = false
        }

        guard previous != consent else { return }
        capture(
            .telemetryPreferencesUpdated,
            properties: [
                .analyticsEnabled: consent.productAnalytics,
                .crashReportingEnabled: consent.crashReporting,
            ]
        )
    }

    func screenViewed(_ screen: String) {
        let safeScreen = Self.safeScreen(screen)
        capture(.screenViewed, properties: [.screen: safeScreen])
        breadcrumb(category: "navigation", action: safeScreen, outcome: nil)
    }

    func actionStarted(_ label: String) {
        breadcrumb(category: "action", action: Self.actionFamily(label), outcome: "started")
    }

    func actionSucceeded(_ label: String, elapsed: TimeInterval) {
        let action = Self.actionFamily(label)
        capture(
            .actionSucceeded,
            properties: [
                .action: action,
                .outcome: "succeeded",
                .durationBucket: Self.durationBucket(elapsed),
            ]
        )
        breadcrumb(category: "action", action: action, outcome: "succeeded")
    }

    func actionFailed(_ label: String, elapsed: TimeInterval, error: Error) {
        let action = Self.actionFamily(label)
        capture(
            .actionFailed,
            properties: [
                .action: action,
                .outcome: "failed",
                .durationBucket: Self.durationBucket(elapsed),
            ]
        )
        breadcrumb(category: "action", action: action, outcome: "failed")
        captureSanitizedError(error, operation: action)
    }

    func flush() {
        if consent.productAnalytics, postHogStarted {
            PostHogSDK.shared.flush()
        }
        if consent.crashReporting, sentryStarted {
            SentrySDK.flush(timeout: 2)
        }
    }

    private func startPostHogIfNeeded() {
        guard !postHogStarted, let token = configuration.postHogProjectToken else { return }
        let config = PostHogConfig(projectToken: token, host: configuration.postHogHost)
        config.captureApplicationLifecycleEvents = false
        config.captureScreenViews = false
        config.enableSwizzling = false
        config.preloadFeatureFlags = false
        config.sendFeatureFlagEvent = false
        config.errorTrackingConfig.autoCapture = false
        PostHogSDK.shared.setup(config)
        postHogStarted = true
    }

    private func startSentryIfNeeded() {
        guard !sentryStarted, let dsn = configuration.sentryDSN else { return }
        SentrySDK.start { options in
            options.dsn = dsn
            options.releaseName = self.configuration.release
            options.dist = self.configuration.distribution
            options.environment = self.configuration.environment
            options.sendDefaultPii = false
            options.enableNetworkBreadcrumbs = false
            options.enableNetworkTracking = false
            options.enableFileIOTracing = false
            options.enableAutoPerformanceTracing = false
            options.tracesSampleRate = 0
            // Required on macOS for uncaught NSException capture. Network and file
            // integrations remain explicitly disabled above.
            options.enableSwizzling = true
            options.enableAutoSessionTracking = true
            options.enableCrashHandler = true
            options.enableAppHangTracking = true
            options.enableMetricKit = true
            options.enableMetricKitRawPayload = false
            options.maxBreadcrumbs = 50
            options.beforeSend = { event in
                // Crash reasons and NSError descriptions can embed user-authored
                // values. Preserve exception types and stacks, but remove values
                // and all broad attachment-style fields at the final send boundary.
                event.message = nil
                event.error = nil
                event.extra = nil
                event.request = nil
                event.serverName = nil
                event.transaction = nil
                event.exceptions?.forEach { $0.value = "Redacted exception" }
                event.breadcrumbs = event.breadcrumbs?.filter {
                    $0.category == "action" || $0.category == "navigation"
                }
                return event
            }
        }
        sentryStarted = true
        SentrySDK.configureScope { scope in
            scope.setTag(
                value: self.configuration.releaseChannel,
                key: Property.releaseChannel.rawValue
            )
        }
    }

    private func capture(
        _ event: ProductEvent,
        properties: [Property: Any] = [:]
    ) {
        guard consent.productAnalytics, postHogStarted else { return }
        var safeProperties: [String: Any] = [
            Property.releaseChannel.rawValue: configuration.releaseChannel
        ]
        for (key, value) in properties {
            switch value {
            case let value as Bool:
                safeProperties[key.rawValue] = value
            case let value as String:
                safeProperties[key.rawValue] = String(value.prefix(64))
            default:
                continue
            }
        }
        PostHogSDK.shared.capture(event.rawValue, properties: safeProperties)
    }

    private func captureLaunchIfNeeded() {
        guard !didCaptureLaunch else { return }
        didCaptureLaunch = true
        capture(.appLaunched)
    }

    private func breadcrumb(category: String, action: String, outcome: String?) {
        guard consent.crashReporting, sentryStarted else { return }
        let crumb = Breadcrumb(level: .info, category: category)
        crumb.type = "user"
        var data: [String: Any] = [Property.action.rawValue: action]
        if let outcome {
            data[Property.outcome.rawValue] = outcome
        }
        crumb.data = data
        SentrySDK.addBreadcrumb(crumb)
    }

    private func captureSanitizedError(_ error: Error, operation: String) {
        guard consent.crashReporting, sentryStarted else { return }
        let relay = error as? RelayError
        let errorCode = relay?.code.rawValue ?? "unexpected_error"
        let safeError = NSError(
            domain: "RelayConsole.\(Self.safeTypeName(String(describing: type(of: error))))",
            code: Self.stableInteger(errorCode),
            userInfo: [NSLocalizedDescriptionKey: "Relay Console operation failed"]
        )
        SentrySDK.capture(error: safeError) { scope in
            scope.setTag(value: errorCode, key: "error_code")
            scope.setTag(value: operation, key: "operation")
        }
    }

    static func opaqueUserId(_ profileId: String) -> String {
        let digest = SHA256.hash(
            data: Data("relay-console-telemetry-v1:\(profileId)".utf8)
        )
        return digest.prefix(16).map { String(format: "%02x", $0) }.joined()
    }

    static func actionFamily(_ label: String) -> String {
        let normalized = label.lowercased()
            .replacingOccurrences(of: "_", with: "-")
        let families = [
            "approve-provider-action", "execute-provider-action", "deny-provider-action",
            "create-direct-chat", "create-team-chat", "create-agent", "send-message",
            "cancel-dispatch", "confirm-run", "reject-run", "retry-dispatch",
            "save-account-settings", "save-appearance-settings", "save-workspace-settings",
            "connect-", "disconnect-", "test-", "toggle-", "save-", "settings-",
        ]
        let match = families.first { normalized.hasPrefix($0) } ?? "other-action"
        switch match {
        case "connect-", "disconnect-", "test-", "toggle-", "save-", "settings-":
            return String(match.dropLast())
        default:
            return match
        }
    }

    static func durationBucket(_ elapsed: TimeInterval) -> String {
        switch elapsed {
        case ..<0.25: return "under_250ms"
        case ..<1: return "250ms_to_1s"
        case ..<3: return "1s_to_3s"
        case ..<10: return "3s_to_10s"
        default: return "10s_or_more"
        }
    }

    private static func safeScreen(_ value: String) -> String {
        let allowed = Set(["chat", "agents", "agent_ops", "artifacts", "applications", "approvals", "insights", "settings"])
        let normalized = value.lowercased().replacingOccurrences(of: "-", with: "_")
        return allowed.contains(normalized) ? normalized : "unknown"
    }

    private static func safeTypeName(_ value: String) -> String {
        let safe = value.replacingOccurrences(
            of: "[^A-Za-z0-9_.]+",
            with: "_",
            options: .regularExpression
        )
        return String(safe.prefix(80))
    }

    private static func stableInteger(_ value: String) -> Int {
        value.utf8.reduce(5381) { (($0 << 5) &+ $0) &+ Int($1) }
    }
}
