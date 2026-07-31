import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import test from "node:test"

const testDir = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(testDir, "..")
const repoRoot = resolve(webRoot, "..")

const webPackage = JSON.parse(
  readFileSync(join(webRoot, "package.json"), "utf8")
) as { dependencies?: Record<string, string> }
const rootPackage = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8")
) as { pnpm?: { overrides?: Record<string, string> } }
const backendPackage = JSON.parse(
  readFileSync(join(repoRoot, "backend/package.json"), "utf8")
) as { dependencies?: Record<string, string> }
const globalsSource = readFileSync(join(webRoot, "app/globals.css"), "utf8")
const lockfile = readFileSync(join(repoRoot, "pnpm-lock.yaml"), "utf8")

test("web production dependencies exclude shadcn CLI tooling", () => {
  assert.equal(webPackage.dependencies?.shadcn, undefined)
  assert.doesNotMatch(globalsSource, /shadcn\/tailwind\.css/)
  assert.doesNotMatch(lockfile, /\n\s{6}shadcn:\n/)
})

test("sanitizer and websocket dependency ranges stay on audited patch floors", () => {
  assert.equal(webPackage.dependencies?.dompurify, "^3.4.11")
  assert.equal(backendPackage.dependencies?.["sanitize-html"], "2.17.5")
  assert.equal(backendPackage.dependencies?.ws, "^8.21.0")
  assert.match(
    lockfile,
    /dompurify:\n\s+specifier: \^3\.4\.11\n\s+version: 3\.4\.12/
  )
  assert.match(
    lockfile,
    /sanitize-html:\n\s+specifier: 2\.17\.5\n\s+version: 2\.17\.5/
  )
  assert.match(lockfile, /ws:\n\s+specifier: \^8\.21\.0\n\s+version: 8\.21\.0/)
})

test("production dependency overrides keep transitive advisories on patched floors", () => {
  assert.deepEqual(rootPackage.pnpm?.overrides, {
    "@nestjs/platform-ws@10.4.22>ws": "8.21.0",
    "@babel/core": "7.29.6",
    "@opentelemetry/core": "2.9.0",
    "ajv@8.20.0>fast-uri": "3.1.4",
    "body-parser@1.20.4": "1.20.6",
    "brace-expansion@5.0.4": "5.0.8",
    "express@4.22.1>path-to-regexp": "0.1.13",
    "file-type@20.4.1": "21.3.2",
    "js-yaml@4.1.0": "4.3.0",
    lodash: "4.18.1",
    multer: "2.2.0",
    "minimatch@9.0.9": "9.0.8",
    "postcss@<=8.5.17": "8.5.18",
    "qs@6.14.2": "6.15.2",
    "sharp@0.34.5": "0.35.0",
    uuid: "11.1.1",
  })
  assert.match(lockfile, /'@babel\/core@7\.29\.6':/)
  assert.match(lockfile, /'@opentelemetry\/core@2\.9\.0':/)
  assert.match(lockfile, /fast-uri@3\.1\.4:/)
  assert.match(lockfile, /body-parser@1\.20\.6:/)
  assert.match(lockfile, /brace-expansion@5\.0\.8:/)
  assert.match(lockfile, /minimatch@9\.0\.8:/)
  assert.match(lockfile, /file-type@21\.3\.2:/)
  assert.match(lockfile, /js-yaml@4\.3\.0:/)
  assert.match(lockfile, /path-to-regexp@0\.1\.13:/)
  assert.match(lockfile, /lodash@4\.18\.1:/)
  assert.match(lockfile, /multer@2\.2\.0:/)
  assert.match(lockfile, /postcss@8\.5\.18:/)
  assert.match(lockfile, /qs@6\.15\.2:/)
  assert.match(lockfile, /sharp@0\.35\.0:/)
  assert.match(lockfile, /uuid@11\.1\.1:/)
  assert.match(lockfile, /ws@8\.21\.0:/)
})
