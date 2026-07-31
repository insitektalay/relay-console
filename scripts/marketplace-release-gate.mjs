#!/usr/bin/env node

import { createHash } from "node:crypto"
import { readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  loadCanonicalMarketplaceReleaseManifest,
  validateMarketplaceReleaseManifest,
} from "./marketplace-release-manifest.mjs"
import { validateMarketplaceAcceptanceRepository } from "./marketplace-provider-acceptance.mjs"
import { checkMarketplaceProviderRequirementsRegister } from "./marketplace-provider-requirements.mjs"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const ROOT = resolve(SCRIPT_PATH, "../..")
const TRUE_VALUES = new Set(["1", "true", "yes", "y", "on"])

function normalizedSlugs(values) {
  return [...new Set(values.map((value) => String(value).trim().toLowerCase()).filter(Boolean))].sort()
}

function envSlugs(value) {
  return normalizedSlugs(String(value ?? "").split(","))
}

function sourceSlugs(path, pattern) {
  return normalizedSlugs(
    [...readFileSync(path, "utf8").matchAll(pattern)].map((match) => match[1]),
  )
}

function providerCatalogSlugs(path) {
  const catalog = JSON.parse(readFileSync(path, "utf8"))
  return normalizedSlugs((catalog.manifests ?? []).map((manifest) => manifest.slug))
}

function sourceSlugsUnder(path, pattern) {
  const values = []
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name)
    if (entry.isDirectory()) {
      values.push(...sourceSlugsUnder(child, pattern))
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      values.push(...sourceSlugs(child, pattern))
    }
  }
  return normalizedSlugs(values)
}

function equal(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function difference(left, right) {
  const accepted = new Set(right)
  return left.filter((value) => !accepted.has(value))
}

function loadProviderSecurity(slugs) {
  const providers = {}
  for (const slug of slugs) {
    const path = resolve(ROOT, "packages/marketplace-catalog/providers", slug, "manifest.json")
    const manifest = JSON.parse(readFileSync(path, "utf8"))
    providers[slug] = {
      relayOwned: manifest.authentication?.relayOwned,
      hasCustomerOwnedCredentialBoundary:
        manifest.authentication?.relayOwned === false ||
        manifest.connection?.types?.includes("customer_owned_api_key"),
      credentialRequirementCount: manifest.connection?.credentialRequirements?.length ?? 0,
      executableActionCount:
        (manifest.actions?.allowed?.length ?? 0) +
        (manifest.actions?.approvalRequired?.length ?? 0),
      supportedRuntimeCount: (manifest.runtimeSupport ?? []).filter(
        (runtime) => runtime.installSupport !== "unsupported",
      ).length,
    }
  }
  return providers
}

function fingerprint(slugs) {
  return createHash("sha256").update(slugs.join("\n")).digest("hex")
}

export function validateMarketplaceReleaseGate(input) {
  const manifestResult = validateMarketplaceReleaseManifest(input.releaseManifest)
  const reviewedSlugs = manifestResult.valid
    ? normalizedSlugs(input.releaseManifest.providers.map((provider) => provider.slug))
    : []
  const connectEligibleSlugs = manifestResult.valid
    ? normalizedSlugs(
        input.releaseManifest.providers
          .filter((provider) => provider.connectEligible)
          .map((provider) => provider.slug),
      )
    : []
  const liveVerifiedSlugs = manifestResult.valid
    ? normalizedSlugs(
        input.releaseManifest.providers
          .filter((provider) => provider.liveVerified)
          .map((provider) => provider.slug),
      )
    : []
  const allowedSlugs = normalizedSlugs(input.allowedSlugs ?? [])
  const acceptedSlugs = normalizedSlugs(input.acceptedSlugs ?? [])
  const blockedSlugs = normalizedSlugs(input.blockedSlugs ?? [])
  const swiftSlugs = normalizedSlugs(input.swiftSlugs ?? [])
  const backendSlugs = normalizedSlugs(input.backendSlugs ?? [])
  const backendConnectorSlugs = normalizedSlugs(input.backendConnectorSlugs ?? [])
  const errors = []

  if (!manifestResult.valid) {
    errors.push(`The canonical release manifest is invalid (${manifestResult.errors.length} errors).`)
  }
  if (!input.betaMode) errors.push("Production Marketplace beta mode must be enabled.")
  if (input.releaseManifest?.freeze?.status !== "frozen") {
    errors.push("The Marketplace release manifest has not been frozen.")
  }
  if (connectEligibleSlugs.length === 0) errors.push("The reviewed launch cohort has zero Connect-eligible providers.")
  if (!equal(acceptedSlugs, liveVerifiedSlugs)) {
    errors.push(
      `The staging-accepted provider set differs from the Relay-verified subset (${acceptedSlugs.length} accepted, ${liveVerifiedSlugs.length} verified).`,
    )
  }
  for (const error of input.acceptanceErrors ?? []) errors.push(`Provider acceptance: ${error}`)
  for (const error of input.providerRequirementErrors ?? []) errors.push(`Provider requirements: ${error}`)
  if (!equal(allowedSlugs, connectEligibleSlugs)) {
    errors.push(
      `The production allowlist differs from the Connect-eligible cohort (${allowedSlugs.length} configured, ${connectEligibleSlugs.length} eligible).`,
    )
  }
  const blockedAllowed = allowedSlugs.filter((slug) => blockedSlugs.includes(slug))
  if (blockedAllowed.length) {
    errors.push(`${blockedAllowed.length} configured providers are also blocked.`)
  }
  const missingSwift = difference(connectEligibleSlugs, swiftSlugs)
  if (missingSwift.length) errors.push(`${missingSwift.length} Connect-eligible providers are absent from the Swift catalog.`)
  const missingBackend = difference(connectEligibleSlugs, backendSlugs)
  if (missingBackend.length) errors.push(`${missingBackend.length} Connect-eligible providers are absent from the Railway catalog.`)
  const configuredOnlySlugs = difference(connectEligibleSlugs, backendConnectorSlugs)
  const providerSecurity = input.providerSecurity ?? null
  let invalidCredentialBoundaryCount = 0
  let unsafeConfiguredOnlyCount = 0
  if (providerSecurity) {
    for (const slug of connectEligibleSlugs) {
      const security = providerSecurity[slug]
      const hasCustomerOwnedCredentialBoundary =
        security?.hasCustomerOwnedCredentialBoundary ??
        (security?.relayOwned === false && security?.credentialRequirementCount > 0)
      if (
        !security ||
        !hasCustomerOwnedCredentialBoundary ||
        security.credentialRequirementCount < 1
      ) {
        invalidCredentialBoundaryCount += 1
      }
    }
    for (const slug of configuredOnlySlugs) {
      const security = providerSecurity[slug]
      if (
        !security ||
        security.executableActionCount !== 0 ||
        security.supportedRuntimeCount !== 0
      ) {
        unsafeConfiguredOnlyCount += 1
      }
    }
    if (invalidCredentialBoundaryCount) {
      errors.push(
        `${invalidCredentialBoundaryCount} Connect-eligible providers do not have a customer-owned credential boundary.`,
      )
    }
    if (unsafeConfiguredOnlyCount) {
      errors.push(
        `${unsafeConfiguredOnlyCount} configured-only providers expose executable actions or runtime installation without a registered backend connector.`,
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      betaMode: Boolean(input.betaMode),
      manifestVersion: input.releaseManifest?.manifestVersion ?? null,
      freezeStatus: input.releaseManifest?.freeze?.status ?? null,
      reviewedCount: reviewedSlugs.length,
      connectEligibleCount: connectEligibleSlugs.length,
      liveVerifiedCount: liveVerifiedSlugs.length,
      stagingAcceptedCount: acceptedSlugs.length,
      allowedCount: allowedSlugs.length,
      blockedCount: blockedSlugs.length,
      connectEligibleSHA256: fingerprint(connectEligibleSlugs),
      liveVerifiedSHA256: fingerprint(liveVerifiedSlugs),
      stagingAcceptedSHA256: fingerprint(acceptedSlugs),
      exactAcceptanceMatch: equal(acceptedSlugs, liveVerifiedSlugs),
      allowedSHA256: fingerprint(allowedSlugs),
      exactAllowlistMatch: equal(allowedSlugs, connectEligibleSlugs),
      blockedAllowlistOverlapCount: blockedAllowed.length,
      missingSwiftCount: missingSwift.length,
      missingBackendCount: missingBackend.length,
      registeredConnectorCount: connectEligibleSlugs.length - configuredOnlySlugs.length,
      configuredOnlyCount: configuredOnlySlugs.length,
      invalidCredentialBoundaryCount,
      unsafeConfiguredOnlyCount,
      providerRequirementsValid: (input.providerRequirementErrors ?? []).length === 0,
    },
  }
}

function main() {
  const releaseManifest = loadCanonicalMarketplaceReleaseManifest()
  const acceptance = validateMarketplaceAcceptanceRepository({
    root: ROOT,
    releaseManifest,
  })
  const providerRequirements = checkMarketplaceProviderRequirementsRegister(releaseManifest)
  const swiftSlugs = providerCatalogSlugs(
    resolve(ROOT, "RelayConsoleSwift/Sources/RelayConsoleCore/Resources/marketplace-provider-catalog.json"),
  )
  const backendCatalogSlugs = providerCatalogSlugs(
    resolve(ROOT, "backend/src/modules/marketplace/catalog/generated-provider-catalog.json"),
  )
  const backendConnectorSlugs = sourceSlugsUnder(
    resolve(ROOT, "backend/src/modules/marketplace/connectors"),
    /\bslug:\s*"([a-z0-9-]+)"/g,
  )
  const backendSlugs = normalizedSlugs([
    ...backendCatalogSlugs,
    ...backendConnectorSlugs,
  ])
  const connectEligibleSlugs = normalizedSlugs(
    releaseManifest.providers
      .filter((provider) => provider.connectEligible)
      .map((provider) => provider.slug),
  )
  const result = validateMarketplaceReleaseGate({
    betaMode: TRUE_VALUES.has(String(process.env.CLAWCHAT_MARKETPLACE_BETA_MODE ?? "").trim().toLowerCase()),
    releaseManifest,
    acceptedSlugs: acceptance.acceptedSlugs,
    acceptanceErrors: acceptance.errors,
    providerRequirementErrors: providerRequirements.errors,
    allowedSlugs: envSlugs(process.env.CLAWCHAT_MARKETPLACE_ALLOWED_APPS),
    blockedSlugs: envSlugs(process.env.CLAWCHAT_MARKETPLACE_BLOCKED_APPS),
    swiftSlugs,
    backendSlugs,
    backendConnectorSlugs,
    providerSecurity: loadProviderSecurity(connectEligibleSlugs),
  })

  console.log(JSON.stringify(result.summary, null, 2))
  for (const error of result.errors) console.error(`ERROR: ${error}`)
  if (!result.valid) process.exitCode = 1
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) main()
