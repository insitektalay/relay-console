// Telemetry.swift
// Relay Console

import CryptoKit
import Foundation
import OSLog
import PostHog
import Sentry

enum TelemetryLevel: String, Sendable {
    case debug
    case info
    case warning
    case error
    case fatal

    var sentryLevel: SentryLevel {
        switch self {
        case .debug: return .debug
        case .info: return .info
        case .warning: return .warning
        case .error: return .error
        case .fatal: return .fatal
        }
    }

    var osLogType: OSLogType {
        switch self {
        case .debug: return .debug
        case .info: return .info
        case .warning: return .default
        case .error, .fatal: return .error
        }
    }
}

@MainActor
final class Telemetry {
    static let shared = Telemetry()

    static let telemetryEnabledKey = "privacy.telemetry.enabled"
    static let crashReportsEnabledKey = "privacy.crash_reports.enabled"
    static let privacyChoiceCompletedKey = "privacy.telemetry.choice_completed.v1"

    private static var isPostHogStarted = false
    private static var isSentryStarted = false

    private let logger = Logger(subsystem: "com.relayconsole.app", category: "runtime")
    private var sessionId = UUID().uuidString
    private var userId: String?
    private var workspaceId: String?
    private var threadId: String?
    private var agentId: String?
    private var route: String?

    private init() {}

    static var privacyChoiceCompleted: Bool {
        UserDefaults.standard.bool(forKey: privacyChoiceCompletedKey)
    }

    static var telemetryEnabled: Bool {
        guard privacyChoiceCompleted else { return false }
        return UserDefaults.standard.object(forKey: telemetryEnabledKey) as? Bool ?? false
    }

    static var crashReportsEnabled: Bool {
        guard privacyChoiceCompleted else { return false }
        return UserDefaults.standard.object(forKey: crashReportsEnabledKey) as? Bool ?? false
    }

    static var productAnalyticsAvailable: Bool {
        AppRuntimeConfig.postHogProjectToken != nil
    }

    static var crashReportsAvailable: Bool {
        AppRuntimeConfig.sentryDSN != nil
    }

    static func savePrivacyPreferences(
        productAnalytics: Bool,
        crashReports: Bool
    ) {
        UserDefaults.standard.set(
            productAnalyticsAvailable && productAnalytics,
            forKey: telemetryEnabledKey
        )
        UserDefaults.standard.set(
            crashReportsAvailable && crashReports,
            forKey: crashReportsEnabledKey
        )
        UserDefaults.standard.set(true, forKey: privacyChoiceCompletedKey)
        applyPrivacyPreferences()
    }

    static func applyPrivacyPreferences() {
        if telemetryEnabled {
            startPostHog()
        } else if isPostHogStarted {
            PostHogSDK.shared.optOut()
            PostHogSDK.shared.reset()
        }

        if crashReportsEnabled {
            startSentry()
        } else if isSentryStarted {
            SentrySDK.setUser(nil)
            SentrySDK.close()
            isSentryStarted = false
        }
    }

    private static func startPostHog() {
        guard let projectToken = AppRuntimeConfig.postHogProjectToken else { return }
        if isPostHogStarted {
            PostHogSDK.shared.optIn()
            shared.applyPostHogIdentity()
            return
        }

        let config = PostHogConfig(
            projectToken: projectToken,
            host: AppRuntimeConfig.postHogHost.absoluteString
        )
        config.captureApplicationLifecycleEvents = false
        config.captureScreenViews = false
        config.captureElementInteractions = false
        config.sessionReplay = false
        config.enableSwizzling = false
        config.preloadFeatureFlags = false
        config.sendFeatureFlagEvent = false
        config.errorTrackingConfig.autoCapture = false
        PostHogSDK.shared.setup(config)
        PostHogSDK.shared.optIn()
        isPostHogStarted = true
        shared.applyPostHogIdentity()
        shared.captureProductEvent("app_launched")
    }

    private static func startSentry() {
        guard !isSentryStarted, let dsn = AppRuntimeConfig.sentryDSN else { return }

        SentrySDK.start { options in
            options.dsn = dsn
            options.environment = AppRuntimeConfig.sentryEnvironment
            options.releaseName = AppRuntimeConfig.sentryRelease
            options.tracesSampleRate = 0
            options.attachStacktrace = true
            options.enableAppHangTracking = true
            options.enableWatchdogTerminationTracking = true
            options.enableAutoSessionTracking = true
            options.enableAutoPerformanceTracing = false
            options.sendDefaultPii = false
            options.attachScreenshot = false
            options.attachViewHierarchy = false
            options.enableNetworkBreadcrumbs = false
            options.enableNetworkTracking = false
            options.enableFileIOTracing = false
            options.beforeBreadcrumb = { breadcrumb in
                breadcrumb.category = TelemetryPrivacy.sanitizedLabel(
                    breadcrumb.category,
                    fallback: "redacted.category"
                )
                if let message = breadcrumb.message {
                    breadcrumb.message = TelemetryPrivacy.sanitizedLabel(
                        message,
                        fallback: "redacted.event"
                    )
                }
                if let data = breadcrumb.data {
                    breadcrumb.data = TelemetryPrivacy.sanitizedContext(data)
                }
                return breadcrumb
            }
            options.beforeSend = { event in
                event.message = nil
                event.error = nil
                event.request = nil
                event.extra = nil
                event.serverName = nil
                event.transaction = nil
                event.exceptions?.forEach { $0.value = "Redacted exception" }
                return event
            }
        }
        isSentryStarted = true
        shared.applyScope()
    }

    func setUser(id: String?, email _: String? = nil, name _: String? = nil) {
        userId = id.map { Self.opaqueIdentifier(kind: "user", value: $0) }
        if Self.isSentryStarted {
            SentrySDK.setUser(userId.map { Sentry.User(userId: $0) })
        }
        applyPostHogIdentity()
        applyScope()
    }

    func setWorkspace(_ id: String?) {
        workspaceId = id.map { Self.opaqueIdentifier(kind: "workspace", value: $0) }
        applyScope()
    }

    func setThread(_ id: String?) {
        threadId = id.map { Self.opaqueIdentifier(kind: "thread", value: $0) }
        applyScope()
    }

    func setAgent(_ id: String?) {
        agentId = id.map { Self.opaqueIdentifier(kind: "agent", value: $0) }
        applyScope()
    }

    func setRoute(_ route: String?) {
        self.route = route.map {
            TelemetryPrivacy.sanitizedLabel($0, fallback: "redacted.route")
        }
        applyScope()
    }

    func breadcrumb(
        _ message: String,
        category: String,
        level: TelemetryLevel = .info,
        attributes: [String: Any] = [:]
    ) {
        let safeCategory = TelemetryPrivacy.sanitizedLabel(
            category,
            fallback: "redacted.category"
        )
        let safeMessage = TelemetryPrivacy.sanitizedLabel(
            message,
            fallback: "redacted.event"
        )
        logger.log(
            level: level.osLogType,
            "\(safeCategory, privacy: .public): \(safeMessage, privacy: .public)"
        )
        guard Self.crashReportsEnabled, Self.isSentryStarted else { return }
        let crumb = Breadcrumb(level: level.sentryLevel, category: safeCategory)
        crumb.message = safeMessage
        crumb.data = sanitizedContext(attributes)
        SentrySDK.addBreadcrumb(crumb)
    }

    func event(
        _ name: String,
        level: TelemetryLevel = .info,
        attributes: [String: Any] = [:]
    ) {
        let safeName = TelemetryPrivacy.sanitizedLabel(name, fallback: "redacted.event")
        captureProductEvent(safeName, attributes: attributes)
        breadcrumb(safeName, category: "event", level: level, attributes: attributes)
    }

    func capture(
        error: any Error,
        level: TelemetryLevel = .error,
        attributes: [String: Any] = [:]
    ) {
        guard Self.crashReportsEnabled, Self.isSentryStarted else {
            logger.log(
                level: level.osLogType,
                "error: \(TelemetryPrivacy.errorKind(error), privacy: .public)"
            )
            return
        }
        if shouldRecordAsBreadcrumbOnly(error) {
            var nextAttributes = attributes
            nextAttributes["errorKind"] = TelemetryPrivacy.errorKind(error)
            breadcrumb(
                "Expected API error suppressed",
                category: "telemetry.suppressed",
                level: .warning,
                attributes: nextAttributes
            )
            return
        }
        logger.log(
            level: level.osLogType,
            "error: \(TelemetryPrivacy.errorKind(error), privacy: .public)"
        )
        SentrySDK.capture(error: TelemetryPrivacy.sanitizedError(error)) { scope in
            scope.setLevel(level.sentryLevel)
            for (key, value) in self.sanitizedContext(attributes) {
                scope.setContext(value: ["value": value], key: key)
            }
        }
    }

    func capture(
        message: String,
        level: TelemetryLevel = .error,
        attributes: [String: Any] = [:]
    ) {
        let safeMessage = TelemetryPrivacy.sanitizedLabel(message, fallback: "redacted.error")
        logger.log(level: level.osLogType, "message: \(safeMessage, privacy: .public)")
        guard Self.crashReportsEnabled, Self.isSentryStarted else { return }
        SentrySDK.capture(message: safeMessage) { scope in
            scope.setLevel(level.sentryLevel)
            for (key, value) in self.sanitizedContext(attributes) {
                scope.setContext(value: ["value": value], key: key)
            }
        }
    }

    private func captureProductEvent(
        _ name: String,
        attributes: [String: Any] = [:]
    ) {
        guard Self.telemetryEnabled, Self.isPostHogStarted else { return }
        var properties = sanitizedContext(attributes)
        properties["release"] = AppRuntimeConfig.sentryRelease
        properties["environment"] = AppRuntimeConfig.sentryEnvironment
        PostHogSDK.shared.capture(name, properties: properties)
    }

    private func applyPostHogIdentity() {
        guard Self.telemetryEnabled, Self.isPostHogStarted, let userId else { return }
        PostHogSDK.shared.identify(userId)
    }

    private func applyScope() {
        guard Self.crashReportsEnabled, Self.isSentryStarted else { return }
        SentrySDK.configureScope { scope in
            scope.setTag(value: self.sessionId, key: "session_id")
            if let workspaceId = self.workspaceId {
                scope.setTag(value: workspaceId, key: "workspace_id")
            }
            if let threadId = self.threadId {
                scope.setTag(value: threadId, key: "thread_id")
            }
            if let agentId = self.agentId {
                scope.setTag(value: agentId, key: "agent_id")
            }
            if let route = self.route {
                scope.setTag(value: route, key: "route")
            }
        }
    }

    private func mergedContext(_ attributes: [String: Any]) -> [String: Any] {
        var context = attributes
        context["sessionId"] = sessionId
        if let userId { context["userId"] = userId }
        if let workspaceId { context["workspaceId"] = workspaceId }
        if let threadId { context["threadId"] = threadId }
        if let agentId { context["agentId"] = agentId }
        if let route { context["route"] = route }
        return context
    }

    private func sanitizedContext(_ attributes: [String: Any]) -> [String: String] {
        TelemetryPrivacy.sanitizedContext(mergedContext(attributes))
    }

    private func shouldRecordAsBreadcrumbOnly(_ error: any Error) -> Bool {
        if APIClient.isExpectedCancellation(error) {
            return true
        }
        if case APIError.unauthorized = error {
            return true
        }
        if case APIError.notFound = error {
            return true
        }
        if case APIError.networkError(let underlying) = error {
            return APIClient.isExpectedCancellation(underlying)
        }
        return false
    }

    private static func opaqueIdentifier(kind: String, value: String) -> String {
        let digest = SHA256.hash(
            data: Data("relay-console-ios-telemetry-v1:\(kind):\(value)".utf8)
        )
        return digest.prefix(16).map { String(format: "%02x", $0) }.joined()
    }
}
