#!/usr/bin/env node

import { createHash } from "node:crypto"
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const ROOT = resolve(dirname(SCRIPT_PATH), "..")

function normalizedJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function sortedUnique(values) {
  return [...new Set(values)].sort()
}

function sameValues(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  )
}

function credentialNames(manifest) {
  return (manifest.connection?.credentialRequirements ?? [])
    .map((credential) =>
      typeof credential === "string"
        ? credential
        : credential?.name ?? credential?.key ?? credential?.id,
    )
    .filter(Boolean)
}

function executableActionIds(manifest) {
  return [
    ...(manifest.actions?.allowed ?? []),
    ...(manifest.actions?.approvalRequired ?? []),
  ].map(({ id }) => id)
}

function hasCustomerOwnedCredentialBoundary(manifest) {
  return (
    manifest.authentication?.relayOwned === false ||
    manifest.connection?.types?.includes("customer_owned_api_key")
  )
}

function providerSlugsFromAdapterSource(source) {
  return sortedUnique(
    [...source.matchAll(/providerSlugs:\s*\[([\s\S]*?)\]\)/g)].flatMap(
      (match) => [...match[1].matchAll(/"([a-z0-9-]+)"/g)].map((entry) => entry[1]),
    ),
  )
}

function connectorSlugsUnder(path) {
  const values = []
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = resolve(path, entry.name)
    if (entry.isDirectory()) {
      values.push(...connectorSlugsUnder(child))
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      values.push(
        ...[...readFileSync(child, "utf8").matchAll(/\bslug:\s*"([a-z0-9-]+)"/g)]
          .map((match) => match[1]),
      )
    }
  }
  return values
}

export function validateMarketplaceSemanticParity(input) {
  const errors = []
  const manifests = input.backendCatalog?.manifests ?? []
  const manifestSlugs = manifests.map(({ slug }) => slug)
  const manifestBySlug = new Map(manifests.map((manifest) => [manifest.slug, manifest]))
  const sourceSHA256 = sha256(normalizedJson(manifests))

  if (new Set(manifestSlugs).size !== manifestSlugs.length) {
    errors.push("Canonical provider slugs are not unique.")
  }
  if (!sameValues(manifestSlugs, [...manifestSlugs].sort())) {
    errors.push("Canonical provider manifests are not sorted by slug.")
  }
  if (
    input.backendCatalog?.manifestCount !== manifests.length ||
    input.swiftCatalog?.manifestCount !== manifests.length
  ) {
    errors.push("Generated catalog manifest counts differ.")
  }
  if (
    input.backendCatalog?.sourceSHA256 !== sourceSHA256 ||
    input.swiftCatalog?.sourceSHA256 !== sourceSHA256 ||
    input.typedSourceSHA256 !== sourceSHA256
  ) {
    errors.push("Generated catalog source hashes differ.")
  }
  if (
    normalizedJson(input.backendCatalog) !== normalizedJson(input.swiftCatalog)
  ) {
    errors.push("Railway and Swift generated catalog snapshots differ.")
  }

  for (const manifest of manifests) {
    const allowed = (manifest.actions?.allowed ?? []).map(({ id }) => id)
    const approval = (manifest.actions?.approvalRequired ?? []).map(({ id }) => id)
    const blocked = (manifest.actions?.blocked ?? []).map(({ id }) => id)
    const declared = [...allowed, ...approval, ...blocked]
    if (new Set(declared).size !== declared.length) {
      errors.push(`${manifest.slug} declares a duplicate action identity.`)
    }
    const capabilities = (manifest.capabilities ?? []).map(({ id }) => id)
    if (new Set(capabilities).size !== capabilities.length) {
      errors.push(`${manifest.slug} declares a duplicate capability identity.`)
    }
    const fields = credentialNames(manifest)
    if (new Set(fields).size !== fields.length) {
      errors.push(`${manifest.slug} declares a duplicate credential field.`)
    }
    const defaultProfiles = (manifest.approvalProfiles ?? []).filter(
      ({ defaultSelected }) => defaultSelected,
    )
    if (defaultProfiles.length !== 1) {
      errors.push(`${manifest.slug} must select exactly one default approval profile.`)
    }
    const declaredSet = new Set(declared)
    for (const profile of manifest.approvalProfiles ?? []) {
      for (const reference of [
        ...(profile.allowedActions ?? []),
        ...(profile.approvalRequiredActions ?? []),
        ...(profile.blockedActions ?? []),
      ]) {
        const id = typeof reference === "string" ? reference : reference?.id
        if (!declaredSet.has(id)) {
          errors.push(`${manifest.slug}/${profile.id} references unknown action ${id}.`)
        }
      }
    }
  }

  const connectEligibleSlugs = (input.releaseManifest?.providers ?? [])
    .filter(({ connectEligible }) => connectEligible)
    .map(({ slug }) => slug)
    .sort()
  if (connectEligibleSlugs.length !== 406) {
    errors.push(`Expected 406 Connect-eligible providers, found ${connectEligibleSlugs.length}.`)
  }
  const connectorSlugs = new Set(input.backendConnectorSlugs)
  for (const slug of connectEligibleSlugs) {
    const manifest = manifestBySlug.get(slug)
    if (!manifest) {
      errors.push(`Connect-eligible provider ${slug} has no canonical manifest.`)
      continue
    }
    if (!hasCustomerOwnedCredentialBoundary(manifest)) {
      errors.push(
        `Connect-eligible provider ${slug} has no customer-owned credential connection.`,
      )
    }
    if (credentialNames(manifest).length === 0) {
      errors.push(`Connect-eligible provider ${slug} has no credential declaration.`)
    }
    if (executableActionIds(manifest).length === 0) {
      errors.push(`Connect-eligible provider ${slug} has no executable action declaration.`)
    }
    if (
      !(manifest.runtimeSupport ?? []).some(
        ({ installSupport }) => installSupport !== "unsupported",
      )
    ) {
      errors.push(`Connect-eligible provider ${slug} has no installable runtime.`)
    }
    if (!connectorSlugs.has(slug)) {
      errors.push(`Connect-eligible provider ${slug} has no backend connector manifest.`)
    }
  }

  for (const slug of input.nativeAdapterSlugs) {
    if (!manifestBySlug.has(slug)) {
      errors.push(`Native connection adapter ${slug} has no canonical manifest.`)
    }
  }

  const atlasSlugs = Object.keys(input.atlasIndex?.apps ?? {}).sort()
  if (!sameValues(atlasSlugs, connectEligibleSlugs)) {
    errors.push("Packaged icon atlas membership differs from the launch cohort.")
  }
  if (
    input.atlasIndex?.appCount !== 406 ||
    input.atlasIndex?.cohortManifestVersion !== input.releaseManifest?.manifestVersion
  ) {
    errors.push("Packaged icon atlas release metadata is stale.")
  }
  for (const copy of input.assetCopies) {
    if (!copy.matchesCanonical) {
      errors.push(`Packaged Marketplace asset is stale: ${copy.path}`)
    }
  }

  if (!input.backendCatalogSource.includes("GENERATED_MARKETPLACE_PROVIDER_IDENTITIES")) {
    errors.push("Railway catalog does not consume generated typed provider identities.")
  }
  for (const field of [
    '"authentication"',
    '"connection"',
    '"capabilities"',
    '"runtimeSupport"',
    '"availability"',
  ]) {
    if (!input.swiftCatalogSource.includes(field)) {
      errors.push(`Swift catalog mapping does not consume ${field}.`)
    }
  }
  if (
    input.webSources.some((source) =>
      /FALLBACK_MARKETPLACE_CATALOG|MARKETPLACE_LOGOS|marketplace-fallback/.test(source),
    )
  ) {
    errors.push("Web production sources still reference the handwritten Marketplace fallback.")
  }
  if (!input.webSources.some((source) => source.includes("sdk.marketplace.catalogPage"))) {
    errors.push("Web production sources do not load Marketplace membership from Railway.")
  }

  return {
    valid: errors.length === 0,
    errors,
    summary: {
      manifestCount: manifests.length,
      sourceSHA256,
      connectEligibleCount: connectEligibleSlugs.length,
      backendConnectorCount: sortedUnique(input.backendConnectorSlugs).length,
      nativeAdapterCount: sortedUnique(input.nativeAdapterSlugs).length,
      packagedAssetCount: atlasSlugs.length,
    },
  }
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, "utf8"))
}

function matchingAssetCopies(canonicalPath, paths) {
  const canonical = readFileSync(canonicalPath)
  return paths.map((path) => ({
    path: path.slice(ROOT.length + 1),
    matchesCanonical:
      existsSync(path) &&
      statSync(path).isFile() &&
      readFileSync(path).equals(canonical),
  }))
}

function main() {
  const backendCatalogPath = resolve(
    ROOT,
    "backend/src/modules/marketplace/catalog/generated-provider-catalog.json",
  )
  const swiftCatalogPath = resolve(
    ROOT,
    "RelayConsoleSwift/Sources/RelayConsoleCore/Resources/marketplace-provider-catalog.json",
  )
  const typedSource = readFileSync(
    resolve(
      ROOT,
      "backend/src/modules/marketplace/catalog/generated-provider-identities.ts",
    ),
    "utf8",
  )
  const typedSourceSHA256 =
    typedSource.match(
      /GENERATED_MARKETPLACE_PROVIDER_SOURCE_SHA256 = "([a-f0-9]{64})"/,
    )?.[1] ?? ""
  const adapterSource = readFileSync(
    resolve(
      ROOT,
      "RelayConsoleSwift/Sources/RelayConsoleCore/ProviderConnectionAdapterRegistry.swift",
    ),
    "utf8",
  )
  const canonicalAtlas = resolve(
    ROOT,
    "packages/marketplace-catalog/release/marketplace-icon-atlas.png",
  )
  const canonicalAtlasIndex = resolve(
    ROOT,
    "packages/marketplace-catalog/release/marketplace-icon-atlas-index.json",
  )
  const result = validateMarketplaceSemanticParity({
    backendCatalog: readJSON(backendCatalogPath),
    swiftCatalog: readJSON(swiftCatalogPath),
    typedSourceSHA256,
    releaseManifest: readJSON(
      resolve(
        ROOT,
        "packages/marketplace-catalog/release/marketplace-release-manifest.json",
      ),
    ),
    backendConnectorSlugs: connectorSlugsUnder(
      resolve(ROOT, "backend/src/modules/marketplace/connectors"),
    ),
    nativeAdapterSlugs: providerSlugsFromAdapterSource(adapterSource),
    atlasIndex: readJSON(canonicalAtlasIndex),
    assetCopies: [
      ...matchingAssetCopies(canonicalAtlas, [
        resolve(ROOT, "web/public/marketplace/marketplace-icon-atlas.png"),
        resolve(
          ROOT,
          "RelayConsoleSwift/Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-icon-atlas.png",
        ),
        resolve(
          ROOT,
          "ios/ClawChat/Assets.xcassets/MarketplaceIconAtlas.imageset/marketplace-icon-atlas.png",
        ),
      ]),
      ...matchingAssetCopies(canonicalAtlasIndex, [
        resolve(ROOT, "web/lib/marketplace-icon-atlas-index.json"),
        resolve(
          ROOT,
          "RelayConsoleSwift/Sources/RelayConsoleApp/Resources/Assets/marketplace-logos/marketplace-icon-atlas-index.json",
        ),
        resolve(
          ROOT,
          "ios/ClawChat/Assets.xcassets/MarketplaceIconAtlasIndex.dataset/marketplace-icon-atlas-index.json",
        ),
      ]),
    ],
    backendCatalogSource: readFileSync(
      resolve(
        ROOT,
        "backend/src/modules/marketplace/catalog/generated-marketplace-catalog.ts",
      ),
      "utf8",
    ),
    swiftCatalogSource: [
      "RelayConsoleSwift/Sources/RelayConsoleCore/ApplicationsService.swift",
      "RelayConsoleSwift/Sources/RelayConsoleCore/MarketplaceCatalogRecordMapper.swift",
    ].map((path) => readFileSync(resolve(ROOT, path), "utf8")).join("\n"),
    webSources: [
      "web/features/marketplace/use-marketplace-catalog-data.ts",
      "web/components/app-shell/use-relay-console-controller.tsx",
      "web/components/marketplace/app-logo.tsx",
      "web/components/shared/agent-app-badge-strip.tsx",
    ].map((path) => readFileSync(resolve(ROOT, path), "utf8")),
  })

  console.log(JSON.stringify(result.summary, null, 2))
  for (const error of result.errors) console.error(`ERROR: ${error}`)
  if (!result.valid) process.exitCode = 1
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) main()
