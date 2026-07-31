#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  readdirSync,
  rmSync,
} from "node:fs"
import { dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const ROOT = resolve(dirname(SCRIPT_PATH), "..")

export const STATIC_CACHE_TARGETS = Object.freeze([
  "Relay Console landing page/.next",
  "RelayConsoleSwift/.build",
  "RelayConsoleSwift/dist",
  "backend/coverage",
  "backend/dist",
  "claude-runtime/coverage",
  "claude-runtime/dist",
  "hermes-runtime/.pytest_cache",
  "relay-console/coverage",
  "relay-console/dist",
  "web/.next",
  "web/coverage",
])

function assertBounded(root, candidate) {
  const prefix = `${resolve(root)}${sep}`
  if (!candidate.startsWith(prefix) || candidate === resolve(root)) {
    throw new Error(`Refusing unbounded cleanup target: ${candidate}`)
  }
}

function findPythonBytecodeCaches(root) {
  const pythonRoot = resolve(root, "hermes-runtime/src")
  if (!existsSync(pythonRoot)) return []
  const targets = []
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const candidate = resolve(directory, entry.name)
      if (entry.isSymbolicLink()) continue
      if (!entry.isDirectory()) continue
      if (entry.name === "__pycache__") {
        targets.push(candidate)
      } else {
        visit(candidate)
      }
    }
  }
  visit(pythonRoot)
  return targets
}

export function resolveCleanupTargets(root = ROOT) {
  const targets = [
    ...STATIC_CACHE_TARGETS.map((entry) => resolve(root, entry)),
    ...findPythonBytecodeCaches(root),
  ]
  return [...new Set(targets)]
    .filter(existsSync)
    .sort()
    .map((candidate) => {
      assertBounded(root, candidate)
      if (lstatSync(candidate).isSymbolicLink()) {
        throw new Error(`Refusing symlink cleanup target: ${candidate}`)
      }
      return candidate
    })
}

export function cleanRepositoryCaches({ root = ROOT, apply = false } = {}) {
  const targets = resolveCleanupTargets(root)
  for (const target of targets) {
    process.stdout.write(
      `${apply ? "remove" : "would remove"} ${relative(root, target)}\n`,
    )
    if (apply) rmSync(target, { recursive: true, force: false })
  }
  process.stdout.write(
    `${apply ? "Removed" : "Found"} ${targets.length} bounded cache target(s).\n`,
  )
  return targets
}

function main() {
  const args = new Set(process.argv.slice(2))
  const unknown = [...args].filter((arg) => arg !== "--apply")
  if (unknown.length > 0) {
    throw new Error(`Unknown argument(s): ${unknown.join(", ")}`)
  }
  cleanRepositoryCaches({ apply: args.has("--apply") })
}

if (resolve(process.argv[1] ?? "") === SCRIPT_PATH) {
  main()
}
