import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const testDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(testDir, "..")

test("client error monitor is mounted at the app root", () => {
  const layout = readFileSync(join(webRoot, "app/layout.tsx"), "utf8")

  assert.match(layout, /ClientErrorMonitor/)
  assert.match(layout, /<ClientErrorMonitor \/>/)
})

test("client error monitor redacts and forwards only sanitized opt-in errors", () => {
  const source = readFileSync(
    join(webRoot, "components/monitoring/client-error-monitor.tsx"),
    "utf8"
  )

  assert.match(source, /web\.client\.error/)
  assert.match(source, /web\.client\.unhandled_rejection/)
  assert.match(source, /MAX_EVENT_BUFFER_LENGTH = 25/)
  assert.match(source, /clawChatSupportSnapshot/)
  assert.match(source, /__clawChatClientErrors/)
  assert.match(source, /supportModel: "local-buffer-and-opt-in-sentry"/)
  assert.match(source, /pagePath/)
  assert.match(source, /Bearer \[REDACTED\]/)
  assert.match(source, /access\[_-\]\?token/)
  assert.match(source, /refresh\[_-\]\?token/)
  assert.match(source, /pairing\[_-\]\?code/)
  assert.match(source, /\[EMAIL_REDACTED\]/)
  assert.match(source, /console\.error/)
  assert.match(source, /captureSanitizedClientError\(payload\)/)
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /\bsendBeacon\s*\(/)
  assert.doesNotMatch(source, /\bXMLHttpRequest\b/)
  assert.doesNotMatch(source, /\blocalStorage\b/)
  assert.doesNotMatch(source, /\bsessionStorage\b/)
  assert.doesNotMatch(source, /\bDatadog\b/)
})

test("beta docs describe local support evidence plus opt-in Sentry", () => {
  const operations = readFileSync(
    resolve(webRoot, "../docs/BETA_OPERATIONS.md"),
    "utf8"
  )
  const runbooks = readFileSync(
    resolve(webRoot, "../docs/beta-support-incident-runbooks.md"),
    "utf8"
  )

  assert.match(operations, /local support buffer/)
  assert.match(operations, /window\.clawChatSupportSnapshot\?\.\(\)/)
  assert.match(operations, /latest 25/)
  assert.match(
    operations,
    /only sends sanitized browser\s+errors to Sentry after opt-in/
  )
  assert.match(operations, /Do not ask for screenshots/)
  assert.match(runbooks, /Frontend Browser Error Evidence/)
  assert.match(runbooks, /window\.clawChatSupportSnapshot\?\.\(\)/)
  assert.match(runbooks, /cookies, local storage, session storage/)
  assert.match(runbooks, /visible page path only/)
})
