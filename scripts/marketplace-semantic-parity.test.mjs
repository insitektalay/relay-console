import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import { validateMarketplaceSemanticParity } from "./marketplace-semantic-parity.mjs"

function fixture() {
  const manifests = Array.from({ length: 406 }, (_, index) => ({
    slug: `provider-${String(index).padStart(3, "0")}`,
    name: `Provider ${index}`,
    authentication: { model: "api_key", relayOwned: false },
    connection: {
      credentialRequirements: [{ name: `TOKEN_${index}` }],
    },
    capabilities: [{ id: `capability_${index}` }],
    actions: {
      allowed: [{ id: `provider_${index}_read` }],
      approvalRequired: [],
      blocked: [{ id: `provider_${index}_write` }],
    },
    approvalProfiles: [{
      id: "safe",
      defaultSelected: true,
      allowedActions: [`provider_${index}_read`],
      approvalRequiredActions: [],
      blockedActions: [`provider_${index}_write`],
    }],
    runtimeSupport: [{ format: "openclaw", installSupport: "installable" }],
    availability: "available",
  }))
  const material = `${JSON.stringify(manifests, null, 2)}\n`
  const sourceSHA256 = createHash("sha256").update(material).digest("hex")
  const catalog = {
    manifestCount: manifests.length,
    sourceSHA256,
    manifests,
  }
  const providers = manifests.map(({ slug }) => ({ slug, connectEligible: true }))
  return {
    backendCatalog: catalog,
    swiftCatalog: structuredClone(catalog),
    typedSourceSHA256: sourceSHA256,
    releaseManifest: { manifestVersion: "test", providers },
    backendConnectorSlugs: manifests.map(({ slug }) => slug),
    nativeAdapterSlugs: [manifests[0].slug],
    atlasIndex: {
      appCount: 406,
      cohortManifestVersion: "test",
      apps: Object.fromEntries(manifests.map(({ slug }) => [slug, {}])),
    },
    assetCopies: [{ path: "copy", matchesCanonical: true }],
    backendCatalogSource: "GENERATED_MARKETPLACE_PROVIDER_IDENTITIES",
    swiftCatalogSource:
      '"authentication" "connection" "capabilities" "runtimeSupport" "availability"',
    webSources: ["sdk.marketplace.catalogPage"],
  }
}

test("semantic parity accepts one canonical launch model", () => {
  const result = validateMarketplaceSemanticParity(fixture())
  assert.equal(result.valid, true, result.errors.join("\n"))
})

test("semantic parity rejects missing handlers and stale packaged assets", () => {
  const input = fixture()
  input.backendConnectorSlugs = input.backendConnectorSlugs.slice(1)
  input.assetCopies[0].matchesCanonical = false
  const result = validateMarketplaceSemanticParity(input)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes("no backend connector")))
  assert.ok(result.errors.some((error) => error.includes("asset is stale")))
})

test("semantic parity rejects cross-platform hash drift and web fallbacks", () => {
  const input = fixture()
  input.swiftCatalog.sourceSHA256 = "0".repeat(64)
  input.webSources.push("FALLBACK_MARKETPLACE_CATALOG")
  const result = validateMarketplaceSemanticParity(input)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.includes("source hashes differ")))
  assert.ok(result.errors.some((error) => error.includes("handwritten Marketplace fallback")))
})
