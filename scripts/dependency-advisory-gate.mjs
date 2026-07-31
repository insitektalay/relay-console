#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, resolve, sep } from "node:path"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

const execFile = promisify(execFileCallback)
const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(scriptPath), "..")
const policyPath = resolve(dirname(scriptPath), "dependency-advisory-policy.json")
const BULK_PATH = "/-/npm/v1/security/advisories/bulk"
const MAX_LIST_BYTES = 16 * 1024 * 1024
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 20_000
const GHSA_PATTERN = /\bGHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}\b/i
const severityRank = Object.freeze({
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
})

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

export function parsePnpmPackagePaths(output, packageDirectory) {
  if (typeof output !== "string") {
    throw new Error("pnpm package inventory must be text")
  }

  const paths = [
    ...new Set(
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .flatMap((line) => {
          if (/[/\\]node_modules[/\\]\.pnpm[/\\]/.test(line)) {
            return [line]
          }
          if (!line.startsWith(".pnpm/") && !line.startsWith(".pnpm\\")) {
            return []
          }
          if (typeof packageDirectory !== "string") {
            throw new Error(
              "relative pnpm package inventory requires an audited package directory",
            )
          }
          const segments = line.split(/[/\\]/)
          if (
            segments[0] !== ".pnpm" ||
            segments.some(
              (segment) =>
                segment.length === 0 || segment === "." || segment === "..",
            )
          ) {
            throw new Error("relative pnpm package inventory is malformed")
          }
          return [resolve(packageDirectory, "node_modules", ...segments)]
        }),
    ),
  ].sort()

  if (paths.length === 0) {
    throw new Error("pnpm returned no installed production packages")
  }
  return paths
}

export function packageIdentityFromPnpmPath(packagePath) {
  const normalized = packagePath.replaceAll("\\", "/")
  const marker = "/node_modules/.pnpm/"
  const markerIndex = normalized.indexOf(marker)
  if (markerIndex < 0) {
    throw new Error("installed package path is outside the pnpm virtual store")
  }

  const storeStart = markerIndex + marker.length
  const storeEnd = normalized.indexOf("/node_modules/", storeStart)
  if (storeEnd < 0) {
    throw new Error("installed package path has no pnpm package boundary")
  }
  const storeEntry = normalized.slice(storeStart, storeEnd)
  const name = normalized.slice(storeEnd + "/node_modules/".length)
  if (!name || name.includes("/node_modules/")) {
    throw new Error("installed package path has an invalid package name")
  }

  const encodedName = name.replace("/", "+")
  const versionPrefix = `${encodedName}@`
  if (!storeEntry.startsWith(versionPrefix)) {
    throw new Error("installed package path does not match its pnpm store entry")
  }
  const version = storeEntry.slice(versionPrefix.length).split("_", 1)[0]
  if (!version) {
    throw new Error("installed package path has no package version")
  }
  return { name, version }
}

export async function collectPackageVersions(paths, readPackage = readFile) {
  const versions = new Map()

  for (const packagePath of paths) {
    const pathIdentity = packageIdentityFromPnpmPath(packagePath)
    let packageJson
    try {
      packageJson = JSON.parse(
        await readPackage(resolve(packagePath, "package.json"), "utf8"),
      )
    } catch (error) {
      if (error?.code === "ENOENT") {
        packageJson = pathIdentity
      } else {
        throw new Error(
          `cannot read installed package metadata: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    const name = packageJson?.name
    const version = packageJson?.version
    if (
      typeof name !== "string" ||
      name.length === 0 ||
      name.length > 214 ||
      typeof version !== "string" ||
      version.length === 0 ||
      version.length > 128
    ) {
      throw new Error("installed production package has invalid name or version metadata")
    }
    if (name !== pathIdentity.name || version !== pathIdentity.version) {
      throw new Error("installed package metadata does not match its pnpm store path")
    }

    const packageVersions = versions.get(name) ?? new Set()
    packageVersions.add(version)
    versions.set(name, packageVersions)
  }

  return Object.fromEntries(
    [...versions.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, packageVersions]) => [name, [...packageVersions].sort()]),
  )
}

export function validateBulkResponse(value) {
  const response = assertPlainObject(value, "bulk advisory response")
  const advisories = []

  for (const [packageName, packageAdvisories] of Object.entries(response)) {
    if (!Array.isArray(packageAdvisories)) {
      throw new Error(`bulk advisory response for ${packageName} must be an array`)
    }

    for (const candidate of packageAdvisories) {
      const advisory = assertPlainObject(candidate, `advisory for ${packageName}`)
      if (
        (advisory.name !== undefined && advisory.name !== packageName) ||
        (typeof advisory.id !== "number" && typeof advisory.id !== "string") ||
        typeof advisory.url !== "string" ||
        !advisory.url.startsWith("https://") ||
        typeof advisory.title !== "string" ||
        advisory.title.length === 0 ||
        typeof advisory.vulnerable_versions !== "string" ||
        !Object.hasOwn(severityRank, advisory.severity)
      ) {
        throw new Error(`bulk advisory response for ${packageName} is malformed`)
      }
      advisories.push({ ...advisory, name: packageName, packageName })
    }
  }

  return advisories
}

function advisoryGhsa(advisory) {
  const match = advisory.url.match(GHSA_PATTERN)?.[0]
  return match ? `GHSA-${match.slice(5).toLowerCase()}` : null
}

function validateIgnoredAdvisory(candidate) {
  const ignored = assertPlainObject(candidate, "ignored advisory")
  if (
    typeof ignored.package !== "string" ||
    ignored.package.length === 0 ||
    ignored.package.length > 214 ||
    typeof ignored.ghsa !== "string" ||
    advisoryGhsa({ url: ignored.ghsa }) !== ignored.ghsa ||
    typeof ignored.cve !== "string" ||
    !/^CVE-\d{4}-\d{4,}$/.test(ignored.cve) ||
    typeof ignored.expiresOn !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(ignored.expiresOn) ||
    typeof ignored.reason !== "string" ||
    ignored.reason.length < 80
  ) {
    throw new Error("ignored advisory policy is malformed")
  }
  return ignored
}

function validateRemediatedAdvisory(candidate) {
  const remediation = assertPlainObject(candidate, "remediated advisory")
  if (
    typeof remediation.package !== "string" ||
    remediation.package.length === 0 ||
    remediation.package.length > 214 ||
    typeof remediation.version !== "string" ||
    remediation.version.length === 0 ||
    remediation.version.length > 128 ||
    typeof remediation.ghsa !== "string" ||
    advisoryGhsa({ url: remediation.ghsa }) !== remediation.ghsa ||
    typeof remediation.cve !== "string" ||
    !/^CVE-\d{4}-\d{4,}$/.test(remediation.cve) ||
    typeof remediation.patchPath !== "string" ||
    remediation.patchPath.length === 0 ||
    typeof remediation.patchSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(remediation.patchSha256) ||
    typeof remediation.manifestPath !== "string" ||
    remediation.manifestPath.length === 0 ||
    typeof remediation.manifestPatchPath !== "string" ||
    remediation.manifestPatchPath.length === 0 ||
    typeof remediation.lockfilePath !== "string" ||
    remediation.lockfilePath.length === 0 ||
    typeof remediation.lockfilePatchPath !== "string" ||
    remediation.lockfilePatchPath.length === 0 ||
    typeof remediation.upstreamReference !== "string" ||
    !remediation.upstreamReference.startsWith("https://github.com/") ||
    typeof remediation.reason !== "string" ||
    remediation.reason.length < 80
  ) {
    throw new Error("remediated advisory policy is malformed")
  }
  return remediation
}

function resolveRepositoryPath(relativePath, label) {
  const path = resolve(repoRoot, relativePath)
  if (path !== repoRoot && !path.startsWith(`${repoRoot}${sep}`)) {
    throw new Error(`${label} escapes the repository`)
  }
  return path
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function verifyRemediatedAdvisories(remediations) {
  const verified = []
  for (const candidate of remediations) {
    const remediation = validateRemediatedAdvisory(candidate)
    const patch = await readFile(
      resolveRepositoryPath(remediation.patchPath, "advisory patch"),
    )
    const actualSha256 = createHash("sha256").update(patch).digest("hex")
    if (actualSha256 !== remediation.patchSha256) {
      throw new Error(
        `advisory patch digest mismatch for ${remediation.package} ${remediation.ghsa}`,
      )
    }

    const manifest = assertPlainObject(
      JSON.parse(
        await readFile(
          resolveRepositoryPath(
            remediation.manifestPath,
            "advisory patch manifest",
          ),
          "utf8",
        ),
      ),
      "advisory patch manifest",
    )
    const dependencyKey = `${remediation.package}@${remediation.version}`
    if (
      manifest.pnpm?.patchedDependencies?.[dependencyKey] !==
      remediation.manifestPatchPath
    ) {
      throw new Error(
        `package manifest does not attest advisory patch ${dependencyKey}`,
      )
    }

    const lockfile = await readFile(
      resolveRepositoryPath(remediation.lockfilePath, "advisory patch lockfile"),
      "utf8",
    )
    const patchedSection = lockfile.match(
      /\npatchedDependencies:\n([\s\S]*?)\n\nimporters:\n/,
    )?.[1]
    const key = escapeRegularExpression(dependencyKey)
    const hash = escapeRegularExpression(remediation.patchSha256)
    const patchPath = escapeRegularExpression(remediation.lockfilePatchPath)
    const attestationPattern = new RegExp(
      `^  (?:'${key}'|"${key}"|${key}):\\n    hash: ${hash}\\n    path: ${patchPath}$`,
      "m",
    )
    if (!patchedSection || !attestationPattern.test(patchedSection)) {
      throw new Error(
        `lockfile does not attest advisory patch ${dependencyKey}`,
      )
    }
    verified.push(remediation)
  }
  return verified
}

export function evaluateAdvisories({
  advisories,
  ignoredAdvisories,
  remediatedAdvisories = [],
  threshold,
  now = new Date(),
}) {
  if (!Object.hasOwn(severityRank, threshold)) {
    throw new Error(`unsupported advisory threshold: ${threshold}`)
  }

  const ignored = ignoredAdvisories.map(validateIgnoredAdvisory)
  const exceptionKey = (packageName, ghsa) => `${packageName}\0${ghsa}`
  const ignoredByKey = new Map(
    ignored.map((entry) => [exceptionKey(entry.package, entry.ghsa), entry]),
  )
  if (ignoredByKey.size !== ignored.length) {
    throw new Error("ignored advisory policy contains a duplicate exception")
  }
  const matchedIgnores = new Set()
  const remediated = remediatedAdvisories.map(validateRemediatedAdvisory)
  const remediationByKey = new Map(
    remediated.map((entry) => [
      exceptionKey(entry.package, entry.ghsa),
      entry,
    ]),
  )
  if (remediationByKey.size !== remediated.length) {
    throw new Error("remediated advisory policy contains a duplicate entry")
  }
  const matchedRemediations = new Set()
  const failures = []
  const suppressed = []
  const fixed = []

  for (const advisory of advisories) {
    if (severityRank[advisory.severity] < severityRank[threshold]) continue

    const ghsa = advisoryGhsa(advisory)
    const remediation = ghsa
      ? remediationByKey.get(exceptionKey(advisory.packageName, ghsa))
      : undefined
    if (remediation) {
      const installedVersions = advisory.installedVersions ?? []
      if (
        installedVersions.length > 0 &&
        !installedVersions.includes(remediation.version)
      ) {
        failures.push({
          advisory,
          reason: `attested patch targets ${remediation.version}, not the installed version`,
        })
        continue
      }
      matchedRemediations.add(
        exceptionKey(remediation.package, remediation.ghsa),
      )
      fixed.push({ advisory, remediation })
      continue
    }
    const exception = ghsa
      ? ignoredByKey.get(exceptionKey(advisory.packageName, ghsa))
      : undefined
    if (!exception) {
      failures.push({ advisory, reason: "meets or exceeds the severity threshold" })
      continue
    }

    matchedIgnores.add(exceptionKey(exception.package, exception.ghsa))
    const expiry = new Date(`${exception.expiresOn}T23:59:59.999Z`)
    if (Number.isNaN(expiry.getTime()) || now > expiry) {
      failures.push({ advisory, reason: `exception expired on ${exception.expiresOn}` })
      continue
    }
    suppressed.push({ advisory, exception })
  }

  for (const exception of ignored) {
    if (!matchedIgnores.has(exceptionKey(exception.package, exception.ghsa))) {
      failures.push({
        advisory: null,
        reason: `stale exception ${exception.package} ${exception.ghsa} did not match the registry response`,
      })
    }
  }

  for (const remediation of remediated) {
    if (
      !matchedRemediations.has(
        exceptionKey(remediation.package, remediation.ghsa),
      )
    ) {
      failures.push({
        advisory: null,
        reason: `stale remediation ${remediation.package} ${remediation.ghsa} did not match the registry response`,
      })
    }
  }

  return { failures, suppressed, fixed }
}

async function loadPolicy() {
  const policy = assertPlainObject(
    JSON.parse(await readFile(policyPath, "utf8")),
    "dependency advisory policy",
  )
  if (
    policy.schemaVersion !== 2 ||
    typeof policy.registry !== "string" ||
    !policy.registry.startsWith("https://") ||
    !Object.hasOwn(severityRank, policy.threshold)
  ) {
    throw new Error("dependency advisory policy header is malformed")
  }
  assertPlainObject(policy.surfaces, "dependency advisory surfaces")
  return policy
}

async function installedProductionPayload(directory) {
  let stdout
  try {
    ;({ stdout } = await execFile(
      "pnpm",
      ["--dir", directory, "list", "--prod", "--depth", "Infinity", "--parseable"],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: MAX_LIST_BYTES },
    ))
  } catch (error) {
    throw new Error(
      `cannot inventory installed production dependencies: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  return collectPackageVersions(parsePnpmPackagePaths(stdout, directory))
}

export async function queryBulkAdvisories({
  registry,
  payload,
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  let response
  try {
    response = await fetchImpl(new URL(BULK_PATH, registry), {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "relay-console-dependency-advisory-gate/1",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (error) {
    throw new Error(
      `bulk advisory request failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new Error(`bulk advisory endpoint returned HTTP ${response.status}`)
  }
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("bulk advisory response exceeds the size limit")
  }

  const body = await response.text()
  if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) {
    throw new Error("bulk advisory response exceeds the size limit")
  }

  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error("bulk advisory endpoint returned invalid JSON")
  }
  return validateBulkResponse(parsed)
}

export async function runDependencyAdvisoryGate(surfaceName) {
  const policy = await loadPolicy()
  const surface = assertPlainObject(
    policy.surfaces[surfaceName],
    `dependency advisory surface ${surfaceName}`,
  )
  if (
    typeof surface.directory !== "string" ||
    !Array.isArray(surface.ignoredAdvisories) ||
    !Array.isArray(surface.remediatedAdvisories)
  ) {
    throw new Error(`dependency advisory surface ${surfaceName} is malformed`)
  }

  const directory = resolve(repoRoot, surface.directory)
  if (directory !== repoRoot && !directory.startsWith(`${repoRoot}${sep}`)) {
    throw new Error(`dependency advisory surface ${surfaceName} escapes the repository`)
  }
  const payload = await installedProductionPayload(directory)
  const verifiedRemediations = await verifyRemediatedAdvisories(
    surface.remediatedAdvisories,
  )
  const advisories = await queryBulkAdvisories({
    registry: policy.registry,
    payload,
  })
  const result = evaluateAdvisories({
    advisories: advisories.map((advisory) => ({
      ...advisory,
      installedVersions: payload[advisory.packageName] ?? [],
    })),
    ignoredAdvisories: surface.ignoredAdvisories,
    remediatedAdvisories: verifiedRemediations,
    threshold: policy.threshold,
  })

  if (result.failures.length > 0) {
    const details = result.failures.map(({ advisory, reason }) =>
      advisory
        ? `${advisory.packageName}: ${advisory.severity} ${advisoryGhsa(advisory) ?? advisory.id} (${reason})`
        : reason,
    )
    throw new Error(
      `dependency advisory gate failed for ${surfaceName}:\n- ${details.join("\n- ")}`,
    )
  }

  const packageVersions = Object.values(payload).reduce(
    (count, versions) => count + versions.length,
    0,
  )
  console.log(
    `Dependency advisory gate passed for ${surfaceName}: ${packageVersions} installed production package versions, ${advisories.length} registry advisories, ${result.fixed.length} integrity-attested backports, ${result.suppressed.length} documented exceptions.`,
  )
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const surfaceName = process.argv[2]
  if (!surfaceName) {
    console.error("Usage: dependency-advisory-gate.mjs <backend|web|landing>")
    process.exitCode = 2
  } else {
    runDependencyAdvisoryGate(surfaceName).catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
  }
}
