import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const appSource = relayAppSource
const sidebarSource = readFileSync(
  new URL("../components/app-shell/app-sidebar.tsx", import.meta.url),
  "utf8"
)
const configSource = readFileSync(
  new URL("../lib/config.ts", import.meta.url),
  "utf8"
)
const envExample = readFileSync(
  new URL("../.env.example", import.meta.url),
  "utf8"
)

test("AgentOps remains default-off, admin guarded, and absent from parity navigation", () => {
  assert.match(
    configSource,
    /enableAgentOps:\s*publicFeatureFlag\("NEXT_PUBLIC_ENABLE_AGENT_OPS", false\)/
  )
  assert.match(envExample, /NEXT_PUBLIC_ENABLE_AGENT_OPS=false/)
  assert.match(appSource, /appConfig\.enableAgentOps && isWorkspaceAdmin/)
  assert.doesNotMatch(sidebarSource, /id:\s*"agentOpsHq"/)
})

test("web-only account, security, and Operations code remains behind parity navigation", () => {
  assert.match(appSource, /case "security"/)
  assert.match(appSource, /sdk\.auth\.sessions\(\)/)
  assert.match(appSource, /sdk\.auth\.logout\(\)/)
  assert.match(appSource, /case "operations"/)
  assert.match(appSource, /appConfig\.enableOperations && isWorkspaceAdmin/)
  assert.doesNotMatch(sidebarSource, /id:\s*"operations"/)
  assert.doesNotMatch(sidebarSource, /id:\s*"reports"/)
})

test("parity navigation exposes the six Swift sections in order", () => {
  const labels = [
    'label: "Chats"',
    'label: "Agents"',
    'label: "Artifacts"',
    'label: "Applications"',
    'label: "Approvals"',
    'label: "Settings"',
  ]
  let cursor = -1
  for (const label of labels) {
    const next = sidebarSource.indexOf(label)
    assert.ok(next > cursor, `${label} must appear once in Swift order`)
    cursor = next
  }
})

test("web backend targeting remains Railway-only", () => {
  assert.match(configSource, /const apiBaseUrl = "\/api\/v1"/)
  assert.match(configSource, /NEXT_PUBLIC_RAILWAY_WS_BASE_URL/)
  assert.match(configSource, /NEXT_PUBLIC_API_BASE_URL is retired/)
  assert.match(configSource, /NEXT_PUBLIC_WS_BASE_URL is retired/)
})
