import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const realtimeSource = readFileSync(
  new URL("../hooks/use-clawchat-realtime.ts", import.meta.url),
  "utf8"
)
const appSource = relayAppSource
const realtimeStatusSource = readFileSync(
  new URL(
    "../components/app-shell/realtime-connection-status.tsx",
    import.meta.url
  ),
  "utf8"
)

test("realtime auth failures are terminal and toast-suppressed", () => {
  assert.match(realtimeSource, /export type RealtimeConnectionState =/)
  assert.match(realtimeSource, /\| "auth_failed"/)
  assert.match(realtimeSource, /class RealtimeAuthFailureError extends Error/)
  assert.match(realtimeSource, /error instanceof ClawChatApiError/)
  assert.match(
    realtimeSource,
    /error\.status === 401 \|\| error\.status === 403/
  )
  assert.match(realtimeSource, /event\.code === 4001/)
  assert.match(realtimeSource, /event\.code === 4002/)
  assert.match(realtimeSource, /event\.code === 1008/)
  assert.match(realtimeSource, /realtimeAuthFailedRef\.current = true/)
  assert.match(realtimeSource, /realtimeAuthToastShownRef\.current/)
  assert.match(realtimeSource, /setLiveConnectionState\("auth_failed"\)/)
  assert.match(
    realtimeSource,
    /case "auth_error":[\s\S]*markRealtimeAuthFailed/
  )
  assert.match(
    realtimeSource,
    /case "auth_error":[\s\S]*socketRef\.current\?\.close\(\)/
  )
  assert.match(
    realtimeSource,
    /if \(realtimeAuthFailedRef\.current\) \{[\s\S]*setLiveConnectionState\("auth_failed"\)[\s\S]*return[\s\S]*\}/
  )
  assert.match(realtimeSource, /markRealtimeAuthFailed\(authCloseMessage\)/)
  assert.doesNotMatch(
    realtimeSource,
    /case "auth_error":[\s\S]*toast\.error\("Realtime authentication failed"\)/
  )
})

test("websocket tickets use the first frame and never enter the URL", () => {
  assert.doesNotMatch(realtimeSource, /[?&]ticket=/)
  assert.doesNotMatch(realtimeSource, /encodeURIComponent\(ticket\)/)
  assert.match(
    realtimeSource,
    /new WebSocket\(appConfig\.wsBaseUrl\)/
  )
  assert.match(
    realtimeSource,
    /socket\.onopen[\s\S]*socket\.send\(JSON\.stringify\(\{ type: "authenticate", token: ticket \}\)\)/
  )
  assert.match(
    realtimeSource,
    /parsed\.type === "authenticated"[\s\S]*subscribe_workspace/
  )
})

test("the live app shell exposes a clear realtime auth failed state", () => {
  assert.match(realtimeStatusSource, /RealtimeConnectionState/)
  assert.match(realtimeStatusSource, /connectionState === "auth_failed"/)
  assert.match(realtimeStatusSource, /Realtime authentication failed/)
  assert.match(
    realtimeStatusSource,
    /Authentication failed\. Sign in again to reconnect\./
  )
  assert.match(appSource, /<RealtimeConnectionStatus/)
  assert.match(appSource, /connectionState=\{realtime\.connectionState\}/)
})
