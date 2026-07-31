import assert from "node:assert/strict"
import React from "react"
import test from "node:test"
import DownloadPage from "../../Relay Console landing page/app/download/page"
import InstallPage from "../../Relay Console landing page/app/install/page"
import KnownIssuesPage from "../../Relay Console landing page/app/known-issues/page"
import ReleaseNotesPage from "../../Relay Console landing page/app/release-notes/page"
import { GET } from "../app/updates/public-beta.json/route"
import {
  buildMacOSUpdateManifest,
  MACOS_UPDATE_MANIFEST_ENV,
} from "../lib/macos-update-manifest"

const sha = "a".repeat(64)
const previousDistribution = "b".repeat(64)

;(globalThis as typeof globalThis & { React: typeof React }).React = React

function manifest(previous: Record<string, unknown> | null = null) {
  return {
    schemaVersion: "relay.macos-update-manifest.v1",
    channel: "public-beta",
    generatedAt: "2026-07-15T12:05:00.000Z",
    manualUpdate: true,
    current: {
      version: "0.1.0",
      build: "1",
      fileName: "RelayConsole-0.1.0.dmg",
      url: "https://relayconsole.work/downloads/RelayConsole-0.1.0.dmg",
      checksumURL:
        "https://relayconsole.work/downloads/RelayConsole-0.1.0.dmg.sha256",
      sha256: sha,
      sizeBytes: 12_345,
      publishedAt: "2026-07-15T12:00:00.000Z",
      architectures: ["arm64"],
      signatureMode: "developer-id-hardened-runtime",
      notarizationStatus: "accepted-stapled",
      distributionEvidenceSHA256: "c".repeat(64),
    },
    previous,
    previousDMGMinimumRetentionDays: 30,
    downloadPageURL: "https://relayconsole.work/download",
    releaseNotesURL: "https://relayconsole.work/release-notes",
    supportURL: "https://relayconsole.work/support",
    rollbackPolicyURL: "https://relayconsole.work/updates",
  }
}

function environment(value: unknown) {
  return { [MACOS_UPDATE_MANIFEST_ENV]: JSON.stringify(value) }
}

function releasedVercelEnvironment(value: unknown) {
  return {
    ...environment(value),
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_GIT_PROVIDER: "github",
    VERCEL_GIT_REPO_OWNER: "insitektalay",
    VERCEL_GIT_REPO_SLUG: "clawchat",
    VERCEL_GIT_COMMIT_SHA: "c".repeat(40),
    VERCEL_GIT_COMMIT_REF: "release/public-beta-0.1.0",
    VERCEL_DEPLOYMENT_ID: "dpl_PublicBeta100",
    VERCEL_URL: "relay-console-public-beta.vercel.app",
  }
}

function renderedText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number")
    return String(value)
  if (Array.isArray(value)) return value.map(renderedText).join(" ")
  if (value && typeof value === "object" && "props" in value) {
    const props = (value as { props?: Record<string, unknown> }).props ?? {}
    return [
      props.title,
      props.description,
      props.eyebrow,
      props.updatedLabel,
      props.children,
    ]
      .map(renderedText)
      .join(" ")
  }
  return ""
}

test("accepts an exact first-release manifest", () => {
  assert.deepEqual(
    buildMacOSUpdateManifest(environment(manifest())),
    manifest()
  )
})

test("accepts a retained previous release", () => {
  const previous = {
    version: "0.0.9",
    build: "9",
    fileName: "RelayConsole-0.0.9.dmg",
    url: "https://relayconsole.work/downloads/RelayConsole-0.0.9.dmg",
    checksumURL:
      "https://relayconsole.work/downloads/RelayConsole-0.0.9.dmg.sha256",
    sha256: "d".repeat(64),
    sizeBytes: 11_111,
    publishedAt: "2026-06-15T12:00:00.000Z",
    architectures: ["arm64"],
    signatureMode: "developer-id-hardened-runtime",
    notarizationStatus: "accepted-stapled",
    retainedUntil: "2026-08-14T12:00:00.000Z",
    distributionEvidenceSHA256: previousDistribution,
  }
  assert.deepEqual(
    buildMacOSUpdateManifest(environment(manifest(previous))),
    manifest(previous)
  )
})

test("rejects malformed, incomplete, oversized, and unsupported input", () => {
  assert.equal(buildMacOSUpdateManifest({}), null)
  assert.equal(
    buildMacOSUpdateManifest({ [MACOS_UPDATE_MANIFEST_ENV]: "{" }),
    null
  )
  assert.equal(
    buildMacOSUpdateManifest({
      [MACOS_UPDATE_MANIFEST_ENV]: "x".repeat(16_385),
    }),
    null
  )
  assert.equal(
    buildMacOSUpdateManifest(environment({ ...manifest(), unsupported: true })),
    null
  )
})

test("rejects substituted hosts, files, checksums, timestamps, and retention", () => {
  const wrongHost = structuredClone(manifest())
  wrongHost.current.url = "https://example.com/RelayConsole-0.1.0.dmg"
  assert.equal(buildMacOSUpdateManifest(environment(wrongHost)), null)

  const wrongFile = structuredClone(manifest())
  wrongFile.current.fileName = "Different.dmg"
  assert.equal(buildMacOSUpdateManifest(environment(wrongFile)), null)

  const sameChecksum = structuredClone(manifest())
  sameChecksum.current.checksumURL = sameChecksum.current.url
  assert.equal(buildMacOSUpdateManifest(environment(sameChecksum)), null)

  const wrongChecksum = structuredClone(manifest())
  wrongChecksum.current.checksumURL =
    "https://relayconsole.work/downloads/checksum.txt"
  assert.equal(buildMacOSUpdateManifest(environment(wrongChecksum)), null)

  const malformedEncoding = structuredClone(manifest())
  malformedEncoding.current.fileName = "%E0.dmg"
  malformedEncoding.current.url = "https://relayconsole.work/downloads/%E0.dmg"
  malformedEncoding.current.checksumURL =
    "https://relayconsole.work/downloads/%E0.dmg.sha256"
  assert.doesNotThrow(() =>
    buildMacOSUpdateManifest(environment(malformedEncoding))
  )
  assert.equal(buildMacOSUpdateManifest(environment(malformedEncoding)), null)

  const oldGeneration = structuredClone(manifest())
  oldGeneration.generatedAt = "2026-07-15T11:00:00.000Z"
  assert.equal(buildMacOSUpdateManifest(environment(oldGeneration)), null)

  const shortRetention = manifest({
    version: "0.0.9",
    build: "9",
    fileName: "RelayConsole-0.0.9.dmg",
    url: "https://relayconsole.work/downloads/RelayConsole-0.0.9.dmg",
    checksumURL:
      "https://relayconsole.work/downloads/RelayConsole-0.0.9.dmg.sha256",
    sha256: "d".repeat(64),
    sizeBytes: 11_111,
    publishedAt: "2026-06-15T12:00:00.000Z",
    architectures: ["arm64"],
    signatureMode: "developer-id-hardened-runtime",
    notarizationStatus: "accepted-stapled",
    retainedUntil: "2026-07-20T12:00:00.000Z",
    distributionEvidenceSHA256: previousDistribution,
  })
  assert.equal(buildMacOSUpdateManifest(environment(shortRetention)), null)
})

test("the endpoint is unavailable outside the exact production release deployment", async () => {
  const original = process.env
  process.env = { ...original, ...environment(manifest()) }
  try {
    const response = GET()
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      schemaVersion: "relay.macos-update-manifest.error.v1",
      status: "unavailable",
    })
  } finally {
    process.env = original
  }
})

test("the endpoint publishes only a validated manifest from the exact release deployment", async () => {
  const original = process.env
  process.env = { ...original, ...releasedVercelEnvironment(manifest()) }
  try {
    const response = GET()
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0")
    assert.deepEqual(await response.json(), manifest())
  } finally {
    process.env = original
  }
})

test("download and release-note pages replace candidate copy with exact artifact metadata", () => {
  const original = process.env
  process.env = { ...original, ...environment(manifest()) }
  try {
    const download = renderedText(DownloadPage())
    const install = renderedText(InstallPage())
    const knownIssues = renderedText(KnownIssuesPage())
    const releaseNotes = renderedText(ReleaseNotesPage())
    for (const rendered of [download, install, knownIssues, releaseNotes]) {
      assert.match(rendered, /0\.1\.0/)
      assert.match(rendered, /build 1/i)
      assert.doesNotMatch(
        rendered,
        /candidate only|no public artifact|proof pending/i
      )
    }
    assert.match(download, new RegExp(sha))
    assert.match(releaseNotes, new RegExp(sha))
    assert.match(download, /Developer ID signed/)
    assert.match(download, /Accepted by Apple and stapled/)
    assert.match(install, /Install Relay Console 0\.1\.0, build 1/)
    assert.doesNotMatch(install, /Installation starts after Relay publishes/)
    assert.match(knownIssues, /Applications are a local preview/)
    assert.match(knownIssues, /computer you control/)
    assert.doesNotMatch(
      knownIssues,
      /allowlist is empty|has not published a signed/i
    )
    assert.match(
      releaseNotes,
      /does not install, authenticate, update, host, or uninstall/
    )
  } finally {
    process.env = original
  }
})
