import assert from "node:assert/strict"
import test from "node:test"
import { marketplaceSource } from "../components/marketplace/marketplace-source.test"
import { relayAppSource } from "./relay-app-source.test"

const app = relayAppSource
const marketplace = marketplaceSource

test("Applications context sidebar shows browse navigation and connected apps", () => {
  assert.match(app, /Refresh applications/)
  assert.match(app, /Browse apps/)
  assert.match(app, /Connected apps/)
  assert.match(app, /marketplaceSidebarApps\.map/)
  assert.match(app, />\s*Connected\s*</)
  assert.match(app, /h-\[58px\]/)
})

test("catalog search, category, selection and status remain data driven", () => {
  assert.match(marketplace, /aria-label="Search marketplace apps"/)
  assert.match(marketplace, /aria-label="Application category"/)
  assert.match(app, /setMarketplaceReturnAppSlug\(app\.slug\)/)
  assert.match(app, /connectedMarketplaceAppSlugs/)
  assert.match(app, /marketplaceCatalogQuery\.refetch/)
  assert.match(app, /marketplaceConnectionsQuery\.refetch/)
  assert.match(app, /marketplaceInstallsQuery\.refetch/)
  assert.match(app, /connection\.status === "ready"/)
  assert.match(marketplace, /data-testid="marketplace-app-grid"/)
  assert.match(marketplace, /Not connected/)
})

test("catalog exposes explicit total, filtered, connected and installed statistics", () => {
  assert.match(app, /data-testid="marketplace-sidebar-count"/)
  assert.match(app, /marketplaceSidebarApps\.length/)
  assert.match(app, /marketplaceSidebarApps\.length/)
  assert.match(marketplace, /data-testid="marketplace-catalog-statistics"/)
  assert.match(marketplace, /label="Railway catalog"/)
  assert.match(marketplace, /label="Showing now"/)
  assert.match(marketplace, /value=\{connectedAppSlugs\.size\}/)
  assert.match(marketplace, /value=\{installedAppSlugs\.size\}/)
})

test("catalog preserves Railway loading, failure, retry, empty and per-app release gates", () => {
  assert.match(app, /Loading applications/)
  assert.match(app, /Could not load applications/)
  assert.match(app, /No connected applications yet/)
  assert.match(marketplace, /MarketplaceBetaSafetyNotice/)
  assert.match(marketplace, /marketplaceBetaMode/)
  assert.match(marketplace, /marketplaceBetaGate/)
  assert.match(marketplace, /MarketplaceDiagnostics/)
  assert.match(marketplace, /All Marketplace apps are shown/)
})

test("provider membership comes from paginated Railway pages rather than sidebar constants", () => {
  assert.match(app, /marketplaceCatalogQuery\.data\?\.pages\.flatMap/)
  assert.match(app, /sdk\.marketplace\.catalogPage/)
  assert.match(app, /marketplaceCatalogQuery\.hasNextPage/)
  assert.match(app, /marketplaceCatalogQuery\.fetchNextPage/)
  assert.doesNotMatch(app, /FALLBACK_MARKETPLACE_CATALOG/)
  assert.doesNotMatch(app, /const SWIFT_APPLICATIONS/)
})
