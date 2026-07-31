import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const testDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(testDir, "..")
const repoRoot = resolve(webRoot, "..")

const browserSourceRoots = [
  join(webRoot, "components"),
  join(webRoot, "hooks"),
  join(webRoot, "lib"),
  join(repoRoot, "packages/web-sdk/src"),
]

const forbiddenStorageCall =
  /\b(?:window\.)?(?:localStorage|sessionStorage)\s*\.\s*(?:setItem|getItem)\s*\(\s*([^,\n)]*(?:access|bearer|bridge|credential|password|refresh|secret|token)[^,\n)]*)/gi

function collectSourceFiles(root: string): string[] {
  const entries = readdirSync(root)
  const files: string[] = []
  for (const entry of entries) {
    const path = join(root, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(path))
      continue
    }
    if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      files.push(path)
    }
  }
  return files
}

function readBrowserSource() {
  return browserSourceRoots.flatMap((root) =>
    collectSourceFiles(root).map((file) => ({
      file,
      relativePath: relative(repoRoot, file),
      source: readFileSync(file, "utf8"),
    }))
  )
}

test("browser source does not persist token-shaped values in Web Storage", () => {
  const matches: string[] = []
  for (const { relativePath, source } of readBrowserSource()) {
    for (const match of source.matchAll(forbiddenStorageCall)) {
      matches.push(`${relativePath}: ${match[0]}`)
    }
  }

  assert.deepEqual(matches, [])
})

test("web SDK browser registration uses cookie sessions, not token-returning register", () => {
  const sdkSource = readFileSync(
    join(repoRoot, "packages/web-sdk/src/index.ts"),
    "utf8"
  )
  const registerCall = sdkSource.match(
    /register:\s*(?:async\s*)?\([\s\S]*?\)\s*=>\s*this\.request<[^>]+>\("([^"]+)"/
  )

  assert.equal(registerCall?.[1], "/auth/web/register")
  assert.doesNotMatch(sdkSource, /"\/auth\/register"/)
})
