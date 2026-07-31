import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { marketplaceSource } from "../components/marketplace/marketplace-source.test"

const sdkSource = readFileSync(
  new URL("../../packages/web-sdk/src/index.ts", import.meta.url),
  "utf8"
)

test("Marketplace catalog and detail framework exposes recovery states", () => {
  assert.match(marketplaceSource, /catalogUnavailable/)
  assert.match(marketplaceSource, /catalogQuery\.isLoading/)
  assert.match(marketplaceSource, /catalogQuery\.isError/)
  assert.match(marketplaceSource, /catalogQuery\.refetch/)
  assert.match(marketplaceSource, /No apps match the current filters/)
  assert.match(marketplaceSource, /selectedApp/)
  assert.match(marketplaceSource, /MarketplaceReadOnlyDetails/)
})

test("Marketplace connection lifecycle retains health and OAuth recovery", () => {
  assert.match(sdkSource, /marketplace\/connections/)
  assert.match(sdkSource, /oauth\/reauthorize/)
  assert.match(sdkSource, /\/disconnect/)
  assert.match(sdkSource, /\/health/)
  assert.match(sdkSource, /sender-identities\/validate/)
  assert.match(marketplaceSource, /connectorHealthQuery/)
  assert.match(marketplaceSource, /disconnectConnectorOAuthMutation/)
  assert.match(marketplaceSource, /reauthorizeConnectorOAuthMutation/)
})

test("Marketplace installs preserve compatible roles, policy, and removal", () => {
  assert.match(marketplaceSource, /compatibleOperatorAgentCards/)
  assert.match(marketplaceSource, /selectedManagerAgentId/)
  assert.match(marketplaceSource, /selectedAuditorAgentId/)
  assert.match(marketplaceSource, /approvalProfileId/)
  assert.match(marketplaceSource, /autonomyPolicy/)
  assert.match(marketplaceSource, /connectAppMutation/)
  assert.match(marketplaceSource, /removeInstallMutation/)
  assert.match(sdkSource, /marketplace\/installs/)
  assert.match(sdkSource, /marketplace\/install/)
})

test("Marketplace needed tools, safety, and diagnostics remain visible", () => {
  assert.match(sdkSource, /marketplace\/tool-requests/)
  assert.match(marketplaceSource, /toolRequestsQuery/)
  assert.match(marketplaceSource, /updateToolRequestStatusMutation/)
  assert.match(marketplaceSource, /MARKETPLACE_BETA_SAFETY_NOTICE/)
  assert.match(marketplaceSource, /selectedApp\.riskLevel/)
  assert.match(marketplaceSource, /acknowledgeGeneratedDraftRisk/)
  assert.match(marketplaceSource, /approvalRequiredActions/)
  assert.match(marketplaceSource, /diagnostics/i)
})

test("provider membership remains backend-driven rather than a parity constant", () => {
  assert.match(sdkSource, /marketplace\/catalog/)
  assert.match(marketplaceSource, /const catalogApps = useMemo/)
  assert.doesNotMatch(
    marketplaceSource,
    /catalogQuery\.data\s*\?\?\s*FALLBACK_MARKETPLACE_CATALOG/
  )
})
