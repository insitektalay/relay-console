import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import test from "node:test"
import { marketplaceSource } from "../components/marketplace/marketplace-source.test"
import { relayAppSource } from "./relay-app-source.test"

const appSource = relayAppSource
const configSource = readFileSync(
  new URL("../lib/config.ts", import.meta.url),
  "utf8"
)
const handoffEnvDocs = readFileSync(
  new URL("../docs/railway-handoff/ENVIRONMENT_VARIABLES.md", import.meta.url),
  "utf8"
)
const fallbackPath = new URL("../lib/marketplace-fallback.ts", import.meta.url)

test("the handwritten marketplace fallback and its feature flag are retired", () => {
  assert.equal(existsSync(fallbackPath), false)
  assert.doesNotMatch(configSource, /MARKETPLACE_DEMO_FALLBACK/)
  assert.doesNotMatch(handoffEnvDocs, /MARKETPLACE_DEMO_FALLBACK/)
  assert.doesNotMatch(appSource, /FALLBACK_MARKETPLACE_CATALOG|MARKETPLACE_LOGOS/)
  assert.doesNotMatch(
    marketplaceSource,
    /FALLBACK_MARKETPLACE_CATALOG|shouldUseMarketplaceFallbackCatalog/
  )
})

test("marketplace failures remain visible and retryable against Railway", () => {
  assert.match(
    marketplaceSource,
    /catalogQuery\.data\?\.pages[\s\S]*pages\.flatMap\(\(page\) => page\.apps\)/
  )
  assert.match(marketplaceSource, /const EMPTY_MARKETPLACE_CATALOG/)
  assert.match(marketplaceSource, /const catalogUnavailable =/)
  assert.match(marketplaceSource, /void catalogQuery\.refetch\(\)/)
})

test("app shell membership is sourced only from paginated Railway data", () => {
  assert.match(
    appSource,
    /marketplaceCatalogQuery\.data\?\.pages\.flatMap\(\(page\) => page\.apps\) \?\? \[\]/
  )
})
