import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const appSource = relayAppSource
const configSource = readFileSync(
  new URL("../lib/config.ts", import.meta.url),
  "utf8"
)
const agentOpsSource = readFileSync(
  new URL(
    "../components/agent-ops-hq/agent-ops-hq-screen.tsx",
    import.meta.url
  ),
  "utf8"
)
const agentOpsSidebarSource = readFileSync(
  new URL(
    "../components/agent-ops-hq/agent-ops-hq-sidebar.tsx",
    import.meta.url
  ),
  "utf8"
)
const marketplaceSource = readFileSync(
  new URL("../components/marketplace/marketplace-screen.tsx", import.meta.url),
  "utf8"
)
const missionControlSectionSource = readFileSync(
  new URL(
    "../components/mission-control/mission-control-section.tsx",
    import.meta.url
  ),
  "utf8"
)
const envExample = readFileSync(
  new URL("../.env.example", import.meta.url),
  "utf8"
)
const handoffChecklist = readFileSync(
  new URL("../docs/railway-handoff/DEPLOYMENT_CHECKLIST.md", import.meta.url),
  "utf8"
)

test("AgentOps live-state failures are visible and retryable", () => {
  assert.match(agentOpsSource, /liveStateErrorMessage/)
  assert.match(agentOpsSource, /setLiveStateErrorMessage\(/)
  assert.match(
    agentOpsSource,
    /setLiveStateErrorAt\(new Date\(\)\.toISOString\(\)\)/
  )
  assert.match(agentOpsSource, /AgentOpsLiveStateStatusBanner/)
  assert.match(agentOpsSource, /Last live snapshot/)
  assert.match(agentOpsSource, /refreshAgentOpsLiveState\(\)/)
  assert.doesNotMatch(agentOpsSource, /\.catch\(\(\) => undefined\)/)
})

test("AgentOps mock controls require an explicit debug flag", () => {
  assert.match(configSource, /"NEXT_PUBLIC_ENABLE_AGENT_OPS_DEBUG_CONTROLS"/)
  assert.match(
    configSource,
    /enableAgentOpsDebugControls: publicFeatureFlag\([\s\S]*"NEXT_PUBLIC_ENABLE_AGENT_OPS_DEBUG_CONTROLS"[\s\S]*false/
  )
  assert.match(envExample, /NEXT_PUBLIC_ENABLE_AGENT_OPS_DEBUG_CONTROLS=false/)
  assert.match(
    handoffChecklist,
    /NEXT_PUBLIC_ENABLE_AGENT_OPS_DEBUG_CONTROLS=false/
  )
  assert.match(
    appSource,
    /debugControlsEnabled=\{appConfig\.enableAgentOpsDebugControls\}/
  )
  assert.match(agentOpsSource, /debugControlsEnabled = false/)
  assert.match(agentOpsSource, /if \(!debugControlsEnabled\) return/)
  assert.match(
    agentOpsSource,
    /Demo mode is active\. Agent movement is mock data\./
  )
  assert.match(agentOpsSidebarSource, /debugControlsEnabled: boolean/)
  assert.match(
    agentOpsSidebarSource,
    /debugControlsEnabled && state\.mode === "mock"/
  )
})

test("Mission Control host status loading stays retired", () => {
  assert.match(missionControlSectionSource, /Local controls retired/)
  assert.match(missionControlSectionSource, /MarketplaceScreen/)
  assert.doesNotMatch(missionControlSectionSource, /\bfetch\s*\(/)
  assert.doesNotMatch(missionControlSectionSource, /\/api\/mission-control/)
})

test("Railway Marketplace catalog failures show retry diagnostics", () => {
  assert.match(marketplaceSource, /MarketplaceDiagnostics/)
  assert.match(marketplaceSource, /error=\{catalogQuery\.error\}/)
  assert.match(marketplaceSource, /isRetrying=\{catalogQuery\.isFetching\}/)
  assert.match(marketplaceSource, /catalogQuery\.refetch\(\)/)
  assert.doesNotMatch(marketplaceSource, /FALLBACK_MARKETPLACE_CATALOG/)
})
