import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { marketplaceSource } from "../components/marketplace/marketplace-source.test"
import { relayAppSource } from "./relay-app-source.test"

const source = marketplaceSource
const logoSource = readFileSync(
  new URL("../components/marketplace/app-logo.tsx", import.meta.url),
  "utf8"
)
const appShellSource = relayAppSource

test("provider details follow the shared Swift hero assignment connection order", () => {
  const hero = source.indexOf("{selectedApp.description}")
  const assignment = source.indexOf("Agents with {selectedApp.name}")
  const connection = source.indexOf("Manage API Connection")
  assert.ok(hero > 0)
  assert.ok(assignment > hero)
  assert.ok(connection > assignment)
  assert.match(source, /MARKETPLACE_CATEGORY_LABELS\[selectedApp\.category\]/)
  assert.match(source, /getMarketplaceAppStatus/)
})

test("provider presentation uses product copy and the shared local icon atlas", () => {
  assert.match(source, /\{selectedApp\.description\}/)
  assert.doesNotMatch(
    source,
    /selectedApp\.agentUseSummary \|\| selectedApp\.description/
  )
  assert.match(logoSource, /marketplace-icon-atlas-index\.json/)
  assert.match(logoSource, /MARKETPLACE_ICON_ATLAS_URL/)
  assert.match(appShellSource, /<AppLogo app=\{app\} size="sm" \/>/)
  assert.doesNotMatch(
    appShellSource,
    /\{app\.name\.slice\(0, 2\)\.toUpperCase\(\)\}/
  )
})

test("agent assignment mirrors Swift connection search and toggle states", () => {
  assert.match(source, /aria-label="Active connection"/)
  assert.match(source, /No connection selected/)
  assert.match(source, /placeholder="Search agents\.\.\."/)
  assert.match(source, /selectedAgentIds\.has\(agent\.id\)/)
  assert.match(source, /No matching agents/)
})

test("provider-specific OAuth, API key, health and recovery controls remain", () => {
  assert.match(source, /XOAuthSetupNotice/)
  assert.match(source, /ConnectorOAuthSetupNotice/)
  assert.match(source, /ApiKeyConnectorStatusCard/)
  assert.match(source, /credentialRequirements/)
  assert.match(source, /MarketplaceUnavailableNotice/)
  assert.match(source, /MarketplaceDiagnostics/)
  assert.match(source, /RemoveInstallDialog/)
})
