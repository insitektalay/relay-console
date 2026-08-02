import Foundation
import RelayConsoleSourceTestSupport

struct TelemetryReleaseTestFailure: Error, CustomStringConvertible {
    let description: String
}

@main
enum RelayConsoleTelemetryReleaseTests {
    static func main() throws {
        let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let package = try read(root, "Package.swift")
        let models = try read(root, "Sources/RelayConsoleCore/Models.swift")
        let data = try read(root, "Sources/RelayConsoleCore/LocalDataService.swift")
        let appModel = try read(root, "Sources/RelayConsoleApp/AppViewModel.swift")
        let telemetry = try read(root, "Sources/RelayConsoleApp/RelayTelemetry.swift")
        let views = try read(root, "Sources/RelayConsoleApp/Views.swift")
        let onboarding = try read(
            root,
            "Sources/RelayConsoleApp/TelemetryConsentOnboardingView.swift"
        )
        let builder = try read(root, "Scripts/build-release-app.sh")
        let developmentBuilder = try read(root, "Scripts/open-relay-console.sh")
        let privacy = try read(root, "Release/PrivacyInfo.xcprivacy")
        let documentation = try read(root, "Release/TELEMETRY_CONFIGURATION.md")
        let releaseWorkflow = try read(
            root.deletingLastPathComponent(),
            ".github/workflows/macos-sparkle-release.yml"
        )

        for source in [models, data, appModel] {
            try expect(
                !source.contains("telemetryEnabled: Bool = true"),
                "product analytics defaults on"
            )
            try expect(
                !source.contains("crashReportingEnabled: Bool = true"),
                "crash reporting defaults on"
            )
        }

        for dependency in [
            "PostHog/posthog-ios.git",
            "getsentry/sentry-cocoa.git",
            ".product(name: \"PostHog\"",
            ".product(name: \"Sentry\"",
        ] {
            try expect(package.contains(dependency), "package omits \(dependency)")
        }

        for event in [
            "app_launched",
            "screen_viewed",
            "action_succeeded",
            "action_failed",
            "telemetry_preferences_updated",
        ] {
            try expect(telemetry.contains(event), "event catalog omits \(event)")
        }
        try expect(
            telemetry.contains("SHA256.hash") && telemetry.contains("relay-console-telemetry-v1:"),
            "user identity is not pseudonymized"
        )
        try expect(
            telemetry.contains("guard consent.productAnalytics, postHogStarted"),
            "PostHog capture is not consent gated"
        )
        try expect(
            telemetry.contains("guard consent.crashReporting, sentryStarted"),
            "Sentry capture is not consent gated"
        )
        try expect(
            telemetry.contains("PostHogSDK.shared.optOut()")
                && telemetry.contains("PostHogSDK.shared.reset()"),
            "PostHog opt-out does not clear the active identity"
        )
        try expect(
            telemetry.contains("config.captureApplicationLifecycleEvents = false")
                && telemetry.contains("config.captureScreenViews = false")
                && telemetry.contains("config.enableSwizzling = false")
                && telemetry.contains("config.errorTrackingConfig.autoCapture = false"),
            "PostHog automatic capture is not disabled"
        )
        for privacySetting in [
            "options.sendDefaultPii = false",
            "options.enableNetworkBreadcrumbs = false",
            "options.enableNetworkTracking = false",
            "options.enableFileIOTracing = false",
            "options.enableAutoPerformanceTracing = false",
            "options.enableMetricKitRawPayload = false",
            "options.beforeSend = { event in",
            "event.exceptions?.forEach { $0.value = \"Redacted exception\" }",
        ] {
            try expect(telemetry.contains(privacySetting), "Sentry omits \(privacySetting)")
        }
        try expect(
            !telemetry.contains("error.localizedDescription"),
            "raw error descriptions can reach telemetry"
        )
        try expect(
            telemetry.contains("Relay Console operation failed"),
            "non-fatal errors do not use a fixed redacted description"
        )

        try expect(
            views.contains("Share product analytics")
                && views.contains("Share crash and error reports"),
            "consent controls are not visible"
        )
        try expect(
            appModel.contains("setProductAnalyticsEnabled")
                && appModel.contains("setCrashReportingEnabled")
                && appModel.contains("scheduleAccountSettingsSave(immediately: true)"),
            "settings telemetry choices are not persisted immediately"
        )
        try expect(
            views.contains(".disabled(!model.productAnalyticsAvailable)")
                && views.contains(".disabled(!model.crashReportingAvailable)"),
            "unconfigured settings telemetry controls are not disabled"
        )
        try expect(
            views.contains("Unavailable in this build"),
            "the settings UI does not expose unavailable telemetry controls"
        )
        try expect(
            views.contains("Messages, files, credentials, and URLs are never included."),
            "the settings UI omits the analytics data boundary"
        )
        try expect(
            views.contains("model.telemetryChoiceRequired")
                && appModel.contains("privacy.telemetryChoiceCompleted.v1")
                && appModel.contains("telemetryChoiceRequired = !telemetryChoiceCompleted"),
            "first-launch telemetry choice is not durably gated"
        )
        try expect(
            onboarding.contains("@State private var productAnalyticsChoice: Bool?")
                && onboarding.contains("@State private var crashReportingChoice: Bool?")
                && onboarding.contains("Select Yes or No for each choice to continue."),
            "first-launch telemetry choices are not explicitly unanswered"
        )
        for consentCopy in [
            "Help us make Relay better",
            "Continue",
            "You can use every Relay feature either way",
            "Share basic usage data to help improve Relay.",
            "Share crash and error data to help improve stability.",
            "Unavailable in this build",
        ] {
            try expect(
                onboarding.contains(consentCopy),
                "first-launch telemetry choice omits \(consentCopy)"
            )
        }
        try expect(
            appModel.contains("telemetryChoiceCompletedSettingKey")
                && appModel.contains("completeTelemetryChoice(")
                && appModel.contains("telemetry.applyConsent("),
            "first-launch telemetry choice is not persisted and applied"
        )
        try expect(
            onboarding.contains("productAnalytics: productAnalyticsChoice")
                && onboarding.contains("crashReporting: crashReportingChoice")
                && onboarding.contains("productAnalyticsChoice == nil")
                && onboarding.contains("crashReportingChoice == nil"),
            "the continue action does not preserve independent telemetry choices"
        )
        try expect(
            !onboarding.contains("RECOMMENDED")
                && !onboarding.contains("Enable both and continue"),
            "first-launch telemetry choice still visually privileges consent"
        )

        for configurationKey in [
            "RELAY_POSTHOG_PROJECT_TOKEN",
            "RELAY_POSTHOG_HOST",
            "RELAY_SENTRY_DSN",
            "RELAY_TELEMETRY_ENVIRONMENT",
        ] {
            try expect(
                telemetry.contains(configurationKey)
                    && builder.contains(configurationKey)
                    && developmentBuilder.contains(configurationKey)
                    && documentation.contains(configurationKey),
                "configuration contract omits \(configurationKey)"
            )
        }
        try expect(
            developmentBuilder.contains("RelaySentryDSN")
                && developmentBuilder.contains("RelayTelemetryEnvironment"),
            "development app installer does not embed Sentry routing configuration"
        )
        try expect(
            builder.contains("dsymutil")
                && builder.contains("dwarfdump --uuid")
                && builder.contains("\"$SENTRY_CLI_BIN\" debug-files upload")
                && builder.contains("SENTRY_AUTH_TOKEN"),
            "release symbol generation/upload is incomplete"
        )
        for productionReleaseBinding in [
            "RELAY_REQUIRE_PRODUCTION_TELEMETRY: \"1\"",
            "RELAY_POSTHOG_PROJECT_TOKEN: ${{ vars.RELAY_POSTHOG_PROJECT_TOKEN }}",
            "RELAY_SENTRY_DSN: ${{ vars.RELAY_SENTRY_DSN }}",
            "SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}",
            "@sentry/cli@2.58.6",
        ] {
            try expect(
                releaseWorkflow.contains(productionReleaseBinding),
                "production release workflow omits \(productionReleaseBinding)"
            )
        }
        try expect(
            builder.contains("RELAY_REQUIRE_PRODUCTION_TELEMETRY")
                && builder.contains("must be configured together"),
            "production release telemetry does not fail closed"
        )
        try expect(
            builder.contains("--product \"$PRODUCT_NAME\" >&2 || return $?")
                && builder.contains("--product RelayMarketplaceToolBridge >&2 || return $?"),
            "release product builds do not fail closed"
        )

        for declaration in [
            "NSPrivacyCollectedDataTypeDeviceID",
            "NSPrivacyCollectedDataTypeProductInteraction",
            "NSPrivacyCollectedDataTypeCrashData",
            "NSPrivacyCollectedDataTypePerformanceData",
            "NSPrivacyCollectedDataTypeOtherDiagnosticData",
        ] {
            try expect(privacy.contains(declaration), "privacy manifest omits \(declaration)")
        }
        try expect(
            privacy.contains("<key>NSPrivacyTracking</key>\n\t<false/>"),
            "privacy manifest enables cross-app tracking"
        )

        print("RelayConsoleTelemetryReleaseTests passed")
    }

    private static func read(_ root: URL, _ path: String) throws -> String {
        try RelayConsoleSourceTestSupport.read(root: root, path: path)
    }

    private static func expect(_ condition: @autoclosure () -> Bool, _ message: String) throws {
        guard condition() else { throw TelemetryReleaseTestFailure(description: message) }
    }
}
