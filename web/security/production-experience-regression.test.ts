import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const globalStylesSource = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8"
)
const realtimeSource = readFileSync(
  new URL("../hooks/use-clawchat-realtime.ts", import.meta.url),
  "utf8"
)
const realtimeStatusSource = readFileSync(
  new URL(
    "../components/app-shell/realtime-connection-status.tsx",
    import.meta.url
  ),
  "utf8"
)
const releaseRouteSource = readFileSync(
  new URL("../app/release-identity.json/route.ts", import.meta.url),
  "utf8"
)

test("animated web surfaces honor the operating-system reduced-motion preference", () => {
  assert.match(globalStylesSource, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(
    globalStylesSource,
    /\.workflow-flow__edge-flow,[\s\S]*\.signal-track--errored > span \{[\s\S]*animation: none;/
  )
})

test("realtime reconnect uses bounded backoff and clears pending retries", () => {
  assert.match(
    realtimeSource,
    /Math\.min\(1000 \* 2 \*\* reconnectAttemptRef\.current, 8000\)/
  )
  assert.match(realtimeSource, /setLiveConnectionState\("reconnecting"\)/)
  assert.match(realtimeSource, /window\.clearTimeout\(reconnectRef\.current\)/)
  assert.match(
    realtimeSource,
    /window\.setTimeout\(\(\) => \{[\s\S]*connect\(\)/
  )
  assert.match(realtimeStatusSource, /connectionState === "reconnecting"/)
  assert.match(realtimeStatusSource, /Realtime reconnecting/)
})

test("release identity cannot be cached into a stale deployment response", () => {
  assert.match(releaseRouteSource, /dynamic = "force-dynamic"/)
  assert.match(releaseRouteSource, /revalidate = 0/)
  assert.match(releaseRouteSource, /Cache-Control": "no-store, max-age=0"/)
  assert.match(releaseRouteSource, /status: 503/)
})
