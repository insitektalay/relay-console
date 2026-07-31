#!/usr/bin/env node

import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const ROOT = resolve(dirname(SCRIPT_PATH), "..")

function read(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8")
}

export function validateRepositoryOwnership(input) {
  const errors = []
  const requiredWorkspaceEntries = [
    '"Relay Console landing page"',
    "backend",
    "claude-runtime",
    "web",
    "packages/*",
  ]
  for (const entry of requiredWorkspaceEntries) {
    if (!input.workspace.includes(`- ${entry}`)) {
      errors.push(`Missing maintained workspace entry: ${entry}`)
    }
  }
  if (input.workspace.includes("- relay-console")) {
    errors.push("Archived Electron prototype remains a workspace member.")
  }
  if (/^\s{2}relay-console:\s*$/m.test(input.lockfile)) {
    errors.push("Archived Electron prototype remains a lockfile importer.")
  }

  const rootRequirements = [
    "Railway API and control plane",
    "Vercel web client",
    "Native macOS client",
    "Native iPhone and iPad client",
    "Archived reference implementation",
    "Legacy prototype/compatibility snapshot",
  ]
  for (const phrase of rootRequirements) {
    if (!input.readme.includes(phrase)) {
      errors.push(`Root surface map is missing: ${phrase}`)
    }
  }
  if (input.readme.includes("├── bridge/")) {
    errors.push("Root README still describes the removed standalone bridge.")
  }

  const policyRequirements = [
    "| O-001 |",
    "| O-002 |",
    "| O-003 |",
    "| O-004 |",
    "at least 180 days",
    "pnpm clean:repository-caches:apply",
  ]
  for (const phrase of policyRequirements) {
    if (!input.policy.includes(phrase)) {
      errors.push(`Ownership or retention policy is missing: ${phrase}`)
    }
  }
  if (!input.electronReadme.includes("intentionally excluded")) {
    errors.push("Electron archive marker is missing.")
  }
  return errors
}

export function auditRepositoryOwnership() {
  return validateRepositoryOwnership({
    workspace: read("pnpm-workspace.yaml"),
    lockfile: read("pnpm-lock.yaml"),
    readme: read("README.md"),
    policy: read("docs/repository-ownership-and-retention.md"),
    electronReadme: read("relay-console/README.md"),
  })
}

function main() {
  const errors = auditRepositoryOwnership()
  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n")}\n`)
    process.exitCode = 1
    return
  }
  process.stdout.write(
    "Repository ownership gate passed: maintained, supported and archived surfaces are explicit.\n",
  )
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  main()
}
