import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const testDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(testDir, "..")
const telemetrySource = readFileSync(join(webRoot, "lib/telemetry.ts"), "utf8")
const consentSource = readFileSync(
  join(webRoot, "components/telemetry/telemetry-consent-provider.tsx"),
  "utf8"
)
const settingsSource = relayAppSource
const layoutSource = readFileSync(join(webRoot, "app/layout.tsx"), "utf8")
const nextConfigSource = readFileSync(join(webRoot, "next.config.mjs"), "utf8")

test("telemetry defaults off until an explicit completed choice", () => {
  assert.match(
    telemetrySource,
    /choiceCompleted: false,\s+productAnalytics: false,\s+crashReports: false/
  )
  assert.match(telemetrySource, /parsed\.choiceCompleted !== true/)
  assert.match(telemetrySource, /if \(!preferences\.choiceCompleted\) return/)
  assert.match(telemetrySource, /if \(!currentPreferences\.productAnalytics/)
  assert.match(telemetrySource, /if \(!currentPreferences\.crashReports/)
  assert.match(
    telemetrySource,
    /if \(!currentPreferences\.productAnalytics\) return/
  )
  assert.match(
    telemetrySource,
    /if \(!currentPreferences\.crashReports\) return/
  )
  assert.match(telemetrySource, /await postHogStartPromise\.catch/)
  assert.match(telemetrySource, /await sentryStartPromise\.catch/)
  assert.match(
    telemetrySource,
    /if \(currentPreferences\.productAnalytics\) return/
  )
  assert.match(
    telemetrySource,
    /if \(currentPreferences\.crashReports\) return/
  )
})

test("first app launch requires two neutral explicit privacy choices", () => {
  assert.match(layoutSource, /<TelemetryConsentProvider>/)
  assert.match(consentSource, /pathname\.startsWith\("\/app"\)/)
  assert.match(consentSource, /useState<boolean \| null>\(null\)/)
  assert.match(consentSource, /Select Yes or No for each choice to continue/)
  assert.match(consentSource, /Share product analytics/)
  assert.match(consentSource, /Share crash and error reports/)
  assert.match(consentSource, /role="radiogroup"/)
  assert.match(consentSource, /aria-checked=/)
  assert.match(consentSource, /disabled=\{!choicesComplete\}/)
  assert.doesNotMatch(consentSource, /Recommended/)
  assert.doesNotMatch(consentSource, /Enable both and continue/)
})

test("PostHog collection is manual and excludes invasive capture", () => {
  assert.match(telemetrySource, /autocapture: false/)
  assert.match(telemetrySource, /capture_pageview: false/)
  assert.match(telemetrySource, /capture_pageleave: false/)
  assert.match(telemetrySource, /capture_dead_clicks: false/)
  assert.match(telemetrySource, /capture_heatmaps: false/)
  assert.match(telemetrySource, /capture_performance: false/)
  assert.match(telemetrySource, /disable_session_recording: true/)
  assert.match(telemetrySource, /disable_surveys: true/)
  assert.match(telemetrySource, /ProductEventName/)
  assert.match(telemetrySource, /\| "product_action"/)
  assert.match(settingsSource, /action: "message\.send"/)
  assert.match(settingsSource, /action: "agent\.create"/)
})

test("Sentry is manual, redacted, and has performance and replay off", () => {
  assert.match(telemetrySource, /sendDefaultPii: false/)
  assert.match(telemetrySource, /defaultIntegrations: false/)
  assert.match(telemetrySource, /tracesSampleRate: 0/)
  assert.match(telemetrySource, /replaysSessionSampleRate: 0/)
  assert.match(telemetrySource, /replaysOnErrorSampleRate: 0/)
  assert.match(telemetrySource, /event\.request = undefined/)
  assert.match(telemetrySource, /event\.user\?\.id/)
  assert.match(telemetrySource, /redactTelemetryValue\(event\.user\.id/)
  assert.match(telemetrySource, /event\.contexts = undefined/)
  assert.match(telemetrySource, /\[REDACTED_JWT\]/)
  assert.match(telemetrySource, /\[REDACTED_FILE\]/)
  assert.match(telemetrySource, /\[REDACTED_PATH\]/)
  assert.match(telemetrySource, /safeDiagnosticFilename\(error\.filename\)/)
})

test("Sentry source maps use build-only secrets and no automatic capture", () => {
  assert.match(nextConfigSource, /withSentryConfig/)
  assert.match(nextConfigSource, /SENTRY_AUTH_TOKEN/)
  assert.match(nextConfigSource, /SENTRY_ORG/)
  assert.match(nextConfigSource, /SENTRY_PROJECT/)
  assert.match(nextConfigSource, /sentryBuildCredentialCount > 0/)
  assert.match(nextConfigSource, /autoInstrumentAppDirectory: false/)
  assert.match(nextConfigSource, /autoInstrumentMiddleware: false/)
  assert.match(nextConfigSource, /autoInstrumentServerFunctions: false/)
  assert.match(nextConfigSource, /removeTracing: true/)
  assert.doesNotMatch(nextConfigSource, /NEXT_PUBLIC_SENTRY_AUTH_TOKEN/)
})

test("settings provide independent reversible telemetry controls", () => {
  assert.match(settingsSource, /case "privacy"/)
  assert.match(settingsSource, /Share product analytics/)
  assert.match(settingsSource, /Share crash and error reports/)
  assert.match(settingsSource, /Unavailable in this build/)
  assert.match(settingsSource, /disabled=\{!appConfig\.postHogProjectId\}/)
  assert.match(settingsSource, /disabled=\{!appConfig\.sentryDsn\}/)
})
