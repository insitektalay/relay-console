import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import nextConfig from "../next.config.mjs"

const execFileAsync = promisify(execFile)
const resetCacheScript = fileURLToPath(
  new URL("../scripts/reset-turbopack-cache.mjs", import.meta.url)
)

test("development disables the persistent Turbopack filesystem cache", () => {
  assert.equal(nextConfig.experimental?.turbopackFileSystemCacheForDev, false)
})

test("the web API rewrite remains Railway-only", async () => {
  const rewrites = await nextConfig.rewrites?.()
  assert.ok(Array.isArray(rewrites))
  assert.equal(rewrites.length, 1)
  assert.equal(rewrites[0].source, "/api/v1/:path*")

  const destination = new URL(rewrites[0].destination.replace("/:path*", ""))
  assert.equal(destination.protocol, "https:")
  assert.equal(destination.pathname, "/api/v1")
  assert.ok(!["localhost", "127.0.0.1", "::1"].includes(destination.hostname))
})

test("cache reset removes only the exact Turbopack cache directory", async () => {
  const projectRoot = await mkdtemp(
    path.join(tmpdir(), "relay-web-cache-test-")
  )
  const cachePath = path.join(projectRoot, ".next", "dev", "cache", "turbopack")
  const siblingPath = path.join(projectRoot, ".next", "dev", "keep.txt")

  try {
    await mkdir(cachePath, { recursive: true })
    await writeFile(path.join(cachePath, "cache.sst"), "cache")
    await writeFile(siblingPath, "keep")

    const { stdout } = await execFileAsync(
      process.execPath,
      [resetCacheScript],
      {
        cwd: projectRoot,
      }
    )

    assert.match(stdout, /Removed Turbopack development cache:/)
    await assert.rejects(readFile(path.join(cachePath, "cache.sst")), {
      code: "ENOENT",
    })
    assert.equal(await readFile(siblingPath, "utf8"), "keep")
  } finally {
    await rm(projectRoot, { recursive: true, force: true })
  }
})
