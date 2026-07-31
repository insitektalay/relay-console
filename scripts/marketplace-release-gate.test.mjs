import assert from "node:assert/strict"
import test from "node:test"
import { validateMarketplaceReleaseGate } from "./marketplace-release-gate.mjs"

const catalogs = {
  swiftSlugs: ["github", "linear", "slack"],
  backendSlugs: ["github", "linear", "slack"],
}

function releaseManifest(providers = [], freezeStatus = "frozen", liveVerified = true) {
  return {
    schemaVersion: "relay.marketplace-release.v1",
    manifestVersion: "2026-07-18-test.1",
    releaseChannel: "public-beta",
    freeze: freezeStatus === "frozen"
      ? { status: "frozen", frozenAt: "2026-07-18T12:00:00.000Z", sourceRevision: "a".repeat(40) }
      : { status: "open", frozenAt: null, sourceRevision: null },
    defaultProvider: {
      state: "coming_later",
      label: "Coming later",
      connectEligible: false,
      liveVerified: false,
      reason: "Acceptance is incomplete.",
    },
    providers: providers.map((slug) => ({
      slug,
      state: "available",
      label: "Available",
      connectEligible: true,
      liveVerified,
      reason: liveVerified
        ? "Production acceptance passed."
        : "Documentation-reviewed customer credential beta.",
      reviewedAt: "2026-07-18",
      ...(liveVerified
        ? { acceptance: {
            recordPath: `packages/marketplace-catalog/release/acceptance/${slug}.json`,
            recordSHA256: "a".repeat(64),
          } }
        : {}),
    })).sort((left, right) => left.slug.localeCompare(right.slug)),
  }
}

test("accepts only an exact non-empty reviewed production cohort", () => {
  const result = validateMarketplaceReleaseGate({
    ...catalogs,
    betaMode: true,
    releaseManifest: releaseManifest(["linear", "github"]),
    acceptedSlugs: ["github", "linear"],
    allowedSlugs: ["github", "linear"],
    blockedSlugs: ["slack"],
  })

  assert.equal(result.valid, true)
  assert.equal(result.summary.exactAllowlistMatch, true)
  assert.equal(result.summary.liveVerifiedCount, 2)
})

test("rejects a zero-provider launch cohort", () => {
  const result = validateMarketplaceReleaseGate({
    ...catalogs,
    betaMode: true,
    releaseManifest: releaseManifest([]),
    acceptedSlugs: [],
    allowedSlugs: [],
    blockedSlugs: ["slack"],
  })

  assert.equal(result.valid, false)
  assert.match(result.errors.join("\n"), /zero Connect-eligible providers/)
})

test("accepts a Connect-eligible documentation-reviewed cohort without claiming live verification", () => {
  const result = validateMarketplaceReleaseGate({
    ...catalogs,
    betaMode: true,
    releaseManifest: releaseManifest(["github", "linear"], "frozen", false),
    acceptedSlugs: [],
    allowedSlugs: ["github", "linear"],
    blockedSlugs: [],
  })
  assert.equal(result.valid, true)
  assert.equal(result.summary.connectEligibleCount, 2)
  assert.equal(result.summary.liveVerifiedCount, 0)
  assert.equal(result.summary.exactAcceptanceMatch, true)
})

test("accepts customer-owned credentials and keeps providers without connectors configured-only", () => {
  const result = validateMarketplaceReleaseGate({
    ...catalogs,
    betaMode: true,
    releaseManifest: releaseManifest(["github", "linear"], "frozen", false),
    acceptedSlugs: [],
    allowedSlugs: ["github", "linear"],
    blockedSlugs: [],
    backendConnectorSlugs: ["github"],
    providerSecurity: {
      github: {
        relayOwned: false,
        credentialRequirementCount: 1,
        executableActionCount: 1,
        supportedRuntimeCount: 1,
      },
      linear: {
        relayOwned: false,
        credentialRequirementCount: 1,
        executableActionCount: 0,
        supportedRuntimeCount: 0,
      },
    },
  })
  assert.equal(result.valid, true)
  assert.equal(result.summary.registeredConnectorCount, 1)
  assert.equal(result.summary.configuredOnlyCount, 1)
})

test("rejects configured-only providers that expose runtime actions", () => {
  const result = validateMarketplaceReleaseGate({
    ...catalogs,
    betaMode: true,
    releaseManifest: releaseManifest(["linear"], "frozen", false),
    acceptedSlugs: [],
    allowedSlugs: ["linear"],
    blockedSlugs: [],
    backendConnectorSlugs: [],
    providerSecurity: {
      linear: {
        relayOwned: false,
        credentialRequirementCount: 1,
        executableActionCount: 1,
        supportedRuntimeCount: 0,
      },
    },
  })
  assert.equal(result.valid, false)
  assert.equal(result.summary.unsafeConfiguredOnlyCount, 1)
})

test("rejects production drift and allowlist-blocklist overlap", () => {
  const result = validateMarketplaceReleaseGate({
    ...catalogs,
    betaMode: true,
    releaseManifest: releaseManifest(["github"]),
    acceptedSlugs: ["github"],
    allowedSlugs: ["github", "slack"],
    blockedSlugs: ["slack"],
  })

  assert.equal(result.valid, false)
  assert.equal(result.summary.exactAllowlistMatch, false)
  assert.equal(result.summary.blockedAllowlistOverlapCount, 1)
})

test("rejects approved providers missing from either shipping catalog", () => {
  const result = validateMarketplaceReleaseGate({
    betaMode: true,
    releaseManifest: releaseManifest(["github", "linear"]),
    acceptedSlugs: ["github", "linear"],
    allowedSlugs: ["github", "linear"],
    blockedSlugs: [],
    swiftSlugs: ["github"],
    backendSlugs: ["linear"],
  })

  assert.equal(result.valid, false)
  assert.equal(result.summary.missingSwiftCount, 1)
  assert.equal(result.summary.missingBackendCount, 1)
})

test("rejects a valid but still-open Marketplace manifest", () => {
  const result = validateMarketplaceReleaseGate({
    ...catalogs,
    betaMode: true,
    releaseManifest: releaseManifest([], "open"),
    acceptedSlugs: [],
    allowedSlugs: [],
    blockedSlugs: [],
  })
  assert.equal(result.valid, false)
  assert.match(result.errors.join("\n"), /has not been frozen/)
})

test("rejects a live-verified cohort without exact staging acceptance", () => {
  const result = validateMarketplaceReleaseGate({
    ...catalogs,
    betaMode: true,
    releaseManifest: releaseManifest(["github"]),
    acceptedSlugs: [],
    allowedSlugs: ["github"],
    blockedSlugs: [],
  })
  assert.equal(result.valid, false)
  assert.equal(result.summary.exactAcceptanceMatch, false)
  assert.match(result.errors.join("\n"), /staging-accepted provider set differs/)
})

test("rejects a stale or missing provider requirements register", () => {
  const result = validateMarketplaceReleaseGate({
    ...catalogs,
    betaMode: true,
    releaseManifest: releaseManifest(["github"], "frozen", false),
    acceptedSlugs: [],
    allowedSlugs: ["github"],
    blockedSlugs: [],
    providerRequirementErrors: ["Requirements register is stale."],
  })
  assert.equal(result.valid, false)
  assert.equal(result.summary.providerRequirementsValid, false)
  assert.match(result.errors.join("\n"), /Provider requirements: Requirements register is stale/)
})
