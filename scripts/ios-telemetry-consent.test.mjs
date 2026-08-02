import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const telemetry = readFileSync(
  new URL("../ios/ClawChat/Shared/Telemetry/Telemetry.swift", import.meta.url),
  "utf8"
)
const consent = readFileSync(
  new URL(
    "../ios/ClawChat/Shared/Telemetry/TelemetryConsentView.swift",
    import.meta.url
  ),
  "utf8"
)
const coordinator = readFileSync(
  new URL("../ios/ClawChat/App/AppCoordinator.swift", import.meta.url),
  "utf8"
)
const app = readFileSync(
  new URL("../ios/ClawChat/App/ClawChatApp.swift", import.meta.url),
  "utf8"
)
const settings = readFileSync(
  new URL(
    "../ios/ClawChat/Features/Operations/SettingsView.swift",
    import.meta.url
  ),
  "utf8"
)
const symbolUpload = readFileSync(
  new URL("../ios/Scripts/upload-sentry-dsyms.sh", import.meta.url),
  "utf8"
)

test("iOS telemetry defaults off until the first-launch choice is complete", () => {
  assert.match(telemetry, /guard privacyChoiceCompleted else \{ return false \}/)
  assert.match(telemetry, /as\? Bool \?\? false/)
  assert.doesNotMatch(telemetry, /as\? Bool \?\? true/)
  assert.match(
    coordinator,
    /@AppStorage\(Telemetry\.privacyChoiceCompletedKey\)/
  )
  assert.match(coordinator, /TelemetryConsentView\(\)/)
  assert.match(app, /Telemetry\.applyPrivacyPreferences\(\)/)
  assert.doesNotMatch(app, /Telemetry\.startSentry\(\)/)
})

test("iOS first launch requires independent neutral explicit choices", () => {
  assert.match(consent, /productAnalyticsChoice: Bool\?/)
  assert.match(consent, /crashReportsChoice: Bool\?/)
  assert.match(consent, /Share product analytics/)
  assert.match(consent, /Share crash and error reports/)
  assert.match(consent, /Select Yes or No for each choice to continue/)
  assert.match(consent, /productAnalyticsChoice == nil/)
  assert.match(consent, /crashReportsChoice == nil/)
  assert.doesNotMatch(consent, /RECOMMENDED/)
  assert.doesNotMatch(consent, /Enable both and continue/)
})

test("iOS PostHog and Sentry collection stays bounded", () => {
  assert.match(telemetry, /captureApplicationLifecycleEvents = false/)
  assert.match(telemetry, /captureScreenViews = false/)
  assert.match(telemetry, /captureElementInteractions = false/)
  assert.match(telemetry, /sessionReplay = false/)
  assert.match(telemetry, /errorTrackingConfig\.autoCapture = false/)
  assert.match(telemetry, /tracesSampleRate = 0/)
  assert.match(telemetry, /sendDefaultPii = false/)
  assert.match(telemetry, /attachScreenshot = false/)
  assert.match(telemetry, /attachViewHierarchy = false/)
  assert.match(telemetry, /enableNetworkTracking = false/)
  assert.match(telemetry, /enableFileIOTracing = false/)
})

test("iOS Settings keeps both choices independently reversible", () => {
  assert.match(
    settings,
    /@AppStorage\(Telemetry\.telemetryEnabledKey\) private var telemetryEnabled = false/
  )
  assert.match(
    settings,
    /@AppStorage\(Telemetry\.crashReportsEnabledKey\) private var crashReportsEnabled = false/
  )
  assert.match(settings, /Share product analytics/)
  assert.match(settings, /Share crash and error reports/)
  assert.match(settings, /Telemetry\.applyPrivacyPreferences\(\)/)
})

test("iOS symbol upload keeps Sentry auth credentials out of the app", () => {
  assert.match(symbolUpload, /SENTRY_AUTH_TOKEN/)
  assert.match(symbolUpload, /SENTRY_ORG/)
  assert.match(symbolUpload, /SENTRY_PROJECT/)
  assert.match(symbolUpload, /sentry-cli debug-files upload/)
  assert.match(symbolUpload, /\.xcarchive/)
  assert.doesNotMatch(
    readFileSync(
      new URL("../ios/ClawChat/App/Info.plist", import.meta.url),
      "utf8"
    ),
    /SENTRY_AUTH_TOKEN/
  )
})
