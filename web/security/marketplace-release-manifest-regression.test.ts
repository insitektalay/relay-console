import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { marketplaceSource } from "../components/marketplace/marketplace-source.test"

const root = new URL("../../", import.meta.url)
const canonical = readFileSync(
  new URL(
    "packages/marketplace-catalog/release/marketplace-release-manifest.json",
    root
  ),
  "utf8"
)
const railwaySnapshot = readFileSync(
  new URL(
    "backend/src/modules/marketplace/marketplace-release-manifest.json",
    root
  ),
  "utf8"
)
const macSnapshot = readFileSync(
  new URL(
    "RelayConsoleSwift/Sources/RelayConsoleCore/Resources/marketplace-release-manifest.json",
    root
  ),
  "utf8"
)
const backendPolicy = readFileSync(
  new URL(
    "backend/src/modules/marketplace/marketplace-release-policy.ts",
    root
  ),
  "utf8"
)

test("web, Railway, and macOS share one exact versioned Marketplace release decision", () => {
  assert.equal(railwaySnapshot, canonical)
  assert.equal(macSnapshot, canonical)
  const manifest = JSON.parse(canonical)
  assert.equal(manifest.schemaVersion, "relay.marketplace-release.v1")
  assert.equal(manifest.freeze.status, "frozen")
  assert.equal(manifest.manifestVersion, "2026-07-26-launch-cohort.4")
  assert.equal(manifest.providers.length, 406)
  assert.equal(
    manifest.providers.every(
      (provider: { connectEligible: boolean; liveVerified: boolean }) =>
        provider.connectEligible && !provider.liveVerified
    ),
    true
  )
  assert.equal(manifest.defaultProvider.state, "coming_later")
  assert.equal(manifest.defaultProvider.connectEligible, false)
  assert.equal(manifest.defaultProvider.liveVerified, false)
})

test("web exposes the canonical label but never Connect for an ineligible provider", () => {
  assert.match(marketplaceSource, /app\.release\.label/)
  assert.match(marketplaceSource, /return release\.connectEligible/)
  assert.match(
    marketplaceSource,
    /app\?\.release && !isMarketplaceConnectEligible\(app\)/
  )
})

test("Railway refuses an ineligible provider before credential execution", () => {
  assert.match(backendPolicy, /assertMarketplaceReleaseConnectEligible/)
  assert.match(
    backendPolicy,
    /release\.freezeStatus === "frozen" && release\.connectEligible/
  )
  assert.match(backendPolicy, /throw new ForbiddenException/)
})
