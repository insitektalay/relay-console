import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { readRelayConsoleViewSource } from "./swift-view-source.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const relative = (value) => path.join(root, value)
const indexPath = relative(
  "packages/marketplace-catalog/release/marketplace-icon-atlas-index.json"
)
const atlasPath = relative(
  "packages/marketplace-catalog/release/marketplace-icon-atlas.png"
)

const sha256 = (data) => createHash("sha256").update(data).digest("hex")

test("the frozen icon atlas contains the exact 406-app launch cohort", async () => {
  const [release, index, atlas] = await Promise.all([
    readFile(
      relative(
        "packages/marketplace-catalog/release/marketplace-release-manifest.json"
      ),
      "utf8"
    ).then(JSON.parse),
    readFile(indexPath, "utf8").then(JSON.parse),
    readFile(atlasPath),
  ])

  const expectedSlugs = release.providers
    .filter((provider) => provider.connectEligible)
    .map((provider) => provider.slug)
    .sort()
  const actualSlugs = Object.keys(index.apps).sort()
  assert.equal(index.schemaVersion, "relay.marketplace-icon-atlas.v1")
  assert.equal(index.cohortManifestVersion, release.manifestVersion)
  assert.equal(index.appCount, 406)
  assert.deepEqual(actualSlugs, expectedSlugs)
  assert.equal(sha256(atlas), index.atlasSHA256)
  assert.deepEqual([...atlas.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  assert.equal(atlas.readUInt32BE(16), index.atlasWidth)
  assert.equal(atlas.readUInt32BE(20), index.atlasHeight)

  const positions = new Set()
  for (const entry of Object.values(index.apps)) {
    assert.ok(entry.sourceWidth > 0)
    assert.ok(entry.sourceHeight > 0)
    assert.match(entry.sourceSHA256, /^[a-f0-9]{64}$/)
    assert.ok(entry.column >= 0 && entry.column < index.columns)
    assert.ok(entry.row >= 0 && entry.row < index.rows)
    positions.add(`${entry.column}:${entry.row}`)
  }
  assert.equal(positions.size, 406)
})

test("web, macOS, and iPhone/iPad package the identical local atlas", async () => {
  const [canonicalAtlas, canonicalIndex] = await Promise.all([
    readFile(atlasPath),
    readFile(indexPath),
  ])
  const atlasCopies = [
    "web/public/marketplace/marketplace-icon-atlas.png",
    "RelayConsoleSwift/Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-icon-atlas.png",
    "ios/ClawChat/Assets.xcassets/MarketplaceIconAtlas.imageset/marketplace-icon-atlas.png",
  ]
  const indexCopies = [
    "web/lib/marketplace-icon-atlas-index.json",
    "RelayConsoleSwift/Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-icon-atlas-index.json",
    "ios/ClawChat/Assets.xcassets/MarketplaceIconAtlasIndex.dataset/marketplace-icon-atlas-index.json",
  ]
  for (const copy of atlasCopies) {
    assert.deepEqual(await readFile(relative(copy)), canonicalAtlas, copy)
  }
  for (const copy of indexCopies) {
    assert.deepEqual(await readFile(relative(copy)), canonicalIndex, copy)
  }
})

test("Marketplace renderers use packaged icons rather than runtime vendor requests", async () => {
  const [web, mac, ios] = await Promise.all([
    readFile(relative("web/components/marketplace/app-logo.tsx"), "utf8"),
    Promise.resolve(readRelayConsoleViewSource(root)),
    readFile(
      relative("ios/ClawChat/Features/Marketplace/MarketplaceView.swift"),
      "utf8"
    ),
  ])
  assert.match(web, /marketplace-icon-atlas\.png/)
  assert.doesNotMatch(web, /google\.com\/s2\/favicons/)
  assert.match(mac, /ApplicationsMarketplaceIconAtlas/)
  assert.match(ios, /Image\("MarketplaceIconAtlas"\)/)
  assert.doesNotMatch(ios, /google\.com\/s2\/favicons/)
})
