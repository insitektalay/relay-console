#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const ROOT = resolve(dirname(SCRIPT_PATH), "..")

export const MARKETPLACE_RELEASE_STATES = Object.freeze({
  available: "Available",
  preview: "Preview",
  provider_setup_required: "Provider setup required",
  provider_review_pending: "Provider review pending",
  customer_credential_required: "Beta — customer credentials required",
  unsupported: "Unsupported",
  coming_later: "Coming later",
})

export const CANONICAL_MARKETPLACE_RELEASE_MANIFEST_PATH = resolve(
  ROOT,
  "packages/marketplace-catalog/release/marketplace-release-manifest.json",
)

export const MARKETPLACE_RELEASE_MANIFEST_SNAPSHOT_PATHS = Object.freeze([
  resolve(
    ROOT,
    "backend/src/modules/marketplace/marketplace-release-manifest.json",
  ),
  resolve(
    ROOT,
    "RelayConsoleSwift/Sources/RelayConsoleCore/Resources/marketplace-release-manifest.json",
  ),
])

function parseJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function normalizedManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ""))
}

function isTimestamp(value) {
  return (
    isNonEmptyString(value) &&
    Number.isFinite(Date.parse(value)) &&
    value.includes("T")
  )
}

function validateDecision(decision, location, { provider = false } = {}) {
  const errors = []
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    return [`${location} must be an object.`]
  }
  if (provider && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(decision.slug ?? "")) {
    errors.push(`${location}.slug is invalid.`)
  }
  if (provider && !isDate(decision.reviewedAt)) {
    errors.push(`${location}.reviewedAt must be YYYY-MM-DD.`)
  }
  if (!(decision.state in MARKETPLACE_RELEASE_STATES)) {
    errors.push(`${location}.state is unsupported.`)
  } else if (decision.label !== MARKETPLACE_RELEASE_STATES[decision.state]) {
    errors.push(`${location}.label must be ${MARKETPLACE_RELEASE_STATES[decision.state]}.`)
  }
  if (typeof decision.connectEligible !== "boolean") {
    errors.push(`${location}.connectEligible must be boolean.`)
  }
  if (typeof decision.liveVerified !== "boolean") {
    errors.push(`${location}.liveVerified must be boolean.`)
  }
  if (!isNonEmptyString(decision.reason)) {
    errors.push(`${location}.reason is required.`)
  }

  const usableState =
    decision.state === "available" ||
    decision.state === "customer_credential_required"
  if (decision.connectEligible && !usableState) {
    errors.push(
      `${location}.connectEligible can be true only for Available or Customer credential required.`,
    )
  }
  if (decision.liveVerified && !decision.connectEligible) {
    errors.push(
      `${location}.liveVerified requires connectEligible.`,
    )
  }
  if (decision.liveVerified) {
    const expectedPath = provider
      ? `packages/marketplace-catalog/release/acceptance/${decision.slug}.json`
      : null
    if (!decision.acceptance || typeof decision.acceptance !== "object" || Array.isArray(decision.acceptance)) {
      errors.push(`${location}.acceptance is required for a live-verified provider.`)
    } else {
      if (provider && decision.acceptance.recordPath !== expectedPath) {
        errors.push(`${location}.acceptance.recordPath must be ${expectedPath}.`)
      }
      if (!/^[a-f0-9]{64}$/.test(decision.acceptance.recordSHA256 ?? "")) {
        errors.push(`${location}.acceptance.recordSHA256 must be a SHA-256 digest.`)
      }
    }
  } else if (decision.acceptance != null) {
    errors.push(`${location}.acceptance must be absent until live verification passes.`)
  }
  return errors
}

export function validateMarketplaceReleaseManifest(manifest) {
  const errors = []
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { valid: false, errors: ["The Marketplace release manifest must be an object."] }
  }
  if (manifest.schemaVersion !== "relay.marketplace-release.v1") {
    errors.push("Unsupported Marketplace release manifest schemaVersion.")
  }
  if (!/^\d{4}-\d{2}-\d{2}(?:-[a-z0-9]+(?:[.-][a-z0-9]+)*)?$/.test(manifest.manifestVersion ?? "")) {
    errors.push("manifestVersion is invalid.")
  }
  if (!isNonEmptyString(manifest.releaseChannel)) {
    errors.push("releaseChannel is required.")
  }

  const freeze = manifest.freeze
  if (!freeze || !["open", "frozen"].includes(freeze.status)) {
    errors.push("freeze.status must be open or frozen.")
  } else if (freeze.status === "open") {
    if (freeze.frozenAt !== null || freeze.sourceRevision !== null) {
      errors.push("An open manifest cannot carry frozenAt or sourceRevision.")
    }
  } else {
    if (!isTimestamp(freeze.frozenAt)) {
      errors.push("A frozen manifest requires a valid frozenAt timestamp.")
    }
    if (!/^[a-f0-9]{40}$/.test(freeze.sourceRevision ?? "")) {
      errors.push("A frozen manifest requires a full sourceRevision Git SHA.")
    }
  }

  errors.push(...validateDecision(manifest.defaultProvider, "defaultProvider"))
  if (manifest.defaultProvider?.connectEligible || manifest.defaultProvider?.liveVerified) {
    errors.push("The default provider decision must fail closed.")
  }

  if (!Array.isArray(manifest.providers)) {
    errors.push("providers must be an array.")
  } else {
    const slugs = manifest.providers.map((provider) => provider?.slug ?? "")
    const sorted = [...slugs].sort()
    if (new Set(slugs).size !== slugs.length) {
      errors.push("providers contains duplicate slugs.")
    }
    if (slugs.some((slug, index) => slug !== sorted[index])) {
      errors.push("providers must be sorted by slug.")
    }
    manifest.providers.forEach((provider, index) => {
      errors.push(
        ...validateDecision(provider, `providers[${index}]`, { provider: true }),
      )
    })
  }
  if (
    manifest.freeze?.status !== "frozen" &&
    [manifest.defaultProvider, ...(manifest.providers ?? [])].some(
      (decision) => decision?.connectEligible,
    )
  ) {
    errors.push("Connect cannot be enabled before the manifest is frozen.")
  }
  return { valid: errors.length === 0, errors }
}

export function resolveMarketplaceReleaseDecision(manifest, slug) {
  const normalizedSlug = String(slug ?? "").trim().toLowerCase()
  const provider = manifest.providers.find((entry) => entry.slug === normalizedSlug)
  return {
    manifestVersion: manifest.manifestVersion,
    releaseChannel: manifest.releaseChannel,
    freezeStatus: manifest.freeze.status,
    ...(provider ?? manifest.defaultProvider),
  }
}

export function loadCanonicalMarketplaceReleaseManifest() {
  const manifest = parseJSON(CANONICAL_MARKETPLACE_RELEASE_MANIFEST_PATH)
  const result = validateMarketplaceReleaseManifest(manifest)
  if (!result.valid) {
    throw new Error(result.errors.join("\n"))
  }
  return manifest
}

export function checkMarketplaceReleaseManifestSnapshots(manifest) {
  const expected = normalizedManifest(manifest)
  return MARKETPLACE_RELEASE_MANIFEST_SNAPSHOT_PATHS.flatMap((path) => {
    try {
      return readFileSync(path, "utf8") === expected
        ? []
        : [`Marketplace release manifest snapshot drift: ${path}`]
    } catch (error) {
      return [`Cannot read Marketplace release manifest snapshot ${path}: ${error.message}`]
    }
  })
}

export function syncMarketplaceReleaseManifestSnapshots(manifest) {
  const content = normalizedManifest(manifest)
  for (const path of MARKETPLACE_RELEASE_MANIFEST_SNAPSHOT_PATHS) {
    writeFileSync(path, content)
  }
}

function main() {
  const manifest = loadCanonicalMarketplaceReleaseManifest()
  if (process.argv.includes("--sync")) {
    syncMarketplaceReleaseManifestSnapshots(manifest)
  }
  const errors = checkMarketplaceReleaseManifestSnapshots(manifest)
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`)
    process.exitCode = 1
    return
  }
  const connectEligible = manifest.providers.filter(
    (provider) => provider.connectEligible,
  ).length
  console.log(
    `Validated Marketplace release manifest ${manifest.manifestVersion}: ${manifest.providers.length} reviewed, ${connectEligible} Connect eligible, freeze ${manifest.freeze.status}.`,
  )
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) main()
