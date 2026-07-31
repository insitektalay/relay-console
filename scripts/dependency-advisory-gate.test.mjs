import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  collectPackageVersions,
  evaluateAdvisories,
  packageIdentityFromPnpmPath,
  parsePnpmPackagePaths,
  queryBulkAdvisories,
  validateBulkResponse,
  verifyRemediatedAdvisories,
} from "./dependency-advisory-gate.mjs"

const nestAdvisory = {
  id: 1117063,
  name: "@nestjs/core",
  url: "https://github.com/advisories/GHSA-36xv-jgw5-4q75",
  title: "Nest SSE injection",
  severity: "moderate",
  vulnerable_versions: "<=11.1.17",
}

const nestException = {
  package: "@nestjs/core",
  ghsa: "GHSA-36xv-jgw5-4q75",
  cve: "CVE-2026-35515",
  expiresOn: "2026-10-15",
  reason:
    "The backend exposes no affected inbound Nest SSE surface and a source regression enforces that boundary until the major upgrade.",
}

const nestRemediation = {
  package: "@nestjs/core",
  version: "10.4.22",
  ghsa: "GHSA-36xv-jgw5-4q75",
  cve: "CVE-2026-35515",
  patchPath: "backend/patches/@nestjs__core@10.4.22.patch",
  patchSha256:
    "7fc4893ed08a7268144c2a98042c1f024f390f6e92f7e5b1b4f339c8b84b83d0",
  manifestPath: "backend/package.json",
  manifestPatchPath: "patches/@nestjs__core@10.4.22.patch",
  lockfilePath: "backend/pnpm-lock.yaml",
  lockfilePatchPath: "patches/@nestjs__core@10.4.22.patch",
  upstreamReference: "https://github.com/nestjs/nest/commit/83558ae",
  reason:
    "Exact backport of Nest's published SSE field sanitization fix; the standalone Railway manifest and frozen lock attest the patch digest.",
}

test("parseable pnpm inventory keeps only installed registry package paths", () => {
  assert.deepEqual(
    parsePnpmPackagePaths(
      [
        "/repo/web",
        "/repo/packages/contracts",
        "/repo/node_modules/.pnpm/react@19.2.7/node_modules/react",
        "/repo/node_modules/.pnpm/react@19.2.7/node_modules/react",
        "/repo/node_modules/.pnpm/next@16.2.6/node_modules/next",
      ].join("\n"),
    ),
    [
      "/repo/node_modules/.pnpm/next@16.2.6/node_modules/next",
      "/repo/node_modules/.pnpm/react@19.2.7/node_modules/react",
    ],
  )
})

test("parseable pnpm inventory safely resolves a standalone relative virtual store", () => {
  assert.deepEqual(
    parsePnpmPackagePaths(
      [
        "/repo/landing",
        ".pnpm/react@19.2.7/node_modules/react",
        ".pnpm/@scope+package@1.2.3/node_modules/@scope/package",
      ].join("\n"),
      "/repo/landing",
    ),
    [
      "/repo/landing/node_modules/.pnpm/@scope+package@1.2.3/node_modules/@scope/package",
      "/repo/landing/node_modules/.pnpm/react@19.2.7/node_modules/react",
    ],
  )

  assert.throws(
    () =>
      parsePnpmPackagePaths(
        ".pnpm/../../outside/node_modules/package",
        "/repo/landing",
      ),
    /malformed/,
  )
  assert.throws(
    () => parsePnpmPackagePaths(".pnpm/react@19.2.7/node_modules/react"),
    /requires an audited package directory/,
  )
})

test("installed package metadata becomes a sorted exact-version payload", async () => {
  const packages = new Map([
    ["/repo/node_modules/.pnpm/example@2.0.0/node_modules/example/package.json", { name: "example", version: "2.0.0" }],
    ["/repo/node_modules/.pnpm/example@1.0.0/node_modules/example/package.json", { name: "example", version: "1.0.0" }],
    ["/repo/node_modules/.pnpm/another@3.0.0/node_modules/another/package.json", { name: "another", version: "3.0.0" }],
  ])
  const payload = await collectPackageVersions(
    [
      "/repo/node_modules/.pnpm/example@2.0.0/node_modules/example",
      "/repo/node_modules/.pnpm/example@1.0.0/node_modules/example",
      "/repo/node_modules/.pnpm/another@3.0.0/node_modules/another",
    ],
    async (path) => JSON.stringify(packages.get(path)),
  )

  assert.deepEqual(payload, {
    another: ["3.0.0"],
    example: ["1.0.0", "2.0.0"],
  })
})

test("pnpm paths preserve absent cross-platform optional packages", async () => {
  const optionalPath =
    "/repo/node_modules/.pnpm/@vendor+native-linux-x64@3.0.3/node_modules/@vendor/native-linux-x64"
  assert.deepEqual(packageIdentityFromPnpmPath(optionalPath), {
    name: "@vendor/native-linux-x64",
    version: "3.0.3",
  })

  const payload = await collectPackageVersions([optionalPath], async () => {
    throw Object.assign(new Error("not installed on this platform"), { code: "ENOENT" })
  })
  assert.deepEqual(payload, { "@vendor/native-linux-x64": ["3.0.3"] })
})

test("bulk response validation rejects malformed advisory data", () => {
  assert.deepEqual(validateBulkResponse({ "@nestjs/core": [nestAdvisory] }), [
    { ...nestAdvisory, packageName: "@nestjs/core" },
  ])
  assert.throws(
    () =>
      validateBulkResponse({
        "@nestjs/core": [{ ...nestAdvisory, severity: "urgent" }],
      }),
    /malformed/,
  )
  const registryShape = { ...nestAdvisory }
  delete registryShape.name
  assert.equal(
    validateBulkResponse({ "@nestjs/core": [registryShape] })[0].name,
    "@nestjs/core",
  )
})

test("a temporary exception remains bounded, expiring, and non-stale", () => {
  const advisories = validateBulkResponse({ "@nestjs/core": [nestAdvisory] })
  const accepted = evaluateAdvisories({
    advisories,
    ignoredAdvisories: [nestException],
    threshold: "moderate",
    now: new Date("2026-07-15T12:00:00Z"),
  })
  assert.equal(accepted.failures.length, 0)
  assert.equal(accepted.suppressed.length, 1)

  const expired = evaluateAdvisories({
    advisories,
    ignoredAdvisories: [nestException],
    threshold: "moderate",
    now: new Date("2026-10-16T00:00:00Z"),
  })
  assert.match(expired.failures[0].reason, /expired/)

  const stale = evaluateAdvisories({
    advisories: [],
    ignoredAdvisories: [nestException],
    threshold: "moderate",
    now: new Date("2026-07-15T12:00:00Z"),
  })
  assert.match(stale.failures[0].reason, /stale exception/)

  const wrongPackage = evaluateAdvisories({
    advisories: advisories.map((advisory) => ({
      ...advisory,
      name: "another-package",
      packageName: "another-package",
    })),
    ignoredAdvisories: [nestException],
    threshold: "moderate",
    now: new Date("2026-07-15T12:00:00Z"),
  })
  assert.equal(wrongPackage.suppressed.length, 0)
  assert.match(wrongPackage.failures[0].reason, /severity threshold/)
})

test("an exact patch remediation satisfies only its installed version and advisory", () => {
  const advisories = validateBulkResponse({ "@nestjs/core": [nestAdvisory] }).map(
    (advisory) => ({
      ...advisory,
      installedVersions: ["10.4.22"],
    }),
  )
  const fixed = evaluateAdvisories({
    advisories,
    ignoredAdvisories: [],
    remediatedAdvisories: [nestRemediation],
    threshold: "low",
  })
  assert.equal(fixed.failures.length, 0)
  assert.equal(fixed.fixed.length, 1)
  assert.equal(fixed.suppressed.length, 0)

  const wrongVersion = evaluateAdvisories({
    advisories: advisories.map((advisory) => ({
      ...advisory,
      installedVersions: ["10.4.21"],
    })),
    ignoredAdvisories: [],
    remediatedAdvisories: [nestRemediation],
    threshold: "low",
  })
  assert.match(wrongVersion.failures[0].reason, /not the installed version/)

  const stale = evaluateAdvisories({
    advisories: [],
    ignoredAdvisories: [],
    remediatedAdvisories: [nestRemediation],
    threshold: "low",
  })
  assert.match(stale.failures[0].reason, /stale remediation/)
})

test("the committed Nest remediation matches its manifest, lock, and patch digest", async () => {
  const [verified] = await verifyRemediatedAdvisories([nestRemediation])
  assert.equal(verified.patchSha256, nestRemediation.patchSha256)

  await assert.rejects(
    verifyRemediatedAdvisories([
      {
        ...nestRemediation,
        patchSha256: "0".repeat(64),
      },
    ]),
    /digest mismatch/,
  )
})

test("every committed remediation in the production policy has intact patch attestations", async () => {
  const policy = JSON.parse(
    await readFile(
      new URL("./dependency-advisory-policy.json", import.meta.url),
      "utf8",
    ),
  )

  for (const [surfaceName, surface] of Object.entries(policy.surfaces)) {
    const remediations = surface.remediatedAdvisories ?? []
    const verified = await verifyRemediatedAdvisories(remediations)
    assert.equal(
      verified.length,
      remediations.length,
      `${surfaceName} remediation count`,
    )
  }
})

test("bulk advisory transport fails closed on the retired or unavailable endpoint", async () => {
  await assert.rejects(
    queryBulkAdvisories({
      registry: "https://registry.npmjs.org",
      payload: { react: ["19.2.7"] },
      fetchImpl: async () =>
        new Response("gone", {
          status: 410,
          headers: { "content-type": "application/json" },
        }),
    }),
    /HTTP 410/,
  )
})
