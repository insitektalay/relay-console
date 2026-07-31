import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const root = new URL("../", import.meta.url)

test("team relay SDK and header expose exact control semantics", async () => {
  const [sdk, pane] = await Promise.all([
    readFile(new URL("../packages/web-sdk/src/index.ts", root), "utf8"),
    readFile(
      new URL("components/threads/thread-detail-pane.tsx", root),
      "utf8"
    ),
  ])
  assert.match(sdk, /pauseTeamRelay/)
  assert.match(sdk, /continueTeamRelay/)
  assert.match(pane, /10000/)
  assert.match(pane, /Custom team relay reply limit/)
})

test("composer authority, tested models and agent deletion are reachable", async () => {
  const [app, pane, sdk] = await Promise.all([
    Promise.resolve(relayAppSource),
    readFile(
      new URL("components/threads/thread-detail-pane.tsx", root),
      "utf8"
    ),
    readFile(new URL("../packages/web-sdk/src/index.ts", root), "utf8"),
  ])
  assert.match(pane, /ask_for_approval/)
  assert.match(pane, /approve_for_me/)
  assert.match(pane, /full_access/)
  assert.match(app, /RELAY_TESTED_HERMES_MODELS/)
  assert.match(app, /Delete agent/)
  assert.match(sdk, /modelOptions/)
  assert.match(sdk, /delete: \(agentId: string\)/)
})
