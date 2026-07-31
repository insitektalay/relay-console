import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const source = relayAppSource
const navigationSource = readFileSync(
  new URL(
    "../components/app-shell/views/settings-navigation-pane.tsx",
    import.meta.url
  ),
  "utf8"
)

test("Settings navigation exposes the Swift destinations and privacy controls", () => {
  for (const label of [
    "Account",
    "Security",
    "Privacy",
    "Harnesses",
    "Runtime",
  ])
    assert.match(navigationSource, new RegExp(`label: "${label}"`))
  for (const hidden of [
    "Appearance",
    "Workspace",
    "Team & members",
    "Integrations",
    "Notifications",
  ])
    assert.doesNotMatch(navigationSource, new RegExp(`label: "${hidden}"`))
})

test("account, harness and runtime states preserve reference controls", () => {
  assert.match(source, /case "account"/)
  assert.match(source, /Profile/)
  assert.match(source, /Save name/)
  assert.match(source, /case "harnesses"/)
  assert.match(source, /Hermes install command/)
  assert.match(source, /OpenClaw install command/)
  assert.match(source, /Runtime experience/)
  assert.match(source, /Conversation start/)
  assert.match(source, /Automatic/)
  assert.match(source, /Action approvals/)
  assert.match(source, /Technical activity/)
  assert.doesNotMatch(source, /Run confirmation/)
})

test("privacy settings expose independent PostHog and Sentry choices", () => {
  assert.match(source, /case "privacy"/)
  assert.match(source, /Share product analytics/)
  assert.match(source, /Share crash and error reports/)
  assert.match(source, /Unavailable in this build/)
  assert.match(source, /updateTelemetryPreferences/)
})

test("web security remains an explicit platform adaptation with safety gates", () => {
  assert.match(source, /case "security"/)
  assert.match(source, /Change password/)
  assert.match(source, /activeWebSessions/)
  assert.match(source, /passwordChangeDisabled/)
  assert.match(source, /confirm\(/)
  assert.match(source, /tokens are never shown in the browser/)
})
