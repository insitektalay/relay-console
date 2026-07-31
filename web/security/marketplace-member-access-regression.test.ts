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

function sourceBlock(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex)
  assert.notEqual(startIndex, -1, `Missing source start marker: ${start}`)
  assert.notEqual(endIndex, -1, `Missing source end marker: ${end}`)
  return source.slice(startIndex, endIndex)
}

test("Marketplace manage capability is driven by workspace admin state", () => {
  assert.match(marketplaceSource, /canManageMarketplace = false/)
  assert.match(missionControlSectionSource, /canManageMarketplace\?: boolean/)
  assert.match(
    missionControlSectionSource,
    /canManageMarketplace=\{canManageMarketplace === true\}/
  )
  assert.match(appShellSource, /canManageMarketplace=\{isWorkspaceAdmin\}/)
})

test("Marketplace member catalog excludes local apps and admin-only tabs", () => {
  assert.match(
    marketplaceSource,
    /catalogApps\.filter\(\(app\) => app\.sourceType !== "local_repo"\)/
  )
  assert.match(
    marketplaceSource,
    /\["local", "Local Apps", canManageMarketplace\]/
  )
  assert.match(
    marketplaceSource,
    /\["review", "Review \/ Updates", canManageMarketplace\]/
  )
  assert.match(
    marketplaceSource,
    /effectiveMarketplaceView === "local" && canManageMarketplace/
  )
})

test("Marketplace source-host and review data only load for managers", () => {
  assert.match(
    sourceBlock(
      marketplaceSource,
      "const localSourceHostsQuery = useQuery({",
      "const pagedCatalog ="
    ),
    /enabled: canManageMarketplace/
  )
  assert.match(
    sourceBlock(
      marketplaceSource,
      "const toolRequestsQuery = useQuery({",
      "const xOAuthConfigQuery = useQuery({"
    ),
    /enabled: Boolean\(canManageMarketplace && selectedApp\?\.slug\)/
  )
  assert.match(
    sourceBlock(
      marketplaceSource,
      "const previewQuery = useQuery({",
      "const generatedPackDetailQuery = useQuery({"
    ),
    /enabled:[\s\S]*canManageMarketplace/
  )
})

test("Marketplace member detail view is read-only", () => {
  assert.match(marketplaceSource, /MarketplaceReadOnlyDetails/)
  assert.match(
    marketplaceSource,
    /Only workspace owners and admins can manage Marketplace apps\./
  )
  assert.match(marketplaceSource, /canManageMarketplace \? \(/)
  assert.match(
    marketplaceSource,
    /onRequestRemove=\{[\s\S]*canManageMarketplace/
  )
  assert.match(
    sourceBlock(
      marketplaceSource,
      "const connectAppMutation = useMutation({",
      "const refreshGeneratedPack = async () => {"
    ),
    /assertCanManageMarketplace\(\)/
  )
  assert.match(
    sourceBlock(
      marketplaceSource,
      "const configureLinkCrestOpenClawMutation = useMutation({",
      "const persistAutonomyPolicy ="
    ),
    /assertCanManageMarketplace\(\)/
  )
})
