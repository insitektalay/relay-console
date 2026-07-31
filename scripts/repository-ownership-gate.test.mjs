import assert from "node:assert/strict"
import {
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { resolve } from "node:path"
import { mkdtempSync } from "node:fs"
import test from "node:test"
import {
  cleanRepositoryCaches,
  resolveCleanupTargets,
} from "./repository-cache-cleanup.mjs"
import {
  auditRepositoryOwnership,
  validateRepositoryOwnership,
} from "./repository-ownership-gate.mjs"

function validInput() {
  return {
    workspace:
      '- "Relay Console landing page"\n- backend\n- claude-runtime\n- web\n- packages/*\n',
    lockfile: "importers:\n  backend: {}\n",
    readme:
      "Railway API and control plane\nVercel web client\nNative macOS client\nNative iPhone and iPad client\nArchived reference implementation\nLegacy prototype/compatibility snapshot\n",
    policy:
      "| O-001 |\n| O-002 |\n| O-003 |\n| O-004 |\nat least 180 days\npnpm clean:repository-caches:apply\n",
    electronReadme: "This package is intentionally excluded from the workspace.",
  }
}

test("repository ownership accepts the declared maintained and archived surfaces", () => {
  assert.deepEqual(validateRepositoryOwnership(validInput()), [])
  assert.deepEqual(auditRepositoryOwnership(), [])
})

test("repository ownership rejects an installed archived Electron importer", () => {
  const input = validInput()
  input.workspace += "- relay-console\n"
  input.lockfile += "  relay-console:\n"
  const errors = validateRepositoryOwnership(input)
  assert.ok(errors.some((error) => error.includes("workspace member")))
  assert.ok(errors.some((error) => error.includes("lockfile importer")))
})

test("cache cleanup only removes bounded allowlisted output", () => {
  const root = mkdtempSync(resolve(tmpdir(), "relay-cache-test-"))
  mkdirSync(resolve(root, "web/.next"), { recursive: true })
  mkdirSync(resolve(root, "hermes-runtime/src/pkg/__pycache__"), {
    recursive: true,
  })
  writeFileSync(resolve(root, "web/.next/cache"), "cache")
  writeFileSync(resolve(root, "source.ts"), "keep")

  const targets = resolveCleanupTargets(root)
  assert.equal(targets.length, 2)
  cleanRepositoryCaches({ root, apply: true })
  assert.equal(resolveCleanupTargets(root).length, 0)
  assert.equal(readFileSync(resolve(root, "source.ts"), "utf8"), "keep")
})

test("cache cleanup refuses a symlink at an allowlisted target", () => {
  const root = mkdtempSync(resolve(tmpdir(), "relay-cache-link-test-"))
  const outside = mkdtempSync(resolve(tmpdir(), "relay-cache-outside-"))
  mkdirSync(resolve(root, "web"), { recursive: true })
  symlinkSync(outside, resolve(root, "web/.next"))
  assert.throws(
    () => resolveCleanupTargets(root),
    /Refusing symlink cleanup target/,
  )
})
