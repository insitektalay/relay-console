import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { marketplaceSource } from "../components/marketplace/marketplace-source.test"
import { relayAppSource } from "./relay-app-source.test"

const missionControlSectionSource = readFileSync(
  new URL(
    "../components/mission-control/mission-control-section.tsx",
    import.meta.url
  ),
  "utf8"
)

const appShellSource = relayAppSource

test("marketplace no-compatible-agent states expose recovery actions", () => {
  assert.match(marketplaceSource, /MarketplaceAgentRecoveryActions/)
  assert.match(marketplaceSource, /No compatible OpenClaw or Hermes agents\./)
  assert.match(marketplaceSource, /No compatible agents available\./)
  assert.match(marketplaceSource, /Create \{runtimeName\} agent/)
  assert.match(marketplaceSource, /Open runtime pairing/)
  assert.match(marketplaceSource, /onCreateCompatibleAgent/)
  assert.match(marketplaceSource, /onOpenRuntimePairing/)
})

test("marketplace recovery callbacks are passed through mission control", () => {
  assert.match(
    missionControlSectionSource,
    /onCreateMarketplaceCompatibleAgent\?:/
  )
  assert.match(
    missionControlSectionSource,
    /onOpenMarketplaceRuntimePairing\?:/
  )
  assert.match(
    missionControlSectionSource,
    /onCreateCompatibleAgent=\{onCreateMarketplaceCompatibleAgent\}/
  )
  assert.match(
    missionControlSectionSource,
    /onOpenRuntimePairing=\{onOpenMarketplaceRuntimePairing\}/
  )
})

test("app shell routes marketplace recovery to existing setup flows", () => {
  assert.match(appShellSource, /function openMarketplaceCompatibleAgent/)
  assert.match(appShellSource, /setSection\("agents"\)/)
  assert.match(appShellSource, /setIsProvisioningAgent\(true\)/)
  assert.match(appShellSource, /setRuntimeAgentTypeDraft\(runtimeType\)/)
  assert.match(appShellSource, /setProvisionAgentNameDraft\(agentName\)/)
  assert.match(appShellSource, /setRuntimeAgentNameDraft\(agentName\)/)
  assert.match(appShellSource, /function openMarketplaceRuntimePairing/)
  assert.match(appShellSource, /setSection\("settings"\)/)
  assert.match(appShellSource, /setSettingsView\("integrations"\)/)
})
