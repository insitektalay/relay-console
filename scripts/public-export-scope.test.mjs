import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function exportIgnore(path) {
  const result = spawnSync(
    "git",
    ["check-attr", "export-ignore", "--", path],
    { cwd: repositoryRoot, encoding: "utf8" },
  )

  assert.equal(result.status, 0, result.stderr || `git check-attr failed for ${path}`)
  return result.stdout.trim().split(": ").at(-1)
}

test("public archive excludes private, historical, and confirmed non-runtime material", () => {
  const excluded = [
    "AGENTS.md",
    "web/AGENTS.md",
    "PRIVATE_release_sanitisation_checklist.md",
    "relay-console",
    "ClawChat.xcodeproj",
    "docs/relay-console-ios-parity/evidence",
    "docs/relay-console-ios-parity",
    "docs/native-agent-connection",
    "docs/RELAY_RUNTIME_ARCHITECTURE_MASTER_CHECKLIST.md",
    "docs/RUNTIME_OWNERSHIP_BOUNDARIES.md",
    "web/public/landing",
    "web/public/landing-pages",
    "web/app/landing-pages",
    "web/components/landing-pages",
    "web/agent_images",
    "Relay Console landing page/public",
    "ios/ClawChat/Assets.xcassets/AlexKerssAvatar.imageset",
    "docs/relay-cloud",
    "docs/open-source-release-roadmap.md",
    "RelayConsoleSwift/HANDOFF.md",
    "RelayConsoleSwift/Scripts/com.clawchat.relay-oauth-batch-controller.plist",
    "web/YouTube video",
    "web/docs/hermes-payload-dumps",
    "web/docs/railway-handoff",
    "docs/private-owner-configuration.md",
    "web/public/avatars/illustrated-originals",
    "web/public/avatars/need-cropping",
  ]

  for (const path of excluded) {
    assert.equal(exportIgnore(path), "set", `${path} must be export-ignored`)
  }
})

test("public archive retains maintained product and runtime sources", () => {
  const retained = [
    "backend/src/main.ts",
    "web/package.json",
    "web/public/avatars/illustrated/illustrated-black-female-01.png",
    "web/public/brand/relay-console-logo.png",
    "web/public/images/relay-console-logo.png",
    "web/public/agent-ops-hq/agents/office-worker-02.png",
    "logo.png",
    "ASSET_LICENSES.md",
    "SOURCE_COMMIT",
    "logotext.png",
    "textlogo2.png",
    "RelayConsoleSwift/Package.swift",
    "RelayConsoleSwift/Release/PrivacyInfo.xcprivacy",
    "ios/ClawChat.xcodeproj/project.pbxproj",
    "packages/marketplace-catalog/package.json",
    "claude-runtime/package.json",
    "hermes-runtime/pyproject.toml",
  ]

  for (const path of retained) {
    assert.notEqual(exportIgnore(path), "set", `${path} must remain public`)
  }
})

test("public asset notice points to a complete Marketplace provenance index", () => {
  const notice = readFileSync(resolve(repositoryRoot, "ASSET_LICENSES.md"), "utf8")
  const atlas = JSON.parse(
    readFileSync(
      resolve(
        repositoryRoot,
        "packages/marketplace-catalog/release/marketplace-icon-atlas-index.json",
      ),
      "utf8",
    ),
  )

  assert.match(notice, /Provider names, logos and favicons belong to their respective owners/)
  assert.match(notice, /marketplace-icon-atlas-index\.json/)
  const entries = Object.values(atlas.apps)
  assert.equal(entries.length, atlas.appCount)
  assert.ok(entries.length > 0)
  for (const entry of entries) {
    assert.match(entry.sourceUrl, /^https:\/\//)
    assert.match(entry.sourceSHA256, /^[a-f0-9]{64}$/)
  }
})
