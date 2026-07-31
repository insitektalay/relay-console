import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const readme = readFileSync(new URL("../../README.md", import.meta.url), "utf8")

test("root README points beta operators to Railway/Vercel backend posture", () => {
  assert.match(
    readme,
    /ClawChat web beta uses the Railway backend as the source of truth\./
  )
  assert.match(readme, /https:\/\/relayconsole\.work/)
  assert.match(readme, /https:\/\/api\.relayconsole\.work/)
  assert.match(
    readme,
    /CLAWCHAT_RAILWAY_ORIGIN=https:\/\/api\.relayconsole\.work/
  )
  assert.match(
    readme,
    /NEXT_PUBLIC_RAILWAY_WS_BASE_URL=wss:\/\/api\.relayconsole\.work/
  )
  assert.match(
    readme,
    /Local backend, bridge, and seed commands are development-only\./
  )
})

test("root README does not direct beta users to loopback API or websocket traffic", () => {
  assert.doesNotMatch(readme, /http:\/\/localhost:3000\/api\/v1/)
  assert.doesNotMatch(readme, /http:\/\/localhost:3000\/docs/)
  assert.doesNotMatch(readme, /curl\s+http:\/\/localhost:3000/)
  assert.doesNotMatch(readme, /ws:\/\/localhost:3000\/ws/)
  assert.doesNotMatch(readme, /Update the API base URL[\s\S]*localhost/)
})
