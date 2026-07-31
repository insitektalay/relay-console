import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { relayAppSource } from "./relay-app-source.test"

const appSource = relayAppSource
const configSource = readFileSync(
  new URL("../lib/config.ts", import.meta.url),
  "utf8"
)
const webEnvExample = readFileSync(
  new URL("../.env.example", import.meta.url),
  "utf8"
)
const railwayEnvExample = readFileSync(
  new URL("../docs/railway-handoff/.env.example", import.meta.url),
  "utf8"
)
const betaOps = readFileSync(
  new URL("../../docs/BETA_OPERATIONS.md", import.meta.url),
  "utf8"
)
const roadmap = readFileSync(
  new URL("../docs/beta-launch-roadmap.md", import.meta.url),
  "utf8"
)

test("public beta web feature flags default to the reviewed posture", () => {
  for (const content of [webEnvExample, railwayEnvExample]) {
    assert.match(content, /NEXT_PUBLIC_ENABLE_OPERATIONS=false/)
    assert.match(content, /NEXT_PUBLIC_ENABLE_AGENT_OPS=false/)
    assert.match(content, /NEXT_PUBLIC_ENABLE_MARKETPLACE=true/)
    assert.match(content, /NEXT_PUBLIC_ENABLE_LOCAL_WORKSPACE_FILES=false/)
    assert.match(content, /CLAWCHAT_ENABLE_INTERNAL_DEMO_ROUTES=false/)
    assert.doesNotMatch(content, /NEXT_PUBLIC_ENABLE_MISSION_CONTROL=/)
    assert.doesNotMatch(content, /CLAWCHAT_ENABLE_MISSION_CONTROL_API=/)
    assert.doesNotMatch(content, /MISSION_CONTROL_ADMIN_SECRET=/)
  }

  assert.match(
    configSource,
    /enableAgentOps: publicFeatureFlag\("NEXT_PUBLIC_ENABLE_AGENT_OPS", false\)/
  )
  assert.match(
    configSource,
    /enableMarketplace: publicFeatureFlag\("NEXT_PUBLIC_ENABLE_MARKETPLACE", true\)/
  )
})

test("Agent Ops remains owner/admin-only when explicitly enabled", () => {
  assert.match(
    appSource,
    /const canAccessAgentOps = appConfig\.enableAgentOps && isWorkspaceAdmin/
  )
})

test("Mission Control host internals stay retired while marketplace can be member-visible", () => {
  assert.match(
    appSource,
    /const canAccessMissionControl = false/
  )
  assert.match(
    appSource,
    /const canAccessMarketplace =\s+appConfig\.enableMarketplace && Boolean\(session\?\.user\)/
  )
  assert.match(
    appSource,
    /const canAccessApplications = canAccessMarketplace \|\| canAccessMissionControl/
  )
  assert.match(
    appSource,
    /effectiveSection === "missionControl" &&\s+!canAccessMissionControl &&\s+canAccessMarketplace &&\s+missionControlView !== "marketplace"[\s\S]*setMissionControlView\("marketplace"\)/
  )
  assert.match(
    appSource,
    /<MissionControlSection[\s\S]*canAccessMissionControl=\{canAccessMissionControl\}/
  )
})

test("docs record invite-only signup and backend marketplace beta gating", () => {
  for (const content of [betaOps, roadmap]) {
    assert.match(content, /NEXT_PUBLIC_ENABLE_AGENT_OPS=false/)
    assert.match(content, /NEXT_PUBLIC_ENABLE_MARKETPLACE=true/)
    assert.match(content, /CLAWCHAT_BETA_SIGNUP_MODE=invite/)
    assert.match(content, /CLAWCHAT_MARKETPLACE_BETA_MODE=true/)
  }
})
