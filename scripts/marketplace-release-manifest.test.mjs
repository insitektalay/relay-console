import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import {
  loadCanonicalMarketplaceReleaseManifest,
  resolveMarketplaceReleaseDecision,
  validateMarketplaceReleaseManifest,
} from "./marketplace-release-manifest.mjs"

const repositoryRoot = resolve(fileURLToPath(import.meta.url), "../..")

function manifest(overrides = {}) {
  return {
    schemaVersion: "relay.marketplace-release.v1",
    manifestVersion: "2026-07-14-test.1",
    releaseChannel: "public-beta",
    freeze: { status: "open", frozenAt: null, sourceRevision: null },
    defaultProvider: {
      state: "coming_later",
      label: "Coming later",
      connectEligible: false,
      liveVerified: false,
      reason: "Provider acceptance is incomplete.",
    },
    providers: [],
    ...overrides,
  }
}

function acceptance(slug) {
  return {
    recordPath: `packages/marketplace-catalog/release/acceptance/${slug}.json`,
    recordSHA256: "a".repeat(64),
  }
}

test("accepts an open fail-closed manifest while the catalog loop continues", () => {
  assert.deepEqual(validateMarketplaceReleaseManifest(manifest()), {
    valid: true,
    errors: [],
  })
})

test("resolves an unlisted researched provider to Coming later without Connect", () => {
  const result = resolveMarketplaceReleaseDecision(manifest(), "new-provider")
  assert.equal(result.state, "coming_later")
  assert.equal(result.connectEligible, false)
  assert.equal(result.liveVerified, false)
})

test("allows a documentation-reviewed beta provider to Connect without claiming Relay verification", () => {
  const candidate = manifest({
    providers: [
      {
        slug: "github",
        state: "available",
        label: "Available",
        connectEligible: true,
        liveVerified: false,
        reason: "Code is complete but production acceptance is missing.",
        reviewedAt: "2026-07-14",
      },
    ],
  })
  const result = validateMarketplaceReleaseManifest(candidate)
  assert.equal(result.valid, false)
  assert.match(result.errors.join("\n"), /before the manifest is frozen/)
})

test("accepts Connect only for a live-verified provider in a frozen manifest", () => {
  const candidate = manifest({
    freeze: {
      status: "frozen",
      frozenAt: "2026-07-18T12:00:00.000Z",
      sourceRevision: "a".repeat(40),
    },
    providers: [
      {
        slug: "github",
        state: "available",
        label: "Available",
        connectEligible: true,
        liveVerified: true,
        reason: "The production acceptance journey passed.",
        reviewedAt: "2026-07-18",
        acceptance: acceptance("github"),
      },
    ],
  })
  assert.deepEqual(validateMarketplaceReleaseManifest(candidate), {
    valid: true,
    errors: [],
  })
})

test("locks the canonical launch cohort to 406 bounded Connect-eligible providers", () => {
  const canonical = loadCanonicalMarketplaceReleaseManifest()
  assert.equal(canonical.freeze.status, "frozen")
  assert.equal(canonical.providers.length, 406)
  assert.equal(new Set(canonical.providers.map(({ slug }) => slug)).size, 406)
  assert.equal(
    canonical.providers.every(
      (provider) =>
        provider.state === "customer_credential_required" &&
        provider.connectEligible === true &&
        provider.liveVerified === false &&
        provider.acceptance == null,
    ),
    true,
  )
})

test("keeps every launch provider on customer-owned authentication", () => {
  const canonical = loadCanonicalMarketplaceReleaseManifest()
  const launchProviders = canonical.providers.map(({ slug }) => {
    const path = resolve(
      repositoryRoot,
      "packages/marketplace-catalog/providers",
      slug,
      "manifest.json",
    )
    return JSON.parse(readFileSync(path, "utf8"))
  })

  assert.equal(launchProviders.length, 406)
  assert.equal(
    launchProviders.every(
      (provider) =>
        provider.authentication?.relayOwned === false &&
        (provider.connection?.credentialRequirements?.length ?? 0) > 0 &&
        ((provider.actions?.allowed?.length ?? 0) > 0 ||
          (provider.actions?.approvalRequired?.length ?? 0) > 0) &&
        (provider.runtimeSupport ?? []).some(
          (runtime) => runtime.installSupport !== "unsupported",
        ),
    ),
    true,
  )
  assert.deepEqual(
    launchProviders
      .filter((provider) => provider.authentication?.relayOwned)
      .map(({ slug }) => slug),
    [],
  )
})

test("refuses boolean-only live verification without a staging acceptance record", () => {
  const candidate = manifest({
    freeze: {
      status: "frozen",
      frozenAt: "2026-07-18T12:00:00.000Z",
      sourceRevision: "a".repeat(40),
    },
    providers: [{
      slug: "github",
      state: "available",
      label: "Available",
      connectEligible: true,
      liveVerified: true,
      reason: "A reviewer changed the booleans.",
      reviewedAt: "2026-07-18",
    }],
  })
  const result = validateMarketplaceReleaseManifest(candidate)
  assert.equal(result.valid, false)
  assert.match(result.errors.join("\n"), /acceptance is required/)
})

test("refuses stale acceptance metadata on a gated provider", () => {
  const candidate = manifest({
    providers: [{
      slug: "github",
      state: "preview",
      label: "Preview",
      connectEligible: false,
      liveVerified: false,
      reason: "Acceptance is incomplete.",
      reviewedAt: "2026-07-18",
      acceptance: acceptance("github"),
    }],
  })
  const result = validateMarketplaceReleaseManifest(candidate)
  assert.equal(result.valid, false)
  assert.match(result.errors.join("\n"), /must be absent/)
})

test("requires canonical labels, unique slugs, and deterministic ordering", () => {
  const candidate = manifest({
    providers: [
      {
        slug: "slack",
        state: "preview",
        label: "Ready",
        connectEligible: false,
        liveVerified: false,
        reason: "Acceptance is incomplete.",
        reviewedAt: "2026-07-14",
      },
      {
        slug: "github",
        state: "preview",
        label: "Preview",
        connectEligible: false,
        liveVerified: false,
        reason: "Acceptance is incomplete.",
        reviewedAt: "2026-07-14",
      },
      {
        slug: "github",
        state: "preview",
        label: "Preview",
        connectEligible: false,
        liveVerified: false,
        reason: "Acceptance is incomplete.",
        reviewedAt: "2026-07-14",
      },
    ],
  })
  const result = validateMarketplaceReleaseManifest(candidate)
  assert.equal(result.valid, false)
  assert.match(result.errors.join("\n"), /duplicate slugs/)
  assert.match(result.errors.join("\n"), /sorted by slug/)
  assert.match(result.errors.join("\n"), /label must be Preview/)
})
